import { describe, expect, test, vi } from "vitest";
import {
  roundUpTo15Min,
  isSlotValid,
  isInAvailableSlot,
  buildSlotContext,
  enumerateSlots,
  extendSlotPool,
  filterPoolForBlock,
  selectSlotWithAI,
  SCHEDULE_HORIZON_MS,
  type OccupiedInterval,
  type WorkHoursRow,
  type PoolSlot,
} from "../lib/scheduleSlots";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONE = "America/New_York";

// Monday 2025-01-06 09:00 UTC = 04:00 EST — slot 8 (4:00-4:30)
// Monday 2025-01-06 14:00 UTC = 09:00 EST — slot 18 (9:00-9:30)
const MONDAY_9AM_UTC = new Date("2025-01-06T14:00:00.000Z").getTime();

const WORK_HOURS: WorkHoursRow[] = [
  {
    day: "Monday",
    available: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], // 9am–4pm slots
    blocked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], // midnight–9am
  },
];

// ---------------------------------------------------------------------------
// roundUpTo15Min
// ---------------------------------------------------------------------------

describe("roundUpTo15Min", () => {
  test("already on 15-min boundary is unchanged", () => {
    const ms = new Date("2025-01-06T14:00:00.000Z").getTime();
    expect(roundUpTo15Min(ms)).toBe(ms);
  });

  test("rounds up to next 15-min boundary", () => {
    const ms = new Date("2025-01-06T14:01:00.000Z").getTime();
    const expected = new Date("2025-01-06T14:15:00.000Z").getTime();
    expect(roundUpTo15Min(ms)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// isSlotValid
// ---------------------------------------------------------------------------

describe("isSlotValid", () => {
  const durationMs = 60 * 60 * 1000; // 60 min

  test("returns true for a clean slot with no occupied intervals", () => {
    expect(isSlotValid(MONDAY_9AM_UTC, durationMs, WORK_HOURS, [], TIMEZONE)).toBe(true);
  });

  test("returns false when slot overlaps an occupied interval", () => {
    const occupied: OccupiedInterval[] = [
      {
        startMs: MONDAY_9AM_UTC + 30 * 60 * 1000,
        endMs: MONDAY_9AM_UTC + 90 * 60 * 1000,
        title: "Meeting",
      },
    ];
    expect(isSlotValid(MONDAY_9AM_UTC, durationMs, WORK_HOURS, occupied, TIMEZONE)).toBe(false);
  });

  test("returns false when slot spans a blocked 30-min slot", () => {
    // 4:00 EST (UTC 09:00) = slot 8, which is in the blocked array
    const earlySlot = new Date("2025-01-06T09:00:00.000Z").getTime(); // 4:00 AM EST
    expect(isSlotValid(earlySlot, durationMs, WORK_HOURS, [], TIMEZONE)).toBe(false);
  });

  test("returns true when no workHoursGrid row exists for the day", () => {
    const sundayMs = new Date("2025-01-05T14:00:00.000Z").getTime(); // Sunday
    expect(isSlotValid(sundayMs, durationMs, WORK_HOURS, [], TIMEZONE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isInAvailableSlot
// ---------------------------------------------------------------------------

describe("isInAvailableSlot", () => {
  const durationMs = 60 * 60 * 1000;

  test("returns true when all spanned slots are in available", () => {
    expect(isInAvailableSlot(MONDAY_9AM_UTC, durationMs, WORK_HOURS, TIMEZONE)).toBe(true);
  });

  test("returns false when spanned slots are not in available", () => {
    const earlySlot = new Date("2025-01-06T09:00:00.000Z").getTime(); // 4 AM EST
    expect(isInAvailableSlot(earlySlot, durationMs, WORK_HOURS, TIMEZONE)).toBe(false);
  });

  test("returns false when no workHoursGrid row for the day", () => {
    const sundayMs = new Date("2025-01-05T14:00:00.000Z").getTime();
    expect(isInAvailableSlot(sundayMs, durationMs, WORK_HOURS, TIMEZONE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSlotContext
// ---------------------------------------------------------------------------

describe("buildSlotContext", () => {
  test("finds nearest previous and next events within 12 hours", () => {
    const startMs = MONDAY_9AM_UTC;
    const endMs = startMs + 60 * 60 * 1000;
    const occupied: OccupiedInterval[] = [
      { startMs: startMs - 30 * 60 * 1000, endMs: startMs - 10 * 60 * 1000, title: "Before" },
      { startMs: endMs + 15 * 60 * 1000, endMs: endMs + 45 * 60 * 1000, title: "After" },
    ];
    const ctx = buildSlotContext(startMs, endMs, occupied);
    expect(ctx.previousEventTitle).toBe("Before");
    expect(ctx.minutesSincePreviousEvent).toBe(10);
    expect(ctx.nextEventTitle).toBe("After");
    expect(ctx.minutesUntilNextEvent).toBe(15);
  });

  test("returns nulls when no events within 12 hours", () => {
    const ctx = buildSlotContext(MONDAY_9AM_UTC, MONDAY_9AM_UTC + 3600000, []);
    expect(ctx.previousEventTitle).toBeNull();
    expect(ctx.nextEventTitle).toBeNull();
    expect(ctx.minutesSincePreviousEvent).toBeNull();
    expect(ctx.minutesUntilNextEvent).toBeNull();
  });

  test("ignores events more than 12 hours away", () => {
    const startMs = MONDAY_9AM_UTC;
    // Event ends 13 hours before the slot starts — outside the 12-hour window
    const farPast: OccupiedInterval = {
      startMs: startMs - 14 * 3600000,
      endMs: startMs - 13 * 3600000,
      title: "TooFar",
    };
    const ctx = buildSlotContext(startMs, startMs + 3600000, [farPast]);
    expect(ctx.previousEventTitle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enumerateSlots
// ---------------------------------------------------------------------------

describe("enumerateSlots", () => {
  const durationMinutes = 60;
  const dueDateMs = MONDAY_9AM_UTC + 5 * 24 * 60 * 60 * 1000; // 5 days later

  test("returns candidates within horizon and before due date", () => {
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(20);
    for (const c of candidates) {
      expect(c.startMs).toBeGreaterThanOrEqual(MONDAY_9AM_UTC);
      expect(c.startMs).toBeLessThan(dueDateMs);
    }
  });

  test("excludes slots overlapping occupied intervals", () => {
    const occupied: OccupiedInterval[] = [
      { startMs: MONDAY_9AM_UTC, endMs: MONDAY_9AM_UTC + 120 * 60 * 1000, title: "Busy" },
    ];
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: occupied,
      timezone: TIMEZONE,
    });
    for (const c of candidates) {
      expect(c.startMs).toBeGreaterThanOrEqual(MONDAY_9AM_UTC + 120 * 60 * 1000);
    }
  });

  test("returns empty array when due date is before fromMs", () => {
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC + 1000,
      dueDateMs: MONDAY_9AM_UTC,
      durationMinutes,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(candidates).toHaveLength(0);
  });

  test("caps at 20 candidates", () => {
    const farFuture = MONDAY_9AM_UTC + SCHEDULE_HORIZON_MS;
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs: farFuture,
      durationMinutes,
      workHoursGrid: [], // no restrictions → many slots
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(candidates.length).toBeLessThanOrEqual(20);
  });

  test("tags inAvailableSlot correctly", () => {
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    // 9 AM slot should be in available (slots 18-19)
    const first = candidates[0];
    expect(first.inAvailableSlot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extendSlotPool + filterPoolForBlock
// ---------------------------------------------------------------------------

describe("extendSlotPool", () => {
  test("appends valid slots to the pool and returns new cursor", () => {
    const pool: PoolSlot[] = [];
    const cursor = extendSlotPool({
      pool,
      scanCursor: MONDAY_9AM_UTC,
      targetMs: MONDAY_9AM_UTC + 3 * 60 * 60 * 1000,
      focusBlockLengthMinutes: 60,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(cursor).toBeGreaterThan(MONDAY_9AM_UTC);
    expect(pool.length).toBeGreaterThan(0);
  });

  test("does not duplicate already-scanned slots", () => {
    const pool: PoolSlot[] = [];
    const targetMs = MONDAY_9AM_UTC + 2 * 60 * 60 * 1000;
    extendSlotPool({
      pool,
      scanCursor: MONDAY_9AM_UTC,
      targetMs,
      focusBlockLengthMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    const sizeBefore = pool.length;
    // Extending to same target again from new cursor should add nothing
    extendSlotPool({
      pool,
      scanCursor: targetMs,
      targetMs,
      focusBlockLengthMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(pool.length).toBe(sizeBefore);
  });
});

describe("filterPoolForBlock", () => {
  test("excludes slots at or after due date", () => {
    const dueDateMs = MONDAY_9AM_UTC + 60 * 60 * 1000;
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC, inAvailableSlot: true },
      { startMs: dueDateMs, inAvailableSlot: true },
      { startMs: dueDateMs + 3600000, inAvailableSlot: true },
    ];
    const candidates = filterPoolForBlock({
      pool,
      dueDateMs,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(candidates.every((c) => c.startMs < dueDateMs)).toBe(true);
  });

  test("excludes slots overlapping occupied intervals", () => {
    const pool: PoolSlot[] = [{ startMs: MONDAY_9AM_UTC, inAvailableSlot: true }];
    const occupied: OccupiedInterval[] = [
      { startMs: MONDAY_9AM_UTC + 30 * 60 * 1000, endMs: MONDAY_9AM_UTC + 90 * 60 * 1000, title: "Busy" },
    ];
    const candidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 5 * 3600000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: occupied,
      timezone: TIMEZONE,
    });
    expect(candidates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectSlotWithAI (mock Gemini)
// ---------------------------------------------------------------------------

describe("selectSlotWithAI", () => {
  test("returns null when candidates is empty", async () => {
    const result = await selectSlotWithAI({
      candidates: [],
      taskTitle: "Test",
      dueDate: MONDAY_9AM_UTC + 86400000,
      productivityTraits: null,
    });
    expect(result).toBeNull();
  });

  test("falls back to index 0 when Gemini is unavailable (no API key)", async () => {
    // No GEMINI_API_KEY in test env → callGemini will throw → fallback to 0
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs: MONDAY_9AM_UTC + 5 * 86400000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    const result = await selectSlotWithAI({
      candidates,
      taskTitle: "Test task",
      dueDate: MONDAY_9AM_UTC + 5 * 86400000,
      productivityTraits: null,
    });
    // Should return the first candidate (index 0 fallback)
    expect(result).not.toBeNull();
    expect(result!.startISO).toBe(candidates[0].startISO);
  });
});
