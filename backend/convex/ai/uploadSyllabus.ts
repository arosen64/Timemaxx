import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callGemini } from "../lib/gemini";
import { sanitizeUserInput, validateLength } from "../lib/sanitize";
import { TaskType, TASK_TYPES } from "../lib/taskValidators";
import { UploadSyllabusResult } from "../lib/syllabusTypes";
import {
  SYLLABUS_SYSTEM,
  buildSyllabusPrompt,
  syllabusResponseSchema,
} from "../lib/prompts/uploadSyllabus.prompt";

/**
 * Sends syllabus text to Gemini and returns extracted tasks.
 *
 * Flow:
 * 1. Creates a `syllabi` row with status "pending".
 * 2. Calls Gemini (gemini-2.5-flash) with a 30s timeout to extract assignments
 *    as structured JSON — each task includes a Gemini-generated description.
 * 3. On success, patches the syllabus to status "confirmed" and returns
 *    `{ syllabusId, extractedTasks }` for the caller to review and confirm.
 * 4. On any error (including timeout), patches to status "failed" before re-throwing.
 *
 * Extracted tasks are NOT saved to the `tasks` table here — use
 * `confirmSyllabusTasks` mutation to persist the user-approved tasks.
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

    const sanitized = sanitizeUserInput(args.fileContents, 200_000);

    try {
      const json = await callGemini({
        system: SYLLABUS_SYSTEM,
        prompt: buildSyllabusPrompt(sanitized),
        schema: syllabusResponseSchema,
        schemaName: "SyllabusExtraction",
        timeoutMs: 30_000,
      });

      const rawTasks = json.tasks ?? [];

      // Belt-and-suspenders: filter even though Zod schema validates taskType
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
