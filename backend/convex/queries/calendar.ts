import { query } from "../_generated/server";
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
