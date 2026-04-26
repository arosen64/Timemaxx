import { describe, expect, test, vi } from "vitest";
import {
  roundUpTo15Min,
  isSlotValid,
  buildSlotContext,
  enumerateSlots,
  extendSlotPool,
  filterPoolForBlock,
  selectSlotWithAI,
  computeRecommendedStart,
  computeSubtaskCascade,
  buildDailyLoadMap,
  computeMaxBlocksPerDay,
  isDailyCapReached,
  SCHEDULE_HORIZON_MS,
  TWO_WEEKS_MS,
  DAY_MS,
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

  test("returns candidates with context fields", () => {
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: WORK_HOURS,
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    const first = candidates[0];
    expect(first).toHaveProperty("startMs");
    expect(first).toHaveProperty("startISO");
    expect(first).toHaveProperty("previousEventTitle");
    expect(first).toHaveProperty("nextEventTitle");
  });

  test("excludes slots before recommendedStartMs when set", () => {
    const recommendedStartMs = MONDAY_9AM_UTC + 2 * 24 * 60 * 60 * 1000;
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs: MONDAY_9AM_UTC + 5 * 24 * 60 * 60 * 1000,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      recommendedStartMs,
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.startMs).toBeGreaterThanOrEqual(recommendedStartMs);
    }
  });

  test("is unaffected when recommendedStartMs is not set", () => {
    const withoutConstraint = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    const withUndefined = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      recommendedStartMs: undefined,
    });
    expect(withoutConstraint).toEqual(withUndefined);
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
      { startMs: MONDAY_9AM_UTC },
      { startMs: dueDateMs },
      { startMs: dueDateMs + 3600000 },
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
    const pool: PoolSlot[] = [{ startMs: MONDAY_9AM_UTC }];
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

  test("excludes slots before recommendedStartMs when set", () => {
    const recommendedStartMs = MONDAY_9AM_UTC + 60 * 60 * 1000;
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },
      { startMs: recommendedStartMs },
      { startMs: MONDAY_9AM_UTC + 2 * 60 * 60 * 1000 },
    ];
    const candidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 10 * 60 * 60 * 1000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      recommendedStartMs,
    });
    expect(candidates.every((c) => c.startMs >= recommendedStartMs)).toBe(true);
    expect(candidates.some((c) => c.startMs === MONDAY_9AM_UTC)).toBe(false);
  });

  test("is unaffected when recommendedStartMs is not set", () => {
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },
      { startMs: MONDAY_9AM_UTC + 60 * 60 * 1000 },
    ];
    const dueDateMs = MONDAY_9AM_UTC + 10 * 60 * 60 * 1000;
    const candidates = filterPoolForBlock({
      pool,
      dueDateMs,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(candidates).toHaveLength(2);
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

// ---------------------------------------------------------------------------
// computeRecommendedStart
// ---------------------------------------------------------------------------

describe("computeRecommendedStart", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date("2026-04-25T12:00:00Z").getTime();

  test("returns dueDate minus two weeks when due date is far out", () => {
    const farDue = now + 30 * DAY_MS;
    expect(computeRecommendedStart(now, farDue)).toBe(farDue - TWO_WEEKS_MS);
  });

  test("clamps to now when due date is within two weeks", () => {
    const tightDue = now + 7 * DAY_MS;
    expect(computeRecommendedStart(now, tightDue)).toBe(now);
  });

  test("clamps to now when due date is exactly two weeks out", () => {
    const exactDue = now + TWO_WEEKS_MS;
    expect(computeRecommendedStart(now, exactDue)).toBe(now);
  });
});

// ---------------------------------------------------------------------------
// computeSubtaskCascade
// ---------------------------------------------------------------------------

describe("computeSubtaskCascade", () => {
  const now = new Date("2026-04-25T12:00:00Z").getTime();

  test("spaces subtasks 2 days apart when window is wide", () => {
    const dueDate = now + 30 * DAY_MS;
    const dateAt = computeSubtaskCascade(now, dueDate, 3);
    const windowStart = dueDate - TWO_WEEKS_MS;
    expect(dateAt(0)).toBe(windowStart + 2 * DAY_MS);
    expect(dateAt(1)).toBe(windowStart + 4 * DAY_MS);
    expect(dateAt(2)).toBe(windowStart + 6 * DAY_MS);
  });

  test("compresses to 1-day intervals when window is tight", () => {
    const dueDate = now + 4 * DAY_MS;
    const dateAt = computeSubtaskCascade(now, dueDate, 4);
    expect(dateAt(0)).toBe(now + 1 * DAY_MS);
    expect(dateAt(1)).toBe(now + 2 * DAY_MS);
    expect(dateAt(2)).toBe(now + 3 * DAY_MS);
    expect(dateAt(3)).toBe(now + 4 * DAY_MS);
  });

  test("caps dates at dueDate when more subtasks than available days", () => {
    // 5 subtasks, 4 days → interval = 1 day, last two both land at dueDate
    const dueDate = now + 4 * DAY_MS;
    const dateAt = computeSubtaskCascade(now, dueDate, 5);
    expect(dateAt(0)).toBe(now + 1 * DAY_MS);
    expect(dateAt(1)).toBe(now + 2 * DAY_MS);
    expect(dateAt(2)).toBe(now + 3 * DAY_MS);
    expect(dateAt(3)).toBe(dueDate);
    expect(dateAt(4)).toBe(dueDate);
  });
});

// ---------------------------------------------------------------------------
// buildDailyLoadMap
// ---------------------------------------------------------------------------

describe("buildDailyLoadMap", () => {
  // Monday 2025-01-06 14:00 UTC = 09:00 EST
  const BASE_MS = MONDAY_9AM_UTC;
  const FOCUS = 60; // minutes

  test("a placed study block (exactly focusBlockLength) counts as 1 unit", () => {
    const intervals: OccupiedInterval[] = [
      { startMs: BASE_MS, endMs: BASE_MS + 60 * 60000, title: "Study" },
    ];
    const map = buildDailyLoadMap(intervals, TIMEZONE, FOCUS);
    expect(map.get("2025-01-06")).toBe(1);
  });

  test("a 3-hour GCal event counts as 3 units with 60-min focus block", () => {
    const intervals: OccupiedInterval[] = [
      { startMs: BASE_MS, endMs: BASE_MS + 180 * 60000, title: "Lecture" },
    ];
    const map = buildDailyLoadMap(intervals, TIMEZONE, FOCUS);
    expect(map.get("2025-01-06")).toBe(3);
  });

  test("a 90-min event with 60-min focus block rounds up to 2 units", () => {
    const intervals: OccupiedInterval[] = [
      { startMs: BASE_MS, endMs: BASE_MS + 90 * 60000, title: "Lab" },
    ];
    const map = buildDailyLoadMap(intervals, TIMEZONE, FOCUS);
    expect(map.get("2025-01-06")).toBe(2);
  });

  test("multiple intervals on the same day accumulate", () => {
    const intervals: OccupiedInterval[] = [
      { startMs: BASE_MS, endMs: BASE_MS + 60 * 60000, title: "Block 1" },
      { startMs: BASE_MS + 120 * 60000, endMs: BASE_MS + 180 * 60000, title: "Block 2" },
    ];
    const map = buildDailyLoadMap(intervals, TIMEZONE, FOCUS);
    expect(map.get("2025-01-06")).toBe(2);
  });

  test("intervals on different days are tracked separately", () => {
    const TUESDAY_MS = BASE_MS + 24 * 60 * 60000;
    const intervals: OccupiedInterval[] = [
      { startMs: BASE_MS, endMs: BASE_MS + 60 * 60000, title: "Monday block" },
      { startMs: TUESDAY_MS, endMs: TUESDAY_MS + 60 * 60000, title: "Tuesday block" },
    ];
    const map = buildDailyLoadMap(intervals, TIMEZONE, FOCUS);
    expect(map.get("2025-01-06")).toBe(1);
    expect(map.get("2025-01-07")).toBe(1);
  });

  test("empty intervals returns empty map", () => {
    const map = buildDailyLoadMap([], TIMEZONE, FOCUS);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeMaxBlocksPerDay
// ---------------------------------------------------------------------------

describe("computeMaxBlocksPerDay", () => {
  test("preferred days keep the base cap", () => {
    // Monday: 18 blocked (midnight–9am) → 30 available → floor(30*30/60) = 15 → capped at 4
    const map = computeMaxBlocksPerDay(WORK_HOURS, 60, ["Monday"]);
    expect(map.get("Monday")).toBe(4);
  });

  test("non-preferred days get base − 1", () => {
    // Monday base = 4, not preferred → 4 − 1 = 3
    const map = computeMaxBlocksPerDay(WORK_HOURS, 60, []);
    expect(map.get("Monday")).toBe(3);
  });

  test("cap never exceeds 4 even with many available slots", () => {
    const map = computeMaxBlocksPerDay([], 15, ["Monday"]);
    expect(map.get("Monday")).toBeLessThanOrEqual(4);
  });

  test("non-preferred cap is at least 1", () => {
    // A day fully blocked (48 slots) → base = 0 → non-preferred = max(1, -1) = 1
    const fullyBlocked: WorkHoursRow[] = [
      { day: "Monday", blocked: Array.from({ length: 48 }, (_, i) => i) },
    ];
    const map = computeMaxBlocksPerDay(fullyBlocked, 60, []);
    expect(map.get("Monday")).toBe(1);
  });

  test("days absent from workHoursGrid use fallback: preferred → 3, non-preferred → 2", () => {
    const map = computeMaxBlocksPerDay([], 60, ["Wednesday"]);
    expect(map.get("Wednesday")).toBe(3);
    expect(map.get("Thursday")).toBe(2);
  });

  test("longer focus block yields fewer allowed blocks per day", () => {
    // 44 slots blocked → only 4 available: floor(4*30/30)=4 vs floor(4*30/60)=2
    const sparseGrid: WorkHoursRow[] = [
      { day: "Monday", blocked: Array.from({ length: 44 }, (_, i) => i) },
    ];
    const mapShort = computeMaxBlocksPerDay(sparseGrid, 30, ["Monday"]);
    const mapLong = computeMaxBlocksPerDay(sparseGrid, 60, ["Monday"]);
    expect(mapShort.get("Monday")!).toBeGreaterThan(mapLong.get("Monday")!);
  });
});

// ---------------------------------------------------------------------------
// isDailyCapReached
// ---------------------------------------------------------------------------

describe("isDailyCapReached", () => {
  // Monday 2025-01-06 14:00 UTC = 09:00 EST
  const BASE_MS = MONDAY_9AM_UTC;

  test("returns false when load is below cap", () => {
    const loadMap = new Map([["2025-01-06", 1]]);
    const capMap = new Map([["Monday", 3]]);
    expect(isDailyCapReached(BASE_MS, TIMEZONE, loadMap, capMap)).toBe(false);
  });

  test("returns true when load equals cap", () => {
    const loadMap = new Map([["2025-01-06", 3]]);
    const capMap = new Map([["Monday", 3]]);
    expect(isDailyCapReached(BASE_MS, TIMEZONE, loadMap, capMap)).toBe(true);
  });

  test("returns true when load exceeds cap", () => {
    const loadMap = new Map([["2025-01-06", 5]]);
    const capMap = new Map([["Monday", 3]]);
    expect(isDailyCapReached(BASE_MS, TIMEZONE, loadMap, capMap)).toBe(true);
  });

  test("uses default cap of 2 when day is absent from maxBlocksPerDayMap", () => {
    const loadMap = new Map([["2025-01-06", 2]]);
    expect(isDailyCapReached(BASE_MS, TIMEZONE, loadMap, new Map())).toBe(true);
  });

  test("returns false when date has no load entry", () => {
    const capMap = new Map([["Monday", 3]]);
    expect(isDailyCapReached(BASE_MS, TIMEZONE, new Map(), capMap)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enumerateSlots with daily load cap
// ---------------------------------------------------------------------------

describe("enumerateSlots with dailyLoadMap / maxBlocksPerDayMap", () => {
  const durationMinutes = 60;
  const dueDateMs = MONDAY_9AM_UTC + 5 * 24 * 60 * 60 * 1000;

  test("excludes slots on days already at cap", () => {
    // Mark Monday 2025-01-06 as fully loaded (cap = 1, load = 1)
    const loadMap = new Map([["2025-01-06", 1]]);
    const capMap = new Map([
      ["Monday", 1],
      ["Tuesday", 3], ["Wednesday", 3], ["Thursday", 3], ["Friday", 3],
      ["Saturday", 3], ["Sunday", 3],
    ]);
    const candidates = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      dailyLoadMap: loadMap,
      maxBlocksPerDayMap: capMap,
    });
    const mondayDate = "2025-01-06";
    const hasMondaySlot = candidates.some(
      (c) => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(c.startMs)) === mondayDate,
    );
    expect(hasMondaySlot).toBe(false);
    expect(candidates.length).toBeGreaterThan(0); // other days still have slots
  });

  test("behaves identically to uncapped version when no cap params provided", () => {
    const withCap = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    const withoutCap = enumerateSlots({
      fromMs: MONDAY_9AM_UTC,
      dueDateMs,
      durationMinutes,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
    });
    expect(withCap.length).toBe(withoutCap.length);
  });
});

// ---------------------------------------------------------------------------
// filterPoolForBlock with daily load cap
// ---------------------------------------------------------------------------

describe("filterPoolForBlock with dailyLoadMap / maxBlocksPerDayMap", () => {
  test("excludes pool slots on days at cap", () => {
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },                           // Monday — at cap
      { startMs: MONDAY_9AM_UTC + 24 * 60 * 60 * 1000 },    // Tuesday — under cap
    ];
    const loadMap = new Map([["2025-01-06", 3]]);
    const capMap = new Map([["Monday", 3], ["Tuesday", 3]]);
    const candidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 5 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      dailyLoadMap: loadMap,
      maxBlocksPerDayMap: capMap,
    });
    expect(candidates.every((c) => c.startMs !== MONDAY_9AM_UTC)).toBe(true);
    expect(candidates.some((c) => c.startMs === MONDAY_9AM_UTC + 24 * 60 * 60 * 1000)).toBe(true);
  });
});
