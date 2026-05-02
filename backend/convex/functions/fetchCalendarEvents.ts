import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GOOGLE_CALENDAR_API, resolveAccessToken } from "../lib/gcalHelpers";

export type CalendarEntry = { id: string; summary: string };
export type TimedEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  calendarId: string;
};
export type AllDayEvent = {
  id: string;
  summary: string;
  date: string;
  calendarId: string;
};

/**
 * Fetches the authenticated user's Google Calendar list and events for a 7-day
 * window starting from startDate (ISO date string in the user's local timezone).
 *
 * Returns:
 * - calendarList: all calendars the user has access to (for the selector popup)
 * - timedEvents: events with start.dateTime for selected calendars only
 * - allDayEvents: events with only start.date for selected calendars only
 * - error: true when token decryption key is missing or token refresh fails
 */
export const fetchCalendarEvents = action({
  args: {
    startDate: v.string(),
    timezone: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    calendarList: CalendarEntry[];
    timedEvents: TimedEvent[];
    allDayEvents: AllDayEvent[];
    error: boolean;
  }> => {
    const empty = { calendarList: [], timedEvents: [], allDayEvents: [], error: false };

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tokenSecret = process.env.CALENDAR_TOKEN_SECRET;
    if (!tokenSecret) return { ...empty, error: true };

    const connection = await ctx.runQuery(internal.queries.calendar.getCalendarConnectionForUser, {
      userId,
    });
    if (!connection) return empty;

    let accessToken: string;
    let calendarList: CalendarEntry[];
    try {
      accessToken = await resolveAccessToken(ctx, connection, userId, tokenSecret);
      calendarList = (await fetchCalendarList(accessToken)).filter(
        (c) => c.id !== connection.timemaxxCalendarId
      );
    } catch {
      return { ...empty, error: true };
    }

    // No calendars selected — return list (for popup) but no events
    if (!connection.selectedCalendarIds || connection.selectedCalendarIds.length === 0) {
      return { calendarList, timedEvents: [], allDayEvents: [], error: false };
    }

    // Build 7-day window
    const start = new Date(args.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const timeMin = start.toISOString();
    const timeMax = end.toISOString();

    const timedEvents: TimedEvent[] = [];
    const allDayEvents: AllDayEvent[] = [];

    for (const calendarId of connection.selectedCalendarIds) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        timeZone: args.timezone,
      });

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) continue;

      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };

      for (const item of data.items ?? []) {
        const summary = item.summary ?? "(no title)";
        if (item.start?.dateTime && item.end?.dateTime) {
          timedEvents.push({
            id: item.id,
            summary,
            start: item.start.dateTime,
            end: item.end.dateTime,
            calendarId,
          });
        } else if (item.start?.date) {
          allDayEvents.push({ id: item.id, summary, date: item.start.date, calendarId });
        }
      }
    }

    return { calendarList, timedEvents, allDayEvents, error: false };
  },
});

async function fetchCalendarList(accessToken: string): Promise<CalendarEntry[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar list fetch failed: ${res.status}`);
  const data = (await res.json()) as { items?: Array<{ id: string; summary?: string }> };
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary ?? c.id }));
}
