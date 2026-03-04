import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: v.string(),
    timeEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    taskType: v.optional(v.string()),
    timeEstimate: v.optional(v.number()),
  },
  handler: async (ctx, { taskId, ...updates }) => {
    await ctx.db.patch(taskId, updates);
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    await ctx.db.delete(taskId);
  },
});