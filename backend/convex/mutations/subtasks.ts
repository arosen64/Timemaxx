import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";

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

    return await ctx.db.insert("subtasks", {
      parentTaskId: args.parentTaskId,
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      color: args.color,
      order: args.order,
      suggestedCompletionAt: args.suggestedCompletionAt,
      createdAt: Date.now(),
    });
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
    });
  },
});

/**
 * Sets the time estimate on a subtask. Called by estimateSubtaskTime action.
 */
export const setSubtaskTimeEstimate = internalMutation({
  args: {
    subtaskId: v.id("subtasks"),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subtaskId, { timeEstimate: args.timeEstimate });
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
  },
});
