"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { subtaskToTaskLike } from "../lib/taskTypes";
import { estimateAndStore } from "../lib/estimationContext";

/**
 * Estimates how long a subtask will take (in minutes) using OpenAI.
 * Uses the subtask's own title, description, and taskType in the prompt,
 * but inherits the parent task's dueDate, courseId, and user context for accuracy.
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
    if (!parentTask) return;

    const [user, priorEstimateFeedback, allCourses] = await Promise.all([
      ctx.runQuery(internal.queries.users.getUserInternal, { userId: subtask.userId }),
      ctx.runQuery(internal.queries.tasks.getEstimateFeedbackContextInternal, { userId: subtask.userId }),
      ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId: subtask.userId }),
    ]);

    try {
      await estimateAndStore(
        subtaskToTaskLike(subtask, parentTask),
        user,
        priorEstimateFeedback,
        allCourses,
        async (minutes) => {
          await ctx.runMutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
            subtaskId: args.subtaskId,
            timeEstimate: minutes,
          });
        }
      );
    } catch (err) {
      console.error("Failed to estimate subtask time:", err);
      throw err;
    }
  },
});
