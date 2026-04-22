import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput, validateLength } from "../lib/sanitize";
import { TaskType, TASK_TYPES } from "../lib/taskValidators";
import { UploadSyllabusResult } from "../lib/syllabusTypes";

/**
 * Parses a syllabus using two sequential Mastra workflow calls:
 *
 * 1. `syllabus-ocr-workflow`  — Mistral OCR extracts raw text from the file
 * 2. `sanitizeUserInput`      — existing prompt-injection sanitizer runs on
 *                               the OCR output before it reaches any LLM
 * 3. `syllabus-parse-workflow` — Claude agent extracts structured task data
 *
 * On success the syllabus record is patched to "confirmed" and
 * `{ syllabusId, extractedTasks }` is returned for review.
 * On any error the record is patched to "failed" before re-throwing.
 */
export const uploadSyllabus = action({
  args: {
    fileContents: v.string(),
    courseId: v.optional(v.id("userCourses")),
  },
  handler: async (ctx, args): Promise<UploadSyllabusResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    validateLength(args.fileContents, 200_000, "fileContents");

    if (args.courseId) {
      try {
        await ctx.runMutation(internal.mutations.syllabi.deleteSyllabiForCourse, {
          courseId: args.courseId,
        });
      } catch (err) {
        throw new Error(
          `Reupload aborted: could not clear existing syllabus records. ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    let syllabusId: Id<"syllabi">;
    try {
      syllabusId = await ctx.runMutation(
        internal.mutations.syllabi.createSyllabus,
        { userId, fileContents: args.fileContents, courseId: args.courseId }
      );
    } catch (err) {
      throw new Error(
        `Reupload aborted: could not create syllabus record. ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) throw new Error("MASTRA_URL not configured");
    const client = new MastraClient({ baseUrl: mastraUrl });

    try {
      // Step 1: OCR — extract raw text via Mistral OCR
      const ocrWf = client.getWorkflow("syllabus-ocr-workflow");
      const ocrRun = await ocrWf.startAsync({
        inputData: { fileContents: args.fileContents },
      });
      const ocrStep = ocrRun.steps?.["ocr"];
      const rawText =
        ocrStep?.status === "success"
          ? (ocrStep.output as { extractedText: string }).extractedText
          : args.fileContents;

      // Step 2: Sanitize — prompt-injection protection between OCR and LLM
      const sanitizedText = sanitizeUserInput(rawText, 200_000);

      // Step 3: Parse — Claude agent extracts structured task data
      const parseWf = client.getWorkflow("syllabus-parse-workflow");
      const parseRun = await parseWf.startAsync({
        inputData: { sanitizedText },
      });
      const parseStep = parseRun.steps?.["parse"];
      const parseOutput =
        parseStep?.status === "success"
          ? (parseStep.output as { tasks: { title: string; description: string; dueDate: string; taskType: string }[] })
          : undefined;

      const rawTasks = parseOutput?.tasks ?? [];
      const validTaskTypes = new Set<string>(TASK_TYPES);
      const now = Date.now();

      const extractedTasks = rawTasks
        .filter((t) => validTaskTypes.has(t.taskType))
        .map((t) => ({
          title: t.title,
          description: t.description,
          dueDate: new Date(t.dueDate).getTime(),
          taskType: t.taskType as TaskType,
        }))
        .filter((t) => t.dueDate > now);

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
