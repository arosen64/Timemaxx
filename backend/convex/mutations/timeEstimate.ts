import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const setTimeEstimate = internalMutation({
  args: {
    taskId: v.id("tasks"),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { timeEstimate: args.timeEstimate });
  },
});

export const submitEstimateFeedback = mutation({
  args: {
    taskId: v.id("tasks"),
    feedback: v.object({
      rating: v.union(v.literal("up"), v.literal("down")),
      correctedEstimateMinutes: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");
    if (task.timeEstimate === undefined) {
      throw new Error("Cannot submit estimate feedback before an estimate exists");
    }
    if (
      args.feedback.correctedEstimateMinutes !== undefined &&
      args.feedback.correctedEstimateMinutes <= 0
    ) {
      throw new Error("Corrected estimate must be greater than 0");
    }

    await ctx.db.patch(args.taskId, {
      estimateFeedbackRating: args.feedback.rating,
      correctedEstimateMinutes: args.feedback.correctedEstimateMinutes,
      estimateFeedbackSubmittedAt: Date.now(),
    });
  },
});
