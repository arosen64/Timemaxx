import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
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
    });
  }
}

/** Deletes ALL study blocks for a subtask (including scheduled ones) then creates fresh unscheduled blocks sized to timeEstimate. */
async function forceRebuildStudyBlocksForSubtask(
  ctx: MutationCtx,
  subtaskId: Id<"subtasks">,
  timeEstimate: number
) {
  const existingBlocks = await ctx.db
    .query("studyBlocks")
    .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtaskId))
    .collect();
  for (const block of existingBlocks) await ctx.db.delete(block._id);

  const subtask = await ctx.db.get(subtaskId);
  if (!subtask) return;

  const user = await ctx.db.get(subtask.userId);
  const focusBlockLength = user?.focusBlockLength || 60;

  const blockCount = Math.ceil(timeEstimate / focusBlockLength);
  const remainder = timeEstimate % focusBlockLength;
  for (let i = 0; i < blockCount; i++) {
    const isLastBlock = i === blockCount - 1;
    const studyBlockLength = isLastBlock && remainder !== 0 ? remainder : focusBlockLength;
    await ctx.db.insert("studyBlocks", {
      subtaskId,
      userId: subtask.userId,
      title: subtask.title,
      startTime: undefined,
      studyBlockLength,
    });
  }
}

/** Scales each subtask estimate proportionally so they sum to manualTotal, rounded to the nearest 5 min (min 5 min per subtask), then rebuilds their study blocks. Returns the actual post-rounding sum. */
export async function normalizeSubtaskEstimates(
  ctx: MutationCtx,
  manualTotal: number,
  subtasks: Array<{ _id: Id<"subtasks">; timeEstimate?: number }>
): Promise<number> {
  const sum = subtasks.reduce((s, st) => s + (st.timeEstimate ?? 0), 0);
  if (sum === 0) return 0;
  let actualSum = 0;
  for (const subtask of subtasks) {
    const raw = ((subtask.timeEstimate ?? 0) / sum) * manualTotal;
    const rounded = Math.max(5, Math.round(raw / 5) * 5);
    await ctx.db.patch(subtask._id, { timeEstimate: rounded });
    await forceRebuildStudyBlocksForSubtask(ctx, subtask._id, rounded);
    actualSum += rounded;
  }
  return actualSum;
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

    await ctx.db.patch(args.taskId, {
      timeEstimate: args.timeEstimate,
      isManualEstimate: true,
    });

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    if (subtasks.length === 0) {
      await rebuildStudyBlocks(ctx, args.taskId, args.timeEstimate);
    } else {
      const allEstimated = subtasks.every((s) => s.timeEstimate !== undefined);
      if (allEstimated) {
        const actualSum = await normalizeSubtaskEstimates(ctx, args.timeEstimate, subtasks);
        // If rounding caused the total to exceed the target by more than 10%, let the
        // agent prune the least-important subtasks to bring it back within range.
        if (actualSum > args.timeEstimate * 1.1) {
          await ctx.scheduler.runAfter(0, internal.actions.pruneSubtasksToThreshold.pruneSubtasksToThreshold, {
            taskId: args.taskId,
            targetMinutes: args.timeEstimate,
          });
        }
      }
      // If not all estimated yet, normalization runs when the last estimate arrives.
    }
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

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    if (subtasks.length > 0) {
      // Restore the summed total from current (scaled) subtask estimates.
      // Subtask study blocks remain unchanged.
      const sum = subtasks.reduce((s, st) => s + (st.timeEstimate ?? 0), 0);
      await ctx.db.patch(args.taskId, {
        isManualEstimate: false,
        timeEstimate: sum > 0 ? sum : undefined,
      });
    } else {
      await ctx.db.patch(args.taskId, {
        isManualEstimate: false,
        timeEstimate: undefined,
      });
      // Delete task-level blocks so AI can regenerate fresh.
      const existingBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
        .collect();
      for (const block of existingBlocks) await ctx.db.delete(block._id);
    }
  },
});

export const applySubtaskPruning = internalMutation({
  args: {
    taskId: v.id("tasks"),
    subtaskIdsToRemove: v.array(v.id("subtasks")),
    targetMinutes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const subtaskId of args.subtaskIdsToRemove) {
      const blocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtaskId))
        .collect();
      for (const block of blocks) await ctx.db.delete(block._id);
      await ctx.db.delete(subtaskId);
    }

    const remaining = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    if (remaining.length > 0 && remaining.every((s) => s.timeEstimate !== undefined)) {
      await normalizeSubtaskEstimates(ctx, args.targetMinutes, remaining);
    }
    return null;
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
