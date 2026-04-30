import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptToken } from "./lib/calendarCrypto";

/**
 * Convex HTTP action that handles the Google Calendar OAuth callback.
 * Validates the state, exchanges the code for tokens, encrypts and stores them,
 * then redirects the user back to the frontend profile page.
 *
 * Registered at /api/calendar/callback in http.ts.
 * Lives at the convex/ root (not in /actions) because httpAction cannot use "use node".
 */
export const calendarOAuthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // SITE_URL is already set by the existing auth setup — strip trailing slash to avoid double-slash.
  // Redirect to app root (not deep links like /profile) to avoid GitHub Pages 404s on direct SPA routes.
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const profileRedirect = `${siteUrl}/?oauth=calendar&returnTo=${encodeURIComponent("/profile")}`;

  if (error || !code || !state) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  // Validate state and identify the user — state was stored at initiation time
  // linked to the userId (see initiateGoogleCalendarOAuth.ts)
  const stateRecord = await ctx.runQuery(internal.queries.calendar.getCalendarOAuthState, {
    state,
  });

  if (!stateRecord || stateRecord.expiresAt < Date.now()) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const redirectUri = `${process.env.CONVEX_SITE_URL}/api/calendar/callback`;
  const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;

  if (!clientId || !clientSecret || !tokenSecret) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  const data = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  // Find or create the dedicated "timemaxx" calendar before encrypting the token
  const timemaxxCalendarId = await findOrCreateTimemaxxCalendar(data.access_token);

  // Encrypt tokens and store them for the identified user
  await ctx.runMutation(internal.mutations.calendar.storeCalendarTokenForUser, {
    userId: stateRecord.userId,
    accessToken: await encryptToken(data.access_token, tokenSecret),
    refreshToken: await encryptToken(data.refresh_token, tokenSecret),
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    ...(timemaxxCalendarId && { timemaxxCalendarId }),
  });

  // Flag all future blocks for re-export so they get recreated in the new calendar
  await ctx.runMutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, {
    userId: stateRecord.userId,
  });

  // Clean up the consumed state record
  await ctx.runMutation(internal.mutations.calendar.deleteCalendarOAuthState, {
    id: stateRecord._id,
  });

  // If the Timemaxx calendar couldn't be created, tell the frontend so it can
  // prompt the user to reconnect via the "Update Calendar Permissions" button.
  const redirectTarget = timemaxxCalendarId ? "/profile" : "/profile?calendarSetupFailed=1";
  const finalRedirect = `${siteUrl}/?oauth=calendar&returnTo=${encodeURIComponent(redirectTarget)}`;

  return new Response(null, { status: 302, headers: { Location: finalRedirect } });
});

const GCAL_API = "https://www.googleapis.com/calendar/v3";
const TIMEMAXX_CALENDAR_NAME = "Timemaxx";

/**
 * Looks for an existing "timemaxx" calendar in the user's calendar list.
 * Creates one if none is found. Returns the calendar ID, or null on failure.
 */
async function findOrCreateTimemaxxCalendar(accessToken: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Check if "Timemaxx" calendar already exists, paginating through all results
  let pageToken: string | undefined;
  do {
    const url = `${GCAL_API}/users/me/calendarList${pageToken ? `?pageToken=${pageToken}` : ""}`;
    const listRes = await fetch(url, { headers });
    if (!listRes.ok) break;
    const listData = (await listRes.json()) as {
      items?: Array<{ id: string; summary: string }>;
      nextPageToken?: string;
    };
    const existing = listData.items?.find((c) => c.summary === TIMEMAXX_CALENDAR_NAME);
    if (existing) return existing.id;
    pageToken = listData.nextPageToken;
  } while (pageToken);

  // Create a new "Timemaxx" calendar
  const createRes = await fetch(`${GCAL_API}/calendars`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: TIMEMAXX_CALENDAR_NAME }),
  });
  if (!createRes.ok) return null;

  const created = (await createRes.json()) as { id?: string };
  return created.id ?? null;
}
