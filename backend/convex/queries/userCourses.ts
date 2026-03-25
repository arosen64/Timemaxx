import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns all courses for the authenticated user.
 */
export const getUserCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Returns all courses for the authenticated user filtered by term.
 */
export const getUserCoursesByTerm = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("userCourses")
      .withIndex("by_user_term", (q) => q.eq("userId", userId).eq("term", args.term))
      .collect();
  },
});
