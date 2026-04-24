import { describe, expect, test } from "vitest";

// Mirrors the sort comparator in actions/scheduleAllTasks.ts.
// If the comparator changes, update this too.
function sortForScheduling(
  a: { dueDate: number; assignmentWeight?: number; _creationTime: number },
  b: { dueDate: number; assignmentWeight?: number; _creationTime: number },
) {
  return (
    a.dueDate - b.dueDate ||
    (b.assignmentWeight ?? 0) - (a.assignmentWeight ?? 0) ||
    a._creationTime - b._creationTime
  );
}

const BASE = 1_000_000;

describe("scheduleAllTasks sort order", () => {
  test("earlier due date sorts first", () => {
    const tasks = [
      { dueDate: BASE + 2000, assignmentWeight: 10, _creationTime: 1 },
      { dueDate: BASE + 1000, assignmentWeight: 10, _creationTime: 2 },
    ];
    tasks.sort(sortForScheduling);
    expect(tasks[0].dueDate).toBe(BASE + 1000);
  });

  test("same due date: higher assignmentWeight sorts first", () => {
    const tasks = [
      { dueDate: BASE, assignmentWeight: 20, _creationTime: 1 },
      { dueDate: BASE, assignmentWeight: 50, _creationTime: 2 },
    ];
    tasks.sort(sortForScheduling);
    expect(tasks[0].assignmentWeight).toBe(50);
  });

  test("same due date + same weight: earlier _creationTime sorts first", () => {
    const tasks = [
      { dueDate: BASE, assignmentWeight: 30, _creationTime: 200 },
      { dueDate: BASE, assignmentWeight: 30, _creationTime: 100 },
    ];
    tasks.sort(sortForScheduling);
    expect(tasks[0]._creationTime).toBe(100);
  });

  test("task without assignmentWeight (undefined) sorts after weighted task with same due date", () => {
    const tasks = [
      { dueDate: BASE, assignmentWeight: undefined, _creationTime: 1 },
      { dueDate: BASE, assignmentWeight: 10, _creationTime: 2 },
    ];
    tasks.sort(sortForScheduling);
    expect(tasks[0].assignmentWeight).toBe(10);
  });

  test("due date takes priority over assignmentWeight", () => {
    const tasks = [
      { dueDate: BASE + 1000, assignmentWeight: 100, _creationTime: 1 },
      { dueDate: BASE, assignmentWeight: 0, _creationTime: 2 },
    ];
    tasks.sort(sortForScheduling);
    expect(tasks[0].dueDate).toBe(BASE);
  });
});
