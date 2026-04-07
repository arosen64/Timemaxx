"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { taskToTaskLike } from "../lib/taskTypes";
import { estimateAndStore } from "../lib/estimationContext";

/**
 * Estimates how long a task will take (in minutes) using OpenAI.
 * Builds context from the user's profile, current-term enrolled courses,
 * prior same-department grades, and past estimate feedback, then stores
 * the result via setTimeEstimate.
 */
export const estimateTaskTime = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) return;

    const [user, priorEstimateFeedback, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: task.userId }),
      ctx.runQuery(internal.queries.tasks.getEstimateFeedbackContextInternal, { userId: task.userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: task.userId }),
    ]);

    try {
      await estimateAndStore(
        taskToTaskLike(task),
        user,
        priorEstimateFeedback,
        allCourses,
        async (minutes) => {
          await ctx.runMutation(internal.mutations.timeEstimate.setTimeEstimate, {
            taskId: args.taskId,
            timeEstimate: minutes,
          });
        }
      );
    } catch (err) {
      console.error("Failed to estimate task time:", err);
      throw err;
    }
  },
});
