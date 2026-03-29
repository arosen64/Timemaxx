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

    // Delete existing study blocks for this task
    const existingBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const block of existingBlocks) {
      await ctx.db.delete(block._id);
    }

    // Fetch the task to get userId and title
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Fetch user to get focusBlockLength (default 60 min)
    const user = await ctx.db.get(task.userId);
    const focusBlockLength = user?.focusBlockLength || 60;

    // Generate and insert study blocks
    const blockCount = Math.ceil(args.timeEstimate / focusBlockLength);
    for (let i = 0; i < blockCount; i++) {
      const isLastBlock = i === blockCount - 1;
      const remainder = args.timeEstimate % focusBlockLength;
      const studyBlockLength =
        isLastBlock && remainder !== 0 ? remainder : focusBlockLength;

      await ctx.db.insert("studyBlocks", {
        taskId: args.taskId,
        title: task.title,
        startTime: undefined,
        studyBlockLength,
      });
    }
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
