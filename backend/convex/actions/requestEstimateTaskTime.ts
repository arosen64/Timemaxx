"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

export const requestEstimateTaskTime = action({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(api.queries.tasks.getTask, { taskId: args.taskId });
    if (!task) throw new Error("Task not found or access denied");

    if (task.isManualEstimate) return;

    await ctx.runAction(internal.actions.estimateTaskTime.estimateTaskTime, {
      taskId: args.taskId,
    });
  },
});
