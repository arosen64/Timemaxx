import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Upserts an encrypted Google Calendar OAuth token record for the authenticated user.
 */
export const storeCalendarToken = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await upsertCalendarToken(ctx, { userId, ...args });
  },
});

/**
 * Upserts a calendar token for a specific user — called from the HTTP callback action.
 */
export const storeCalendarTokenForUser = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await upsertCalendarToken(ctx, args);
  },
});

async function upsertCalendarToken(
  ctx: any,
  args: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }
) {
  const existing = await ctx.db
    .query("calendarConnections")
    .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    });
  } else {
    await ctx.db.insert("calendarConnections", {
      userId: args.userId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
    });
  }
}

/**
 * Updates only the access token and expiry on an existing calendarConnections record.
 * Called by the fetchCalendarEvents action after a token refresh.
 * Leaves refreshToken and selectedCalendarIds unchanged.
 */
export const updateCalendarToken = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        expiresAt: args.expiresAt,
      });
    }
  },
});

/**
 * Writes selectedCalendarIds to the user's calendarConnections record.
 * Called when the user toggles calendars in the Schedule tab popup.
 */
export const saveSelectedCalendars = mutation({
  args: {
    selectedCalendarIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .unique();

    if (!existing) throw new Error("No calendar connected");
    await ctx.db.patch(existing._id, {
      selectedCalendarIds: args.selectedCalendarIds,
    });
  },
});

/**
 * Deletes the Google Calendar OAuth token for the authenticated user.
 */
export const deleteCalendarToken = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Stores a short-lived OAuth state token linked to the user — called during OAuth initiation.
 */
export const createCalendarOAuthState = internalMutation({
  args: {
    userId: v.id("users"),
    state: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("calendarOAuthStates", args);
  },
});

/**
 * Deletes a consumed OAuth state token after the callback completes.
 */
export const deleteCalendarOAuthState = internalMutation({
  args: { id: v.id("calendarOAuthStates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
