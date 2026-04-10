"use node";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { decryptToken, encryptToken } from "../lib/calendarCrypto";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// GCal preset colors with their colorId and approximate RGB values
const GCAL_COLORS: Array<{ id: string; r: number; g: number; b: number }> = [
  { id: "1",  r: 121, g: 134, b: 203 }, // Lavender
  { id: "2",  r:  51, g: 182, b: 121 }, // Sage
  { id: "3",  r: 142, g:  36, b: 170 }, // Grape
  { id: "4",  r: 230, g: 124, b: 115 }, // Flamingo
  { id: "5",  r: 246, g: 191, b:  38 }, // Banana
  { id: "6",  r: 244, g:  81, b:  30 }, // Tangerine
  { id: "7",  r:   3, g: 155, b: 229 }, // Peacock
  { id: "8",  r:  97, g:  97, b:  97 }, // Graphite
  { id: "9",  r:  63, g:  81, b: 181 }, // Blueberry
  { id: "10", r:  11, g: 128, b:  67 }, // Basil
  { id: "11", r: 213, g:   0, b:   0 }, // Tomato
];

function hexToGcalColorId(hex: string): string | undefined {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return undefined;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return undefined;

  let bestId = GCAL_COLORS[0].id;
  let bestDist = Infinity;
  for (const c of GCAL_COLORS) {
    const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (dist < bestDist) { bestDist = dist; bestId = c.id; }
  }
  return bestId;
}

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

    const calendarId = connection.selectedCalendarIds?.[0] ?? "primary";

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

    const calendarId = connection.selectedCalendarIds?.[0] ?? "primary";

    for (const eventId of args.googleEventIds) {
      await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    }
  },
});

async function resolveAccessToken(
  ctx: ActionCtx,
  connection: {
    userId: Id<"users">;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  },
  userId: Id<"users">,
  tokenSecret: string,
): Promise<string> {
  if (Date.now() + 60_000 < connection.expiresAt) {
    return await decryptToken(connection.accessToken, tokenSecret);
  }

  const refreshToken = await decryptToken(connection.refreshToken, tokenSecret);
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error("Token refresh failed");

  const tokenData = await tokenRes.json() as { access_token: string; expires_in: number };
  if (!tokenData.access_token) throw new Error("No access_token in refresh response");

  const newExpiry = Date.now() + tokenData.expires_in * 1000;
  await ctx.runMutation(internal.mutations.calendar.updateCalendarToken, {
    userId,
    accessToken: await encryptToken(tokenData.access_token, tokenSecret),
    expiresAt: newExpiry,
  });

  return tokenData.access_token;
}
