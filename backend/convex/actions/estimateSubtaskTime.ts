"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { callOpenAIJSON } from "../lib/openai";

/**
 * Estimates how long a subtask will take (in minutes) using Gemini.
 * Uses the subtask's own title, description, and taskType in the prompt,
 * but inherits the parent task's user and course context for accuracy.
 * Stores the result on the subtask's timeEstimate field.
 */
export const estimateSubtaskTime = internalAction({
  args: {
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.runQuery(internal.queries.subtasks.getSubtaskInternal, {
      subtaskId: args.subtaskId,
    });
    if (!subtask) return;

    const parentTask = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: subtask.parentTaskId,
    });

    const [user, priorEstimateFeedback, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: subtask.userId }),
      ctx.runQuery(internal.queries.tasks.getEstimateFeedbackContextInternal, { userId: subtask.userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: subtask.userId }),
    ]);

    const taskCourse = parentTask?.courseId
      ? allCourses.find((c) => c._id === parentTask.courseId)
      : undefined;

    const userLines = [
      user?.major && `Major: ${user.major}`,
      user?.year && `Year: ${user.year}`,
      user?.difficultSubjects?.length && `Difficult subjects: ${user.difficultSubjects.join(", ")}`,
      user?.enjoyedSubjects?.length && `Enjoyed subjects: ${user.enjoyedSubjects.join(", ")}`,
    ].filter(Boolean).join("\n");

    const transcriptLines = user?.transcriptSummary?.length
      ? `Academic profile from transcript analysis:\n${user.transcriptSummary.map((i) => `- ${i.label}: ${i.text}`).join("\n")}`
      : null;

    const feedbackLines = priorEstimateFeedback.length
      ? `Past estimate feedback from this same student (learn from this):\n${priorEstimateFeedback.map((e) => {
          const corrected = e.correctedEstimateMinutes !== undefined ? `, corrected to ${e.correctedEstimateMinutes} minutes` : "";
          return `- ${e.taskType}: "${e.title}" -> estimated ${e.estimatedMinutes} minutes, feedback ${e.rating}${corrected}`;
        }).join("\n")}`
      : null;

    const courseLines = taskCourse
      ? `Course: ${taskCourse.courseCode} - ${taskCourse.title}${taskCourse.studyGoal ? `\nStudy goal: ${taskCourse.studyGoal}` : ""}`
      : null;

    const prompt = `You are a study time estimator. Given the task details and student profile below, estimate how many minutes it will take the student to complete the task.

Task title: ${subtask.title}
Task type: ${subtask.taskType}
Task description: ${subtask.description}
${courseLines ?? ""}

${userLines ? `Student profile:\n${userLines}` : ""}

${transcriptLines ? `\n${transcriptLines}` : ""}

${courseLines ? `\n${courseLines}` : ""}

${feedbackLines ? `\n${feedbackLines}` : ""}

Respond with JSON in this exact format: {"estimatedMinutes": <integer>}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (process.env.VITEST !== "true") {
        console.error("OPENAI_API_KEY is not set");
      }
      return;
    }

    try {
      const json = await callOpenAIJSON<{ estimatedMinutes: number }>(prompt);

      if (typeof json.estimatedMinutes === "number") {
        await ctx.runMutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
          subtaskId: args.subtaskId,
          timeEstimate: json.estimatedMinutes,
        });
      }
    } catch (err) {
      console.error("Failed to estimate subtask time:", err);
      throw err;
    }
  },
});
