import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** For scope Yes replay: load the original user question after confirmation. */
export const getUserMessageForScopeReplayInternal = internalQuery({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    messageId: v.id("chatMessages"),
  },
  returns: v.union(v.null(), v.object({ content: v.string() })),
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.messageId);
    if (
      !m ||
      m.userId !== args.userId ||
      m.sessionId !== args.sessionId ||
      m.role !== "user"
    ) {
      return null;
    }
    return { content: m.content };
  },
});

export const getChatHistory = query({
  args: { sessionId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit ?? 50);
  },
});
