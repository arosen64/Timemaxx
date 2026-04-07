import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function rebuildStudyBlocks(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  timeEstimate: number
) {
  const existingBlocks = await ctx.db
    .query("studyBlocks")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const block of existingBlocks) {
    await ctx.db.delete(block._id);
  }

  const task = await ctx.db.get(taskId);
  if (!task) return;

  const user = await ctx.db.get(task.userId);
  const focusBlockLength = user?.focusBlockLength || 60;

  const blockCount = Math.ceil(timeEstimate / focusBlockLength);
  for (let i = 0; i < blockCount; i++) {
    const isLastBlock = i === blockCount - 1;
    const remainder = timeEstimate % focusBlockLength;
    const studyBlockLength =
      isLastBlock && remainder !== 0 ? remainder : focusBlockLength;

    await ctx.db.insert("studyBlocks", {
      taskId,
      title: task.title,
      startTime: undefined,
      studyBlockLength,
    });
  }
}

export const setTimeEstimate = internalMutation({
  args: {
    taskId: v.id("tasks"),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Do not overwrite a manually set estimate
    if (task.isManualEstimate) return;

    await ctx.db.patch(args.taskId, { timeEstimate: args.timeEstimate });
    await rebuildStudyBlocks(ctx, args.taskId, args.timeEstimate);
  },
});

export const setManualTimeEstimate = mutation({
  args: {
    taskId: v.id("tasks"),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      timeEstimate: args.timeEstimate,
      isManualEstimate: true,
    });

    await rebuildStudyBlocks(ctx, args.taskId, args.timeEstimate);
  },
});

export const clearManualEstimate = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      isManualEstimate: false,
      timeEstimate: undefined,
    });

    // Delete existing study blocks so AI can regenerate fresh
    const existingBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const block of existingBlocks) {
      await ctx.db.delete(block._id);
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
