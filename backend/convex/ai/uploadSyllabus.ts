import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createMastraClient } from "../lib/mastraClient";
import { sanitizeUserInput, validateLength } from "../lib/sanitize";
import { TaskType, TASK_TYPES } from "../lib/taskValidators";
import { UploadSyllabusResult } from "../lib/syllabusTypes";
import { withTimeout } from "../lib/withTimeout";
import { withAiObservability } from "../lib/aiObservability";

/**
 * Parses a syllabus using Mastra:
 *
 * PDF path:
 * 1. `syllabus-ocr-workflow`   — Mistral OCR extracts text from base64-encoded PDF bytes
 * 2. `sanitizeUserInput`       — prompt-injection sanitizer runs on the OCR output
 * 3. `syllabus-parse-workflow` — Claude agent extracts structured task data
 *
 * Text path (mimeType !== "application/pdf"):
 * 1. `sanitizeUserInput`       — prompt-injection sanitizer runs on the raw text
 * 2. `syllabus-parse-workflow` — Claude agent extracts structured task data
 *
 * On success the syllabus record is patched to "confirmed" and
 * `{ syllabusId, extractedTasks }` is returned for review.
 * On any error the record is patched to "failed" before re-throwing.
 */
export const uploadSyllabus = action({
  args: {
    fileContents: v.string(),
    mimeType: v.optional(v.string()),
    courseId: v.optional(v.id("userCourses")),
  },
  handler: async (ctx, args): Promise<UploadSyllabusResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // 1 MB plain text ≈ 1,000,000 chars; 1 MB PDF base64-encoded ≈ 1,400,000 chars
    validateLength(args.fileContents, 1_500_000, "fileContents");

    if (args.courseId) {
      await ctx.runMutation(internal.mutations.syllabi.deleteSyllabiForCourse, {
        courseId: args.courseId,
      });
    }

    const syllabusId = await ctx.runMutation(internal.mutations.syllabi.createSyllabus, {
      userId,
      fileContents: args.fileContents,
      courseId: args.courseId,
    });

    try {
      const mastraUrl = process.env.MASTRA_URL;
      if (!mastraUrl) throw new Error("MASTRA_URL not configured");
      const client = createMastraClient(mastraUrl);

      let textForParsing: string;

      if (args.mimeType === "application/pdf") {
        // PDF path: run Mistral OCR on the base64-encoded file bytes first
        const ocrWf = client.getWorkflow("syllabus-ocr-workflow");
        const ocrRun = await withAiObservability(
          ctx,
          {
            callSite: "uploadSyllabus.ocr",
            provider: "mastra",
            model: "syllabus-ocr-workflow",
            userId,
            promptPreview: `[base64 PDF, ${args.fileContents.length} chars]`,
            metadata: { syllabusId, courseId: args.courseId },
          },
          () =>
            withTimeout(
              ocrWf.startAsync({ inputData: { fileContents: args.fileContents } }),
              "Syllabus OCR"
            ),
          (r) => ({
            responsePreview: (
              r.steps?.["ocr"] as { output?: { extractedText?: string } } | undefined
            )?.output?.extractedText,
          })
        );
        const ocrStep = ocrRun.steps?.["ocr"] as
          | { status: string; output?: { extractedText?: string }; error?: string | Error }
          | undefined;
        if (!ocrStep || ocrStep.status !== "success") {
          const cause = ocrStep?.error ? String(ocrStep.error) : "step did not complete";
          throw new Error(`Syllabus OCR failed: ${cause}`);
        }
        textForParsing = ocrStep.output?.extractedText ?? "";
      } else {
        // Text path: content is already plain text
        textForParsing = args.fileContents;
      }

      // Sanitize — prompt-injection protection before the LLM sees the text
      const sanitizedText = sanitizeUserInput(textForParsing, 1_500_000);

      // Parse — Claude agent extracts structured task data
      // Workflow expects already-sanitized input; do not call without sanitizing first.
      const parseWf = client.getWorkflow("syllabus-parse-workflow");
      const parseRun = await withAiObservability(
        ctx,
        {
          callSite: "uploadSyllabus.parse",
          provider: "mastra",
          model: "syllabus-parse-workflow",
          userId,
          promptPreview: sanitizedText,
          metadata: { syllabusId, courseId: args.courseId },
        },
        () => withTimeout(parseWf.startAsync({ inputData: { sanitizedText } }), "Syllabus parse"),
        (r) => {
          const step = r.steps?.["parse"];
          return {
            responsePreview: step && "output" in step ? JSON.stringify(step.output) : undefined,
          };
        }
      );

      const parseStep = parseRun.steps?.["parse"];
      if (!parseStep || parseStep.status !== "success" || !("output" in parseStep)) {
        throw new Error("Syllabus parse workflow did not complete successfully");
      }
      const parseOutput = parseStep.output as {
        tasks: {
          title: string;
          description: string;
          dueDate: string;
          taskType: string;
          assignmentWeight?: number;
        }[];
      };

      const rawTasks = parseOutput.tasks ?? [];
      const now = Date.now();
      const validTaskTypes = new Set<string>(TASK_TYPES);

      const extractedTasks = rawTasks
        .filter((t) => validTaskTypes.has(t.taskType))
        .map((t) => ({
          title: t.title,
          description: t.description,
          dueDate: new Date(t.dueDate).getTime(),
          taskType: t.taskType as TaskType,
          assignmentWeight: t.assignmentWeight,
        }))
        .filter((t) => !isNaN(t.dueDate) && t.dueDate > now);

      await ctx.runMutation(internal.mutations.syllabi.setSyllabusStatus, {
        syllabusId,
        status: "confirmed",
      });

      return { syllabusId, extractedTasks };
    } catch (err) {
      await ctx.runMutation(internal.mutations.syllabi.setSyllabusStatus, {
        syllabusId,
        status: "failed",
      });
      throw err;
    }
  },
});
