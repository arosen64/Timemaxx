import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const STATE_TTL_MS = 60 * 15 * 1000; // 15 minutes — matches @convex-dev/auth OAuth state TTL

/**
 * Generates a short-lived OAuth state token, stores it linked to the user,
 * and returns the full Google authorization URL for the calendar.readonly scope.
 */
export const initiateGoogleCalendarOAuth = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const clientId = process.env.AUTH_GOOGLE_ID;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("Missing AUTH_GOOGLE_ID or GOOGLE_CALENDAR_REDIRECT_URI env var");
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
