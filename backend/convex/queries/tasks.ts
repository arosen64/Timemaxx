import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAllTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const email = identity.email;
    const subject = identity.subject;

    const user =
      (email
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
        : null) ??
      (subject
        ? await ctx.db
            .query("users")
            .withIndex("by_googleId", (q) => q.eq("googleId", subject))
            .unique()
        : null);

    if (!user) return [];

    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

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