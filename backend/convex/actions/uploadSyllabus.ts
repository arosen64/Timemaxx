"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenAI, Type } from "@google/genai";
import { TaskType, TASK_TYPES } from "../lib/taskValidators";
import { UploadSyllabusResult } from "../lib/syllabusTypes";

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
    fileName: v.string(),
    fileText: v.string(),
    className: v.string(),
    courseId: v.optional(v.id("userCourses")),
  },
  handler: async (ctx, args): Promise<UploadSyllabusResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const syllabusId = await ctx.runMutation(
      internal.mutations.syllabi.createSyllabus,
      { userId, fileName: args.fileName, className: args.className, courseId: args.courseId }
    );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.mutations.syllabi.setSyllabusStatus, {
        syllabusId,
        status: "failed",
      });
      throw new Error("GEMINI_API_KEY is not set");
    }

    const prompt = `You are an academic task extractor. Given the syllabus text below, extract every assignment, exam, project, or deliverable that has a due date.

For each task provide:
- title: short name of the assignment or exam
- description: 1-2 sentence summary of what the task involves, inferred from the syllabus context
- dueDate: ISO 8601 date string (e.g. "2025-04-15")
- taskType: one of "Problem Set", "Essay", "Coding", "Exam Prep"

Syllabus:
${args.fileText}`;

    try {
      const genai = new GoogleGenAI({ apiKey });

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    taskType: {
                      type: Type.STRING,
                      enum: [...TASK_TYPES],
                    },
                  },
                  required: ["title", "description", "dueDate", "taskType"],
                },
              },
            },
            required: ["tasks"],
          },
          httpOptions: { timeout: 30_000 },
        },
      });

      const json = JSON.parse(response.text ?? "{}");
      const rawTasks: Array<{
        title: string;
        description: string;
        dueDate: string;
        taskType: string;
      }> = json.tasks ?? [];

      const validTaskTypes = new Set<string>(TASK_TYPES);

      const extractedTasks = rawTasks
        .filter((t) => validTaskTypes.has(t.taskType))
        .map((t) => ({
          title: t.title,
          description: t.description,
          dueDate: new Date(t.dueDate).getTime(),
          taskType: t.taskType as TaskType,
        }));

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
