import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptToken } from "../lib/calendarCrypto";

/**
 * One-time migration action for issue #632.
 *
 * Scans all calendarConnections records and deletes any where either
 * accessToken or refreshToken cannot be decrypted with CALENDAR_TOKEN_SECRET,
 * indicating they were stored as plaintext via the now-removed storeCalendarToken
 * public mutation.
 *
 * Records written by calendarOAuthCallback (the only production write path) were
 * already encrypted and will be left untouched.
 *
 * Run once from the Convex dashboard after deploying the #632 fix:
 *   internal.actions.invalidatePlaintextCalendarTokens.run
 */
export const run = internalAction({
  handler: async (ctx) => {
    const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;
    if (!tokenSecret) throw new Error("CALENDAR_TOKEN_SECRET is not set");

    let cursor: string | null = null;
    let isDone = false;
    let scanned = 0;
    let invalidated = 0;

    while (!isDone) {
      const page = await ctx.runQuery(internal.queries.calendar.getCalendarConnectionsPage, {
        paginationOpts: { cursor, numItems: 100 },
      });

      for (const conn of page.page) {
        scanned++;
        let isPlaintext = false;
        try {
          await decryptToken(conn.accessToken, tokenSecret);
        } catch {
          isPlaintext = true;
        }
        if (!isPlaintext) {
          try {
            await decryptToken(conn.refreshToken, tokenSecret);
          } catch {
            isPlaintext = true;
          }
        }
        if (isPlaintext) {
          await ctx.runMutation(internal.mutations.calendar.deleteCalendarTokenForUser, {
            userId: conn.userId,
          });
          invalidated++;
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return { scanned, invalidated };
  },
});
