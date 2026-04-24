import { describe, expect, test } from "vitest";

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
