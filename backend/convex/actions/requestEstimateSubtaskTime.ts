"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const requestEstimateSubtaskTime = action({
  args: {
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.actions.estimateSubtaskTime.estimateSubtaskTime, {
      subtaskId: args.subtaskId,
    });
  },
});
