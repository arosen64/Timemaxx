"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

type WorkHoursRow = { day: string; blocked: number[] };
type TimedEvent = { id: string; summary: string; start: string; end: string; calendarId: string };
export type FreeBlock = { startISO: string; endISO: string };

function getLocalDateStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function getLocalTimeParts(dt: Date, timezone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hour: hour === 24 ? 0 : hour, minute };
}

function getLocalDayOfWeek(dt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(dt);
}

/**
 * Computes free time blocks across the 21-day window by diffing calendar events
 * against the user's workHoursGrid.
 *
 * Blocked (never-work) slots and event-occupied slots are excluded.
 * All-day events are ignored.
 */
export function computeFreeBlocks(
  timedEvents: TimedEvent[],
  workHoursGrid: WorkHoursRow[],
  startISO: string,
  timezone: string
): FreeBlock[] {
  const result: FreeBlock[] = [];

  // Build a base date from startISO
  const [year, month, day] = startISO.split("-").map(Number);
  const baseDate = new Date(Date.UTC(year, month - 1, day));

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const currentDate = new Date(baseDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + dayOffset);

    // Get the local date string for this day
    const dateStr = getLocalDateStr(currentDate, timezone);
    const localDayName = getLocalDayOfWeek(currentDate, timezone);

    const row = workHoursGrid.find((r) => r.day === localDayName);

    // Filter events for this day (by local date in the given timezone)
    const dayEvents = timedEvents.filter((e) => {
      const localDate = getLocalDateStr(new Date(e.start), timezone);
      return localDate === dateStr;
    });

    // Build event occupancy by slot
    const eventSlots = new Set<number>();
    for (const event of dayEvents) {
      const startParts = getLocalTimeParts(new Date(event.start), timezone);
      const endParts = getLocalTimeParts(new Date(event.end), timezone);
      const startMins = startParts.hour * 60 + startParts.minute;
      const endMins = endParts.hour * 60 + endParts.minute;
      const startSlot = Math.floor(startMins / 30);
      // Occupy all slots that the event touches (endSlot exclusive unless exactly on boundary)
      const endSlot = endMins % 30 === 0 ? endMins / 30 : Math.ceil(endMins / 30);
      for (let s = startSlot; s < Math.min(endSlot, 48); s++) {
        eventSlots.add(s);
      }
    }

    // Walk slots and build free blocks
    let currentBlock: { startMins: number; endMins: number } | null = null;

    for (let slot = 0; slot < 48; slot++) {
      if (row?.blocked.includes(slot) ?? false) {
        if (currentBlock) {
          result.push(toFreeBlock(currentBlock, dateStr, timezone));
          currentBlock = null;
        }
        continue;
      }

      if (eventSlots.has(slot)) {
        if (currentBlock) {
          result.push(toFreeBlock(currentBlock, dateStr, timezone));
          currentBlock = null;
        }
        continue;
      }

      const slotStartMins = slot * 30;
      const slotEndMins = slotStartMins + 30;

      if (currentBlock === null) {
        currentBlock = { startMins: slotStartMins, endMins: slotEndMins };
      } else {
        currentBlock.endMins = slotEndMins;
      }
    }

    if (currentBlock) {
      result.push(toFreeBlock(currentBlock, dateStr, timezone));
    }
  }

  return result;
}

function toFreeBlock(
  block: { startMins: number; endMins: number },
  dateStr: string,
  timezone: string
): FreeBlock {
  // Convert local time (dateStr + minutes) to ISO string
  const [year, month, day] = dateStr.split("-").map(Number);
  const startHour = Math.floor(block.startMins / 60);
  const startMin = block.startMins % 60;
  const endHour = Math.floor(block.endMins / 60);
  const endMin = block.endMins % 60;

  // Build ISO strings using the timezone offset
  const startISO = localToUTCISO(year, month, day, startHour, startMin, timezone);
  const endISO = localToUTCISO(year, month, day, endHour, endMin, timezone);

  return { startISO, endISO };
}

/**
 * Converts a local time (year/month/day/hour/min in the given timezone) to a UTC ISO string.
 * Uses the Intl trick: format a UTC date as local time, then adjust.
 */
function localToUTCISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): string {
  // Construct an approximate UTC date string and use it to find the offset
  // Method: use toLocaleString to get the UTC offset
  const approxISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  const approxUTC = new Date(approxISO);

  // Get what this UTC time looks like in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(approxUTC);

  const localHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const localMinute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  // Compute the offset in minutes; clamp to ±12h to avoid off-by-24h for UTC- timezones
  const targetTotalMins = hour * 60 + minute;
  const actualLocalMins = (localHour === 24 ? 0 : localHour) * 60 + localMinute;
  let offsetMins = targetTotalMins - actualLocalMins;
  if (offsetMins < -12 * 60) offsetMins += 24 * 60;
  if (offsetMins > 12 * 60) offsetMins -= 24 * 60;

  // Adjust the UTC time by the offset
  const adjustedUTC = new Date(approxUTC.getTime() + offsetMins * 60 * 1000);
  return adjustedUTC.toISOString();
}

export const getCalendarAvailability = action({
  args: {
    timedEvents: v.array(
      v.object({
        id: v.string(),
        summary: v.string(),
        start: v.string(),
        end: v.string(),
        calendarId: v.string(),
      })
    ),
    workHoursGrid: v.array(
      v.object({
        day: v.string(),
        blocked: v.array(v.number()),
      })
    ),
    startISO: v.string(),
    timezone: v.string(),
  },
  handler: async (_ctx, args): Promise<FreeBlock[]> => {
    try {
      return computeFreeBlocks(args.timedEvents, args.workHoursGrid, args.startISO, args.timezone);
    } catch {
      // 2.4: On error, fall back to work-hour slots (no throw)
      return computeFreeBlocks([], args.workHoursGrid, args.startISO, args.timezone);
    }
  },
});
