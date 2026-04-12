"use node";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GOOGLE_CALENDAR_API, hexToGcalColorId, resolveAccessToken } from "../lib/gcalHelpers";

/**
 * Upserts the authenticated user's future study blocks into Google Calendar.
 * - Blocks without a googleEventId are created as new GCal events.
 * - Blocks with an existing googleEventId are patched to reflect current state.
 * - Past blocks (startTime <= now) are skipped.
 * - Returns early if the user has no connected calendar.
 */
export const exportStudyBlocksToCalendar = action({
  args: {},
  handler: async (ctx): Promise<{ exported: number; patched: number; noCalendar?: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;
    if (!tokenSecret) throw new Error("Missing CALENDAR_TOKEN_SECRET");

    const connection = await ctx.runQuery(
      internal.queries.calendar.getCalendarConnectionForUser,
      { userId },
    );
    if (!connection) return { exported: 0, patched: 0, noCalendar: true };

    const accessToken = await resolveAccessToken(ctx, connection, userId, tokenSecret);

    const blocks = await ctx.runQuery(
      internal.queries.studyBlocks.getFutureStudyBlocksForExport,
      { userId },
    );

    if (!connection.timemaxxCalendarId) throw new Error("No Timemaxx calendar found — reconnect Google Calendar to create one");
    const calendarId = connection.timemaxxCalendarId;

    let exported = 0;
    let patched = 0;

    for (const block of blocks) {
      const endTime = new Date(
        new Date(block.startTime).getTime() + block.studyBlockLength * 60 * 1000,
      ).toISOString();

      const colorId = block.courseColor ? hexToGcalColorId(block.courseColor) : undefined;
      const eventBody: Record<string, unknown> = {
        summary: block.title,
        start: { dateTime: block.startTime },
        end: { dateTime: endTime },
        ...(colorId && { colorId }),
      };

      if (!block.googleEventId) {
        // Create a new GCal event
        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          },
        );
        if (!res.ok) continue;
        const data = await res.json() as { id?: string };
        if (!data.id) continue;
        try {
          await ctx.runMutation(internal.mutations.studyBlocks.setGoogleEventId, {
            studyBlockId: block._id,
            googleEventId: data.id,
          });
          exported++;
        } catch {
          // GCal event was created but DB write failed — skip count to avoid
          // reporting success; next export will re-create rather than orphan.
          continue;
        }
      } else {
        // Patch the existing GCal event
        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(block.googleEventId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          },
        );
        if (!res.ok) continue;
        await ctx.runMutation(internal.mutations.studyBlocks.clearNeedsExport, {
          studyBlockId: block._id,
        });
        patched++;
      }
    }

    return { exported, patched };
  },
});

/**
 * Deletes the user's timemaxx Google Calendar and removes the stored connection.
 * Called when the user revokes calendar access from the profile page.
 */
export const revokeCalendarAccess = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;
    if (!tokenSecret) throw new Error("Missing CALENDAR_TOKEN_SECRET");

    const connection = await ctx.runQuery(
      internal.queries.calendar.getCalendarConnectionForUser,
      { userId },
    );
    if (!connection) return;

    // Attempt to delete the timemaxx calendar from Google Calendar
    const timemaxxCalendarId = connection.timemaxxCalendarId;
    if (timemaxxCalendarId) {
      try {
        const accessToken = await resolveAccessToken(ctx, connection, userId, tokenSecret);
        await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(timemaxxCalendarId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      } catch {
        // Ignore errors — still revoke locally even if Google deletion fails
      }
    }

    await ctx.runMutation(internal.mutations.calendar.deleteCalendarTokenForUser, { userId });
  },
});

/**
 * Deletes Google Calendar events linked to deleted study blocks.
 * Called asynchronously via ctx.scheduler after a task is deleted.
 * Silently ignores failures — the task is already gone from Convex.
 */
export const deleteLinkedCalendarEvents = internalAction({
  args: {
    userId: v.id("users"),
    googleEventIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;
    if (!tokenSecret) return;

    const connection = await ctx.runQuery(
      internal.queries.calendar.getCalendarConnectionForUser,
      { userId: args.userId },
    );
    if (!connection) return;

    let accessToken: string;
    try {
      accessToken = await resolveAccessToken(ctx, connection, args.userId, tokenSecret);
    } catch {
      return;
    }

    if (!connection.timemaxxCalendarId) return; // no Timemaxx calendar means nothing to clean up
    const calendarId = connection.timemaxxCalendarId;

    for (const eventId of args.googleEventIds) {
      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!res.ok) {
        console.warn(`Failed to delete GCal event ${eventId}: HTTP ${res.status}`);
      }
    }
  },
});
