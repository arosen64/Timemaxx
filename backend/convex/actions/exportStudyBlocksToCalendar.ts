"use node";
import { action, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { decryptToken, encryptToken } from "../lib/calendarCrypto";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

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

      const eventBody = {
        summary: block.title,
        start: { dateTime: block.startTime },
        end: { dateTime: endTime },
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
        const data = await res.json() as { id: string };
        await ctx.runMutation(internal.mutations.studyBlocks.setGoogleEventId, {
          studyBlockId: block._id,
          googleEventId: data.id,
        });
        exported++;
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
        patched++;
      }
    }

    return { exported, patched };
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
