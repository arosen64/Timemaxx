"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const requestEstimateTaskTime = action({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.actions.estimateTaskTime.estimateTaskTime, {
      taskId: args.taskId,
    });
  },
});
