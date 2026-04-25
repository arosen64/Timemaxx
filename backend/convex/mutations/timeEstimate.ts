import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function rebuildStudyBlocksForSubtask(
  ctx: MutationCtx,
  subtaskId: Id<"subtasks">,
  timeEstimate: number
) {
  const existingBlocks = await ctx.db
    .query("studyBlocks")
    .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtaskId))
    .collect();

  // Preserve blocks already placed on the calendar; only clear unscheduled ones.
  const scheduledCount = existingBlocks.filter((b) => b.startTime !== undefined).length;
  for (const block of existingBlocks) {
    if (block.startTime === undefined) {
      await ctx.db.delete(block._id);
    }
  }

  const subtask = await ctx.db.get(subtaskId);
  if (!subtask) return;

  const user = await ctx.db.get(subtask.userId);
  const focusBlockLength = user?.focusBlockLength || 60;

  const totalBlockCount = Math.ceil(timeEstimate / focusBlockLength);
  const remainder = timeEstimate % focusBlockLength;

  for (let i = scheduledCount; i < totalBlockCount; i++) {
    const isLastBlock = i === totalBlockCount - 1;
    const studyBlockLength = isLastBlock && remainder !== 0 ? remainder : focusBlockLength;
    await ctx.db.insert("studyBlocks", {
      subtaskId,
      userId: subtask.userId,
      title: subtask.title,
      startTime: undefined,
      studyBlockLength,
      isCompleted: false,
    });
  }
}

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
      userId: task.userId,
      title: task.title,
      startTime: undefined,
      studyBlockLength,
      isCompleted: false,
    });
  }
}

export const setTimeEstimate = internalMutation({
  args: {
    taskId: v.id("tasks"),
    timeEstimate: v.number(),
    reasoning: v.object({
      classes: v.string(),
      tasks: v.string(),
      chats: v.string(),
      profile: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Do not overwrite a manually set estimate
    if (task.isManualEstimate) return;

    await ctx.db.patch(args.taskId, {
      timeEstimate: args.timeEstimate,
      reasoning: args.reasoning,
    });

    // When subtasks exist, block rebuilding is owned by the subtask rollup in
    // setSubtaskTimeEstimate (runs once all subtask estimates are in). Running
    // rebuildStudyBlocks here would create blocks sized to a whole-task estimate
    // that doesn't account for the subtask breakdown.
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();
    if (subtasks.length > 0) return;

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

    if (args.timeEstimate < 15) {
      throw new Error("Time estimate must be at least 15 minutes.");
    }

    // Delete all existing subtasks and their study blocks
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();
    for (const subtask of subtasks) {
      const subtaskBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
        .collect();
      for (const block of subtaskBlocks) await ctx.db.delete(block._id);
      await ctx.db.delete(subtask._id);
    }

    await ctx.db.patch(args.taskId, {
      timeEstimate: args.timeEstimate,
      isManualEstimate: true,
      reasoning: undefined,
    });

    // Rebuild task-level blocks sized to the manual estimate using user preferences
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

    // Delete task-level blocks so AI can regenerate fresh
    const existingBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const block of existingBlocks) await ctx.db.delete(block._id);

    await ctx.db.patch(args.taskId, {
      isManualEstimate: false,
      timeEstimate: undefined,
    });
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
