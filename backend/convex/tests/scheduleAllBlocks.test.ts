import { describe, expect, test } from "vitest";
import {
  buildDailyLoadMap,
  computeMaxBlocksPerDay,
  filterPoolForBlock,
  toDateStr,
  type OccupiedInterval,
  type PoolSlot,
} from "../lib/scheduleSlots";

const TIMEZONE = "America/New_York";
// Monday 2025-01-06 14:00 UTC = 09:00 EST
const MONDAY_9AM_UTC = new Date("2025-01-06T14:00:00.000Z").getTime();
const TUESDAY_9AM_UTC = MONDAY_9AM_UTC + 24 * 60 * 60 * 1000;

// Mirrors the block-filtering logic in actions/scheduleAllBlocks.ts.
function filterBlocksForTask(
  blocks: Array<{ taskId?: string; subtaskId?: string; startTime?: string; isConflicted?: boolean }>,
  taskId: string,
  subtaskIds: Set<string>,
) {
  const isTaskBlock = (b: { taskId?: string; subtaskId?: string }) =>
    b.taskId === taskId || (b.subtaskId !== undefined && subtaskIds.has(b.subtaskId));
  const unscheduled = blocks.filter((b) => !b.startTime && isTaskBlock(b));
  const conflicted = blocks.filter((b) => b.startTime && b.isConflicted && isTaskBlock(b));
  return { unscheduled, conflicted };
}

// Mirrors the sort comparator in actions/scheduleAllBlocks.ts.
// If the comparator changes, update this too.
function sortForScheduling(
  a: { parentDueDate: number; parentWeight: number; _creationTime: number },
  b: { parentDueDate: number; parentWeight: number; _creationTime: number },
) {
  return (
    a.parentDueDate - b.parentDueDate ||
    b.parentWeight - a.parentWeight ||
    a._creationTime - b._creationTime
  );
}

const BASE = 1_000_000;

// ---------------------------------------------------------------------------
// Daily load cap — in-memory map update between placements (bulk path)
// ---------------------------------------------------------------------------

describe("scheduleAllBlocks daily cap — in-memory update between placements", () => {
  // Simulates the phase-1/phase-3 loop: after placing a block, the dailyLoadMap
  // is incremented so the next filterPoolForBlock call sees the updated count.

  test("second block is excluded from a capped day after first block is placed", () => {
    const cap = 1;
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },                  // Monday slot
      { startMs: MONDAY_9AM_UTC + 60 * 60000 },     // Monday slot (second)
      { startMs: TUESDAY_9AM_UTC },                 // Tuesday slot
    ];
    const capMap = new Map([["Monday", cap], ["Tuesday", cap]]);
    const loadMap = new Map<string, number>(); // nothing placed yet

    // Phase 1: first block picks Monday
    const firstCandidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      dailyLoadMap: loadMap,
      maxBlocksPerDayMap: capMap,
    });
    expect(firstCandidates.some((c) => c.startMs === MONDAY_9AM_UTC)).toBe(true);

    // Simulate placement: update loadMap (mirrors the phase-3 increment in scheduleAllBlocks)
    const placedDate = toDateStr(new Date(MONDAY_9AM_UTC), TIMEZONE);
    loadMap.set(placedDate, (loadMap.get(placedDate) ?? 0) + 1);

    // Phase 1 for second block: Monday is now at cap, only Tuesday should appear
    const secondCandidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      dailyLoadMap: loadMap,
      maxBlocksPerDayMap: capMap,
    });
    expect(secondCandidates.every((c) => c.startMs !== MONDAY_9AM_UTC)).toBe(true);
    expect(secondCandidates.every((c) => c.startMs !== MONDAY_9AM_UTC + 60 * 60000)).toBe(true);
    expect(secondCandidates.some((c) => c.startMs === TUESDAY_9AM_UTC)).toBe(true);
  });

  test("block count never exceeds cap across a full simulated placement loop", () => {
    const cap = 2;
    const occupiedIntervals: OccupiedInterval[] = [];
    const capMap = new Map([["Monday", cap], ["Tuesday", cap]]);
    const loadMap = new Map<string, number>();

    // Build a pool with 3 Monday slots and 2 Tuesday slots
    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },
      { startMs: MONDAY_9AM_UTC + 60 * 60000 },
      { startMs: MONDAY_9AM_UTC + 120 * 60000 },
      { startMs: TUESDAY_9AM_UTC },
      { startMs: TUESDAY_9AM_UTC + 60 * 60000 },
    ];

    const placedDates: string[] = [];

    for (let i = 0; i < 4; i++) {
      const candidates = filterPoolForBlock({
        pool,
        dueDateMs: MONDAY_9AM_UTC + 7 * 24 * 60 * 60 * 1000,
        durationMinutes: 60,
        workHoursGrid: [],
        occupiedIntervals,
        timezone: TIMEZONE,
        dailyLoadMap: loadMap,
        maxBlocksPerDayMap: capMap,
      });
      if (candidates.length === 0) break;

      const chosen = candidates[0];
      occupiedIntervals.push({ startMs: chosen.startMs, endMs: chosen.startMs + 60 * 60000, title: "Block" });
      const dateStr = toDateStr(new Date(chosen.startMs), TIMEZONE);
      loadMap.set(dateStr, (loadMap.get(dateStr) ?? 0) + 1);
      placedDates.push(dateStr);
    }

    // Count placements per day — none should exceed cap
    const counts = new Map<string, number>();
    for (const d of placedDates) counts.set(d, (counts.get(d) ?? 0) + 1);
    for (const [, count] of counts) {
      expect(count).toBeLessThanOrEqual(cap);
    }
  });
});

