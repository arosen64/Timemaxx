import { describe, expect, test } from "vitest";

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
