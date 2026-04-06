"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Type } from "@google/genai";
import { callGeminiJSON } from "../lib/gemini";

export type GeneratedSubtask = {
  title: string;
  description: string;
  taskType: string;
  suggestedCompletionAt: string; // ISO 8601 date string
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
- suggestedCompletionAt: ISO 8601 date string for when to finish this subtask, distributed proportionally before the due date

Return 3–6 subtasks ordered by when they should be completed.`;

    try {
      const json = await callGeminiJSON<{ subtasks: GeneratedSubtask[] }>(
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    taskType: { type: Type.STRING },
                    suggestedCompletionAt: { type: Type.STRING },
                  },
                  required: ["title", "description", "taskType", "suggestedCompletionAt"],
                },
              },
            },
            required: ["subtasks"],
          },
          httpOptions: { timeout: 30_000 },
        }
      );

      return { subtasks: json.subtasks ?? [] };
    } catch (err) {
      console.error("Failed to generate subtasks:", err);
      throw err;
    }
  },
});
