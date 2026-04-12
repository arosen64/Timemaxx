import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { toDateStr } from "./scheduleSlots";

export type TimedEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  calendarId: string;
};

/**
 * Fetches calendar events for the full 21-day scheduling window.
 * Makes three weekly fetches in parallel (weeks 1, 2, and 3).
 * Returns an empty array if no calendar is connected.
 */
export async function fetch21DayCalendarEvents(
  ctx: ActionCtx,
  timezone: string,
): Promise<TimedEvent[]> {
  const today = new Date();
  const week2Start = new Date(today);
  week2Start.setDate(today.getDate() + 7);
  const week3Start = new Date(today);
  week3Start.setDate(today.getDate() + 14);

  try {
    const [r1, r2, r3] = await Promise.all([
      ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
        startDate: toDateStr(today, timezone),
        timezone,
      }),
      ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
        startDate: toDateStr(week2Start, timezone),
        timezone,
      }),
      ctx.runAction(api.actions.fetchCalendarEvents.fetchCalendarEvents, {
        startDate: toDateStr(week3Start, timezone),
        timezone,
      }),
    ]);
    return [...r1.timedEvents, ...r2.timedEvents, ...r3.timedEvents];
  } catch {
    // No calendar connected — caller will schedule against work hours only
    return [];
  }
}
