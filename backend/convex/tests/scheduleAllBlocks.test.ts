import { describe, expect, test } from "vitest";
import {
  buildSlotContext,
  isSlotValid,
  toDateStr,
  type OccupiedInterval,
  type PoolSlot,
  type WorkHoursRow,
} from "../lib/scheduleSlots";
import { parseTimeOfDayRanges, scoreCandidate } from "../lib/scoreSlots";

const TIMEZONE = "America/New_York";

// ET (non-DST) timestamp helper
function etMs(isoDate: string, hour: number, minute = 0): number {
  return new Date(
    `${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`
  ).getTime();
}

const TUE = "2026-01-06";
const WED = "2026-01-07";
const THU = "2026-01-08";
const SAT = "2026-01-10";

// Mirrors the Phase 1 scoring loop in scheduleAllBlocks.ts.
// If the loop logic changes, update this too.
function scoreAndRankSlots(opts: {
  pool: PoolSlot[];
  blockDurationMs: number;
  dueDateMs: number;
  timezone: string;
  timeOfDayRanges: Array<[number, number]>;
  dayOfWeekPrefs: string[];
  speculativeDailyLoadMap: Map<string, number>;
  occupiedIntervals: OccupiedInterval[];
  workHoursGrid: WorkHoursRow[];
  recommendedStartMs?: number;
}) {
  const {
    pool,
    blockDurationMs,
    dueDateMs,
    timezone,
    timeOfDayRanges,
    dayOfWeekPrefs,
    speculativeDailyLoadMap,
    occupiedIntervals,
    workHoursGrid,
  } = opts;

  const scoredSlots: Array<{ startMs: number; score: number; dateStr: string }> = [];

  for (const s of pool) {
    if (s.startMs >= dueDateMs) continue;
    if (s.startMs + blockDurationMs > dueDateMs) continue;
    if (opts.recommendedStartMs !== undefined && s.startMs < opts.recommendedStartMs) continue;
    if (!isSlotValid(s.startMs, blockDurationMs, workHoursGrid, occupiedIntervals, timezone))
      continue;

    const endMs = s.startMs + blockDurationMs;
    const context = buildSlotContext(s.startMs, endMs, occupiedIntervals);
    const dateStr = toDateStr(new Date(s.startMs), timezone);

    const { score } = scoreCandidate({
      startMs: s.startMs,
      timezone,
      timeOfDayRanges,
      dayOfWeekPrefs,
      minutesSincePreviousEvent: context.minutesSincePreviousEvent,
      minutesUntilNextEvent: context.minutesUntilNextEvent,
      dailyLoadCount: speculativeDailyLoadMap.get(dateStr) ?? 0,
    });

    scoredSlots.push({ startMs: s.startMs, score, dateStr });
  }

  scoredSlots.sort((a, b) => b.score - a.score);
  return scoredSlots;
}

// Shared scoring opts for preference-based tests
const PREFS = {
  timeOfDayRanges: parseTimeOfDayRanges(["Afternoon (2–5pm)"]),
  dayOfWeekPrefs: ["Tuesday", "Wednesday", "Thursday"],
};
const DUE_FAR = etMs(SAT, 23) + 14 * 24 * 60 * 60 * 1000;
const BLOCK_MS = 60 * 60000;
const EMPTY = { occupiedIntervals: [] as OccupiedInterval[], workHoursGrid: [] as WorkHoursRow[] };

// ---------------------------------------------------------------------------
// Global scoring: preferred day and time sort to top
// ---------------------------------------------------------------------------

describe("global scoring: preferred day and time sort to top", () => {
  test("preferred day + preferred time ranks above both-unpreferred", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(SAT, 23) }, // Saturday 11pm — neither preferred day nor time
      { startMs: etMs(TUE, 14) }, // Tuesday 2pm — both preferred
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: new Map(),
      ...EMPTY,
    });

    // Tuesday 2pm: +2 time +1 day +1 buffer = 4
    // Saturday 11pm: +0 time +0 day +1 buffer = 1
    expect(ranked[0].startMs).toBe(etMs(TUE, 14));
  });

  test("preferred time on non-preferred day outscores preferred day at wrong time", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(SAT, 14) }, // Saturday 2pm — preferred time, non-preferred day → +2+0+1 = 3
      { startMs: etMs(TUE, 23) }, // Tuesday 11pm — preferred day, non-preferred time → +0+1+1 = 2
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: new Map(),
      ...EMPTY,
    });

    expect(ranked[0].startMs).toBe(etMs(SAT, 14));
  });

  test("when no preferences set all slots score equally (only buffer comfort applies)", () => {
    const pool: PoolSlot[] = [{ startMs: etMs(TUE, 14) }, { startMs: etMs(SAT, 23) }];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      timeOfDayRanges: [],
      dayOfWeekPrefs: [],
      speculativeDailyLoadMap: new Map(),
      ...EMPTY,
    });

    // Both score 1 (bufferComfort only); stable sort preserves pool order
    expect(ranked.every((s) => s.score === 1)).toBe(true);
  });

  test("slots before recommendedStartMs are excluded", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) }, // Tuesday 2pm — before recommended start
      { startMs: etMs(WED, 14) }, // Wednesday 2pm — after recommended start
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: new Map(),
      ...EMPTY,
      recommendedStartMs: etMs(WED, 0), // start no earlier than Wednesday midnight
    });

    expect(ranked.every((s) => s.startMs >= etMs(WED, 0))).toBe(true);
    expect(ranked[0].startMs).toBe(etMs(WED, 14));
  });

  test("slots overlapping occupied intervals are excluded", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) }, // conflicts with an existing event
      { startMs: etMs(WED, 14) }, // free
    ];
    const occupiedIntervals: OccupiedInterval[] = [
      {
        startMs: etMs(TUE, 13, 30),
        endMs: etMs(TUE, 15, 0),
        title: "Conflicting event",
      },
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: new Map(),
      occupiedIntervals,
      workHoursGrid: [],
    });

    expect(ranked.every((s) => s.startMs !== etMs(TUE, 14))).toBe(true);
    expect(ranked[0].startMs).toBe(etMs(WED, 14));
  });
});

