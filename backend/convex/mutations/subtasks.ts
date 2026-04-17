import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";
import { internal } from "../_generated/api";
import { rebuildStudyBlocks } from "./timeEstimate";
import { Id } from "../_generated/dataModel";

const reasoningTraceArgs = v.object({
  classes: v.string(),
  tasks: v.string(),
  chats: v.string(),
  profile: v.string(),
});

// Batch variant: validates all subtasks before any inserts to avoid partial writes on failure.
export const createSubtasksBatch = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    subtasks: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        taskType: taskTypeValidator,
        color: v.string(),
        order: v.number(),
        suggestedCompletionAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const parent = await ctx.db.get(args.parentTaskId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent task not found");
    }

    for (const s of args.subtasks) {
      if (s.title.trim().length === 0) throw new Error("Title cannot be empty");
      if (s.description.trim().length === 0) throw new Error("Description cannot be empty");
    }

    const now = Date.now();
    const subtaskIds: Id<"subtasks">[] = [];

    for (const s of args.subtasks) {
      const subtaskId = await ctx.db.insert("subtasks", {
        parentTaskId: args.parentTaskId,
        userId,
        title: s.title,
        description: s.description,
        taskType: s.taskType,
        color: s.color,
        order: s.order,
        suggestedCompletionAt: s.suggestedCompletionAt,
        courseId: parent.courseId,
        classTag: parent.classTag,
        dueDate: parent.dueDate,
        createdAt: now,
      });
      subtaskIds.push(subtaskId);
    }

    await ctx.db.patch(args.parentTaskId, { reasoning: undefined });

    const isTest =
      typeof process !== "undefined" && process.env.VITEST === "true";
    if (!isTest) {
      for (const subtaskId of subtaskIds) {
        await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
          subtaskId,
        });
      }
    }

    return subtaskIds;
  },
});

/**
 * Creates a new subtask linked to a parent task.
 * Validates that the parentTaskId references a row in the `tasks` table
 * (not another subtask — infinite nesting is not allowed).
 */
export const createSubtask = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    color: v.string(),
    order: v.number(),
    suggestedCompletionAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const parent = await ctx.db.get(args.parentTaskId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent task not found");
    }

    if (args.title.trim().length === 0) throw new Error("Title cannot be empty");
    if (args.description.trim().length === 0) throw new Error("Description cannot be empty");

    const subtaskId = await ctx.db.insert("subtasks", {
      parentTaskId: args.parentTaskId,
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      color: args.color,
      order: args.order,
      suggestedCompletionAt: args.suggestedCompletionAt,
      // Inherit course, class tag, and due date from parent
      courseId: parent.courseId,
      classTag: parent.classTag,
      dueDate: parent.dueDate,
      createdAt: Date.now(),
    });

    // Parent time is rolled up from subtasks; drop any prior whole-task AI reasoning
    // so we never show stale explanations alongside a summed estimate.
    await ctx.db.patch(args.parentTaskId, { reasoning: undefined });

    // Kick off time estimation on the backend immediately after creation.
    // This runs regardless of frontend lifecycle (no component unmount risk).
    // In convex-test (Node.js), process.env.VITEST is set; in production Convex
    // (V8 isolate), `process` is undefined. Skip scheduling in tests to avoid
    // a convex-test limitation where setTimeout callbacks fire after the test's
    // global has been replaced, causing "Write outside of transaction" errors.
    const isTest =
      typeof process !== "undefined" && process.env.VITEST === "true";
    if (!isTest) {
      await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
        subtaskId,
      });
    }

    return subtaskId;
  },
});

/**
 * Updates editable fields on an existing subtask.
 */
export const updateSubtask = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    suggestedCompletionAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    if (args.title.trim().length === 0) throw new Error("Title cannot be empty");
    if (args.description.trim().length === 0) throw new Error("Description cannot be empty");

    await ctx.db.patch(args.subtaskId, {
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      suggestedCompletionAt: args.suggestedCompletionAt,
      timeEstimate: undefined,
      reasoning: undefined,
    });

    // Re-schedule estimation since content changed.
    const isTest =
      typeof process !== "undefined" && process.env.VITEST === "true";
    if (!isTest) {
      await ctx.scheduler.runAfter(0, internal.ai.estimateTaskTime.estimateTaskTime, {
        subtaskId: args.subtaskId,
      });
    }
  },
});

/**
 * Sets the time estimate on a subtask. Called by estimateSubtaskTime action.
 */
export const setSubtaskTimeEstimate = internalMutation({
  args: {
    subtaskId: v.id("subtasks"),
    timeEstimate: v.number(),
    reasoning: reasoningTraceArgs,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subtaskId, {
      timeEstimate: args.timeEstimate,
      reasoning: args.reasoning,
    });

    // Roll up: sum all sibling estimates and patch parent task
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) return;

    const siblings = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", subtask.parentTaskId))
      .collect();

    const total = siblings.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0);
    await ctx.db.patch(subtask.parentTaskId, { timeEstimate: total });

    // Only rebuild study blocks once all subtasks have been estimated.
    // Rebuilding on every partial rollup would create blocks sized to an
    // incomplete sum; waiting for the final tally ensures block count and
    // lengths match the true total.
    const allEstimated = siblings.every((s) => s.timeEstimate !== undefined);
    if (allEstimated && total > 0) {
      await rebuildStudyBlocks(ctx, subtask.parentTaskId, total);
    }
  },
});

/**
 * Deletes a subtask and all its associated study blocks.
 */
export const deleteSubtask = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) throw new Error("Subtask not found");

    const studyBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_subtaskId", (q) => q.eq("subtaskId", args.subtaskId))
      .collect();

    for (const block of studyBlocks) {
      await ctx.db.delete(block._id);
    }

    await ctx.db.delete(args.subtaskId);

    // Recalculate parent task estimate from remaining siblings.
    const remaining = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", subtask.parentTaskId))
      .collect();

    const newTotal = remaining.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0);
    await ctx.db.patch(subtask.parentTaskId, {
      timeEstimate: newTotal > 0 ? newTotal : undefined,
    });
  },
});
