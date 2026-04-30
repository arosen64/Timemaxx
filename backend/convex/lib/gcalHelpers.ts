import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { decryptToken, encryptToken } from "./calendarCrypto";

export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// GCal preset colors with their colorId and approximate RGB values
const GCAL_COLORS: Array<{ id: string; r: number; g: number; b: number }> = [
  { id: "1", r: 121, g: 134, b: 203 }, // Lavender
  { id: "2", r: 51, g: 182, b: 121 }, // Sage
  { id: "3", r: 142, g: 36, b: 170 }, // Grape
  { id: "4", r: 230, g: 124, b: 115 }, // Flamingo
  { id: "5", r: 246, g: 191, b: 38 }, // Banana
  { id: "6", r: 244, g: 81, b: 30 }, // Tangerine
  { id: "7", r: 3, g: 155, b: 229 }, // Peacock
  { id: "8", r: 97, g: 97, b: 97 }, // Graphite
  { id: "9", r: 63, g: 81, b: 181 }, // Blueberry
  { id: "10", r: 11, g: 128, b: 67 }, // Basil
  { id: "11", r: 213, g: 0, b: 0 }, // Tomato
];

export function hexToGcalColorId(hex: string): string | undefined {
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
    if (dist < bestDist) {
      bestDist = dist;
      bestId = c.id;
    }
  }
  return bestId;
}

/**
 * Returns a valid (plaintext) access token, refreshing via refresh token if expired.
 * Writes the new encrypted token back via updateCalendarToken internal mutation.
 * Throws on refresh failure so the caller can return an error flag.
 */
export async function resolveAccessToken(
  ctx: ActionCtx,
  connection: {
    userId: Id<"users">;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  },
  userId: Id<"users">,
  tokenSecret: string
): Promise<string> {
  // Refresh 60 seconds early to avoid using a token that expires mid-request
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

  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number };
  if (!tokenData.access_token) throw new Error("No access_token in refresh response");

  const newExpiry = Date.now() + tokenData.expires_in * 1000;
  await ctx.runMutation(internal.mutations.calendar.updateCalendarToken, {
    userId,
    accessToken: await encryptToken(tokenData.access_token, tokenSecret),
    expiresAt: newExpiry,
  });

  return tokenData.access_token;
}
