import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, { googleId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});