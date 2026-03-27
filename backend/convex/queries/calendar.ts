import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns whether the authenticated user has a connected Google Calendar token.
 */
export const getCalendarConnectionStatus = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db
      .query("calendarTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return { connected: token !== null };
  },
});

/**
 * Looks up a calendar OAuth state record by its state string — called from the HTTP callback.
 */
export const getCalendarOAuthState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
  },
});
