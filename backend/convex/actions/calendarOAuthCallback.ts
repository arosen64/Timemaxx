"use node";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { createCipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64 string containing iv + authTag + ciphertext.
 * Key is derived from a 64-char hex string (openssl rand -hex 32).
 */
function encryptToken(plaintext: string, hexSecret: string): string {
  const key = Buffer.from(hexSecret.padEnd(64, "0").slice(0, 64), "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Convex HTTP action that handles the Google Calendar OAuth callback.
 * Validates the state, exchanges the code for tokens, encrypts and stores them,
 * then redirects the user back to the frontend profile page.
 *
 * Registered at /api/calendar/callback in http.ts.
 */
export const calendarOAuthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const profileRedirect = `${frontendUrl}/profile`;

  if (error || !code || !state) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  // Validate state and identify the user — state was stored at initiation time
  // linked to the userId (see initiateGoogleCalendarOAuth.ts)
  const stateRecord = await ctx.runQuery(
    internal.queries.calendar.getCalendarOAuthState,
    { state },
  );

  if (!stateRecord || stateRecord.expiresAt < Date.now()) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !tokenSecret) {
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

  const data = await tokenResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data.access_token || !data.refresh_token) {
    return new Response(null, { status: 302, headers: { Location: profileRedirect } });
  }

  // Encrypt tokens and store them for the identified user
  await ctx.runMutation(internal.mutations.calendar.storeCalendarTokenForUser, {
    userId: stateRecord.userId,
    accessToken: encryptToken(data.access_token, tokenSecret),
    refreshToken: encryptToken(data.refresh_token, tokenSecret),
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  // Clean up the consumed state record
  await ctx.runMutation(internal.mutations.calendar.deleteCalendarOAuthState, {
    id: stateRecord._id,
  });

  return new Response(null, { status: 302, headers: { Location: profileRedirect } });
});
