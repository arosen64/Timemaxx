import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getChatHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("asc")
      .take(args.limit ?? 50);
  },
});