// ---------------------------------------------------------------------------
// Daily cap — empty workHoursGrid fallback (no grid → default cap of 3)
// ---------------------------------------------------------------------------

describe("scheduleAllBlocks daily cap — empty workHoursGrid fallback", () => {
  test("computeMaxBlocksPerDay with empty grid returns cap of 3 for preferred days", () => {
    const capMap = computeMaxBlocksPerDay([], 60, ["Monday"]);
    expect(capMap.get("Monday")).toBe(3);
  });

  test("computeMaxBlocksPerDay with empty grid returns cap of 2 for non-preferred days", () => {
    const capMap = computeMaxBlocksPerDay([], 60, ["Monday"]);
    expect(capMap.get("Tuesday")).toBe(2);
  });

  test("buildDailyLoadMap with empty occupiedIntervals returns empty map (nothing pre-loaded)", () => {
    const loadMap = buildDailyLoadMap([], TIMEZONE, 60);
    expect(loadMap.size).toBe(0);
  });

  test("filterPoolForBlock respects fallback cap when workHoursGrid is empty", () => {
    const capMap = computeMaxBlocksPerDay([], 60, []); // all days non-preferred → cap 2
    const loadMap = new Map([["2025-01-06", 2]]); // Monday already at cap

    const pool: PoolSlot[] = [
      { startMs: MONDAY_9AM_UTC },   // Monday — at cap
      { startMs: TUESDAY_9AM_UTC },  // Tuesday — under cap
    ];

    const candidates = filterPoolForBlock({
      pool,
      dueDateMs: MONDAY_9AM_UTC + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      workHoursGrid: [],
      occupiedIntervals: [],
      timezone: TIMEZONE,
      dailyLoadMap: loadMap,
      maxBlocksPerDayMap: capMap,
    });

    expect(candidates.every((c) => c.startMs !== MONDAY_9AM_UTC)).toBe(true);
    expect(candidates.some((c) => c.startMs === TUESDAY_9AM_UTC)).toBe(true);
  });
});

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

describe("scheduleAllBlocks block filtering", () => {
  const TASK_ID = "task1";
  const OTHER_TASK_ID = "task2";
  const SUBTASK_ID = "sub1";
  const OTHER_SUBTASK_ID = "sub2";
  const subtaskIds = new Set([SUBTASK_ID]);

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
    const blocks = [
      { taskId: TASK_ID, startTime: "2026-04-01T10:00:00Z", isConflicted: false },
    ];
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
