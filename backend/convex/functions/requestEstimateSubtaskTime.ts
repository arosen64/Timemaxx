import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

export const requestEstimateSubtaskTime = action({
  args: {
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.runQuery(api.queries.subtasks.getSubtask, {
      subtaskId: args.subtaskId,
    });
    if (!subtask) throw new Error("Subtask not found or access denied");

    await ctx.runAction(internal.ai.estimateTaskTime.estimateTaskTime, {
      subtaskId: args.subtaskId,
    });
  },
});
