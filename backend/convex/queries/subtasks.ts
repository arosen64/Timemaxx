import { internalQuery, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Internal query for fetching a subtask by ID without auth (used by actions)
export const getSubtaskInternal = internalQuery({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.subtaskId);
  },
});

// Get a single subtask by ID — returns null if not found or not owned by the caller
export const getSubtask = query({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask || subtask.userId !== userId) return null;

    return subtask;
  },
});

// Get all subtasks for the current user (bulk fetch for dashboard)
export const getAllSubtasksForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return subtasks.sort((a, b) => a.order - b.order);
  },
});

// Internal version for use in actions (no auth check)
export const getSubtasksForTaskInternal = internalQuery({
  args: { parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) =>
        q.eq("parentTaskId", args.parentTaskId)
      )
      .collect();
    return subtasks.sort((a, b) => a.order - b.order);
  },
});

// Get all subtasks for a parent task, ordered by `order` ascending
export const getSubtasksForTask = query({
  args: { parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) =>
        q.eq("parentTaskId", args.parentTaskId)
      )
      .collect();

    return subtasks
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.order - b.order);
  },
});
