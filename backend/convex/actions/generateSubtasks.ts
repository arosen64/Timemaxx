"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { z } from "zod";
import { callGemini } from "../lib/gemini";
import { computeSubtaskCascade } from "../lib/scheduleSlots";

export type GeneratedSubtask = {
  title: string;
  description: string;
  taskType: string;
  // suggestedCompletionAt is a linear placeholder for the preview.
  // After the user confirms and subtasks are estimated, the confirm action
  // recomputes it proportionally from actual timeEstimate values.
  suggestedCompletionAt: string; // ISO 8601
};

export type GenerateSubtasksResult =
  | { subtasks: GeneratedSubtask[] }
  | { error: string };

export const generateSubtasks = internalAction({
  args: {
    taskId: v.id("tasks"),
    fileContent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSubtasksResult> => {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return { error: "Task not found." };

    const hasDescription = task.description.trim().length > 0;
    const hasFileContent = (args.fileContent ?? "").trim().length > 0;

    if (!hasDescription && !hasFileContent) {
      return {
        error:
          "Please provide a description or upload an assignment file before generating subtasks.",
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return { error: "Subtask generation is unavailable. Please try again later." };
    }

    const dueDate = new Date(task.dueDate).toISOString();

    const prompt = `You are an academic study planner. Break the following assignment into a set of concrete, actionable subtasks a student should complete to finish it on time.

Assignment title: ${task.title}
Assignment type: ${task.taskType}
Due date: ${dueDate}
${task.description.trim() ? `\nAssignment description:\n${task.description}` : ""}
${hasFileContent ? `\nAdditional context from uploaded file:\n${args.fileContent}` : ""}

For each subtask provide:
- title: short action-oriented name (e.g. "Read chapters 3–4", "Draft thesis statement")
- description: 1-2 sentences on what the student should do
- taskType: one of "Essay", "Problem Set", "Exam Prep", "Coding", "Reading", "Lab", "Presentation"

Return 1–6 subtasks ordered by when they should be completed. If the assignment is simple and doesn't benefit from being broken down, returning a single subtask is perfectly fine.`;

    const subtaskSchema = z.object({
      subtasks: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          taskType: z.string(),
        })
      ),
    });

    try {
      const json = await callGemini({
        system: "You are an academic study planner that breaks assignments into concrete, actionable subtasks.",
        prompt,
        schema: subtaskSchema,
        schemaName: "GeneratedSubtasks",
        timeoutMs: 30_000,
      });

      const rawSubtasks = json.subtasks ?? [];

      if (rawSubtasks.length === 0) {
        return { error: "Gemini returned no subtasks. Please try again." };
      }

      const nowMs = Date.now();
      const dueDateMs = task.dueDate;
      const n = rawSubtasks.length;
      const dateAt = computeSubtaskCascade(nowMs, dueDateMs, n);

      const subtasks: GeneratedSubtask[] = rawSubtasks.map((s, i) => ({
        ...s,
        suggestedCompletionAt: new Date(dateAt(i)).toISOString(),
      }));

      return { subtasks };
    } catch (err) {
      console.error("Failed to generate subtasks:", err);
      return { error: err instanceof Error ? err.message : "Failed to generate subtasks" };
    }
  },
});
