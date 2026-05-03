import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = ["https://www.googleapis.com/auth/calendar"].join(" "); // Full calendar access is legitimately needed to create/delete Timemaxx calendar
const STATE_TTL_MS = 60 * 15 * 1000; // 15 minutes — matches @convex-dev/auth OAuth state TTL

/**
 * Generates a short-lived OAuth state token, stores it linked to the user,
 * and returns the full Google authorization URL for the calendar.events scope.
 */
export const initiateGoogleCalendarOAuth = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const clientId = process.env.AUTH_GOOGLE_ID;
    // CONVEX_SITE_URL is set automatically by Convex on every deployment —
    // same approach used by @convex-dev/auth for its callback URIs.
    const redirectUri = `${process.env.CONVEX_SITE_URL}/api/calendar/callback`;

    if (!clientId) {
      throw new Error("Missing AUTH_GOOGLE_ID env var");
    }

    const state = crypto.randomUUID();
    await ctx.runMutation(internal.mutations.calendar.createCalendarOAuthState, {
      userId,
      state,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: CALENDAR_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  },
});
