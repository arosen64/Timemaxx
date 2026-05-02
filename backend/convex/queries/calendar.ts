import { internalQuery, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns schedule data for the authenticated user:
 * - workHoursGrid from the users table (preferred/blocked slots from onboarding)
 * - calendarConnected: whether a calendarConnections record exists
 * - selectedCalendarIds: which calendars the user has chosen to display
 *
 * The frontend combines this with event data from fetchCalendarEvents to render
 * the Schedule tab grid.
 */
export const getScheduleData = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const connection = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return {
      workHoursGrid: user?.workHoursGrid ?? null,
      calendarConnected: connection !== null,
      selectedCalendarIds: connection?.selectedCalendarIds ?? null,
    };
  },
});

/**
 * Returns whether the authenticated user has a connected Google Calendar token.
 */
export const getCalendarConnectionStatus = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const scopes = token?.scope?.split(" ") ?? [];
    const hasEventsScope =
      scopes.includes("https://www.googleapis.com/auth/calendar.events") ||
      scopes.includes("https://www.googleapis.com/auth/calendar");

    return {
      connected: token !== null,
      hasEventsScope,
    };
  },
});

/**
 * Returns the full calendarConnections record for a given userId — called from
 * fetchCalendarEvents action which needs the encrypted tokens and selectedCalendarIds.
 */
export const getCalendarConnectionForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

/**
 * Returns a page of calendarConnections records — used by the plaintext-token invalidation action.
 */
export const getCalendarConnectionsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db.query("calendarConnections").paginate(args.paginationOpts);
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
