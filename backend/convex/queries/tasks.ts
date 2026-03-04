import { query } from "../_generated/server";
import { v } from "convex/values";

export const getTasksByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getTasksByUserSorted = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId)
      )
      .order("desc")
      .collect();
  },
});