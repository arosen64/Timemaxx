"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Type } from "@google/genai";
import { callGeminiJSON } from "../lib/gemini";

export const estimateTaskTime = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    // Fetch task and user profile
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return;

    const user = await ctx.runQuery(internal.queries.users.getUserInternal, {
      userId: task.userId,
    });
    const priorEstimateFeedback = await ctx.runQuery(
      internal.queries.tasks.getEstimateFeedbackContextInternal,
      { userId: task.userId }
    );

    // Build prompt
    const userContext = [
      user?.major && `Major: ${user.major}`,
      user?.year && `Year: ${user.year}`,
      user?.difficultSubjects?.length && `Difficult subjects: ${user.difficultSubjects.join(", ")}`,
      user?.enjoyedSubjects?.length && `Enjoyed subjects: ${user.enjoyedSubjects.join(", ")}`,
      user?.courses?.length &&
        `Enrolled courses: ${user.courses.map((c) => `${c.title} (goal: ${c.studyGoal})`).join("; ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const feedbackContext =
      priorEstimateFeedback.length > 0
        ? [
            "Past estimate feedback from this same student (learn from this):",
            ...priorEstimateFeedback.map((entry) => {
              const corrected =
                entry.correctedEstimateMinutes !== undefined
                  ? `, corrected to ${entry.correctedEstimateMinutes} minutes`
                  : "";
              return `- ${entry.taskType}: "${entry.title}" -> estimated ${entry.estimatedMinutes} minutes, feedback ${entry.rating}${corrected}`;
            }),
          ].join("\n")
        : "";

    const prompt = `You are a study time estimator. Given the task details and student profile below, estimate how many minutes it will take the student to complete the task.

Task title: ${task.title}
Task type: ${task.taskType}
Task description: ${task.description}

${userContext ? `Student profile:\n${userContext}` : ""}
${feedbackContext ? `\n${feedbackContext}` : ""}

Respond with the estimated number of minutes as a single integer.`;

    // Call Gemini with structured output
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      if (process.env.VITEST !== "true") {
        console.error("GEMINI_API_KEY is not set");
      }
      return;
    }

    try {
      const json = await callGeminiJSON<{ estimatedMinutes: number }>(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedMinutes: { type: Type.INTEGER },
          },
          required: ["estimatedMinutes"],
        },
      });
      const estimatedMinutes = json.estimatedMinutes;

      if (typeof estimatedMinutes === "number") {
        await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
          taskId: args.taskId,
          timeEstimate: estimatedMinutes,
        });
      }
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