// ---------------------------------------------------------------------------
// Global scoring: speculative load spreads blocks across days
// ---------------------------------------------------------------------------

describe("global scoring: speculative load spreads blocks across days", () => {
  test("after reserving one day, next block prefers a different day at the same time", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) }, // Tuesday 2pm
      { startMs: etMs(WED, 14) }, // Wednesday 2pm
    ];
    const speculativeMap = new Map<string, number>();

    // Block 1: both days at load 0, equal score — note which day wins
    const ranked1 = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: speculativeMap,
      ...EMPTY,
    });
    const topDate = ranked1[0].dateStr;
    speculativeMap.set(topDate, 1);

    // Block 2: the reserved day now has load 1 (penalty −1), the other day is still at 0
    const ranked2 = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: speculativeMap,
      ...EMPTY,
    });

    expect(ranked2[0].dateStr).not.toBe(topDate);
  });

  test("load penalty of −1 per block drops a day's score", () => {
    const tueDateStr = toDateStr(new Date(etMs(TUE, 14)), TIMEZONE);
    const speculativeMap = new Map([[tueDateStr, 1]]);

    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) }, // Tuesday 2pm: +2+1+1−1 = 3
      { startMs: etMs(WED, 14) }, // Wednesday 2pm: +2+1+1−0 = 4
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: speculativeMap,
      ...EMPTY,
    });

    expect(ranked[0].dateStr).toBe(toDateStr(new Date(etMs(WED, 14)), TIMEZONE));
  });

  test("load penalty is capped at −3 regardless of block count", () => {
    const tueDateStr = toDateStr(new Date(etMs(TUE, 14)), TIMEZONE);
    // Tuesday already has 5 blocks worth of load — penalty should still be −3
    const speculativeMap = new Map([[tueDateStr, 5]]);

    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) }, // +2+1+1−3 = 1
      { startMs: etMs(THU, 23) }, // +0+1+1−0 = 2
    ];

    const ranked = scoreAndRankSlots({
      pool,
      blockDurationMs: BLOCK_MS,
      dueDateMs: DUE_FAR,
      timezone: TIMEZONE,
      ...PREFS,
      speculativeDailyLoadMap: speculativeMap,
      ...EMPTY,
    });

    // Thursday 11pm (score 2) > Tuesday 2pm capped at penalty (score 1)
    expect(ranked[0].startMs).toBe(etMs(THU, 23));
  });

  test("three blocks spread across three different days", () => {
    const pool: PoolSlot[] = [
      { startMs: etMs(TUE, 14) },
      { startMs: etMs(WED, 14) },
      { startMs: etMs(THU, 14) },
    ];
    const speculativeMap = new Map<string, number>();
    const chosenDays: string[] = [];

    for (let i = 0; i < 3; i++) {
      const ranked = scoreAndRankSlots({
        pool,
        blockDurationMs: BLOCK_MS,
        dueDateMs: DUE_FAR,
        timezone: TIMEZONE,
        ...PREFS,
        speculativeDailyLoadMap: speculativeMap,
        ...EMPTY,
      });
      const top = ranked[0];
      chosenDays.push(top.dateStr);
      speculativeMap.set(top.dateStr, (speculativeMap.get(top.dateStr) ?? 0) + 1);
    }

    expect(new Set(chosenDays).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Sort order (block priority within a run)
// ---------------------------------------------------------------------------

// Mirrors the sort comparator in actions/scheduleAllBlocks.ts.
// If the comparator changes, update this too.
function sortForScheduling(
  a: { parentDueDate: number; parentWeight: number; _creationTime: number },
  b: { parentDueDate: number; parentWeight: number; _creationTime: number }
) {
  return (
    a.parentDueDate - b.parentDueDate ||
    b.parentWeight - a.parentWeight ||
    a._creationTime - b._creationTime
  );
}

const BASE = 1_000_000;

describe("scheduleAllBlocks sort order", () => {
  test("earlier parent due date sorts first", () => {
    const blocks = [
      { parentDueDate: BASE + 2000, parentWeight: 10, _creationTime: 1 },
      { parentDueDate: BASE + 1000, parentWeight: 10, _creationTime: 2 },
    ];
    blocks.sort(sortForScheduling);
    expect(blocks[0].parentDueDate).toBe(BASE + 1000);
  });

  test("same due date: higher parentWeight sorts first", () => {
    const blocks = [
      { parentDueDate: BASE, parentWeight: 20, _creationTime: 1 },
      { parentDueDate: BASE, parentWeight: 50, _creationTime: 2 },
    ];
    blocks.sort(sortForScheduling);
    expect(blocks[0].parentWeight).toBe(50);
  });

  test("same due date + same weight: earlier _creationTime sorts first", () => {
    const blocks = [
      { parentDueDate: BASE, parentWeight: 30, _creationTime: 200 },
      { parentDueDate: BASE, parentWeight: 30, _creationTime: 100 },
    ];
    blocks.sort(sortForScheduling);
    expect(blocks[0]._creationTime).toBe(100);
  });

  test("block without parentWeight (0) sorts after weighted block with same due date", () => {
    const blocks = [
      { parentDueDate: BASE, parentWeight: 0, _creationTime: 1 },
      { parentDueDate: BASE, parentWeight: 10, _creationTime: 2 },
    ];
    blocks.sort(sortForScheduling);
    expect(blocks[0].parentWeight).toBe(10);
  });

  test("due date takes priority over parentWeight", () => {
    const blocks = [
      { parentDueDate: BASE + 1000, parentWeight: 100, _creationTime: 1 },
      { parentDueDate: BASE, parentWeight: 0, _creationTime: 2 },
    ];
    blocks.sort(sortForScheduling);
    expect(blocks[0].parentDueDate).toBe(BASE);
  });
});

// ---------------------------------------------------------------------------
// Block filtering
// ---------------------------------------------------------------------------

function filterBlocksForTask(
  blocks: Array<{
    taskId?: string;
    subtaskId?: string;
    startTime?: string;
    isConflicted?: boolean;
  }>,
  taskId: string,
  subtaskIds: Set<string>
) {
  const isTaskBlock = (b: { taskId?: string; subtaskId?: string }) =>
    b.taskId === taskId || (b.subtaskId !== undefined && subtaskIds.has(b.subtaskId));
  const unscheduled = blocks.filter((b) => !b.startTime && isTaskBlock(b));
  const conflicted = blocks.filter((b) => b.startTime && b.isConflicted && isTaskBlock(b));
  return { unscheduled, conflicted };
}

const TASK_ID = "task1";
const OTHER_TASK_ID = "task2";
const SUBTASK_ID = "sub1";
const OTHER_SUBTASK_ID = "sub2";
const subtaskIds = new Set([SUBTASK_ID]);

describe("scheduleAllBlocks block filtering", () => {
  test("includes unscheduled blocks for the target task", () => {
    const blocks = [
      { taskId: TASK_ID, startTime: undefined },
      { taskId: OTHER_TASK_ID, startTime: undefined },
    ];
    const { unscheduled } = filterBlocksForTask(blocks, TASK_ID, subtaskIds);
    expect(unscheduled).toHaveLength(1);
    expect(unscheduled[0].taskId).toBe(TASK_ID);
  });

  test("includes unscheduled blocks for subtasks of the target task", () => {
    const blocks = [
      { subtaskId: SUBTASK_ID, startTime: undefined },
      { subtaskId: OTHER_SUBTASK_ID, startTime: undefined },
    ];
    const { unscheduled } = filterBlocksForTask(blocks, TASK_ID, subtaskIds);
    expect(unscheduled).toHaveLength(1);
    expect(unscheduled[0].subtaskId).toBe(SUBTASK_ID);
  });

  test("excludes scheduled (non-conflicted) blocks", () => {
    const blocks = [{ taskId: TASK_ID, startTime: "2026-04-01T10:00:00Z", isConflicted: false }];
    const { unscheduled, conflicted } = filterBlocksForTask(blocks, TASK_ID, subtaskIds);
    expect(unscheduled).toHaveLength(0);
    expect(conflicted).toHaveLength(0);
  });

  test("counts conflicted blocks separately and excludes them from unscheduled", () => {
    const blocks = [
      { taskId: TASK_ID, startTime: undefined },
      { taskId: TASK_ID, startTime: "2026-04-01T10:00:00Z", isConflicted: true },
    ];
    const { unscheduled, conflicted } = filterBlocksForTask(blocks, TASK_ID, subtaskIds);
    expect(unscheduled).toHaveLength(1);
    expect(conflicted).toHaveLength(1);
  });

  test("conflicted blocks from other tasks are not counted", () => {
    const blocks = [
      { taskId: OTHER_TASK_ID, startTime: "2026-04-01T10:00:00Z", isConflicted: true },
    ];
    const { conflicted } = filterBlocksForTask(blocks, TASK_ID, subtaskIds);
    expect(conflicted).toHaveLength(0);
  });
});
