import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

describe("mutations/tasks – createTask", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    await expect(
      t.mutation(api.mutations.tasks.createTask, {
        title: "Unauthenticated task",
        description: "should fail",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("creates a task and returns its ID", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Finish problem set",
      description: "Complete all exercises",
      taskType: "Problem Set",
      dueDate: Date.now() + 86_400_000,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(taskId).toBeDefined();

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task).not.toBeNull();
    expect(task!.title).toBe("Finish problem set");
    expect(task!.description).toBe("Complete all exercises");
    expect(task!.taskType).toBe("Problem Set");
    expect(task!.timeEstimate).toBeUndefined();
    expect(typeof task!.createdAt).toBe("number");
  });

  test("stores the authenticated user's ID on the task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "My task",
      description: "desc",
      taskType: "Coding",
      dueDate: Date.now() + 86_400_000,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.userId).toBe(userId);
  });

  test("accepts all valid task types", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const dueDate = Date.now() + 86_400_000;

    const types = [
      "Essay",
      "Problem Set",
      "Exam Prep",
      "Coding",
      "Reading",
      "Lab",
      "Presentation",
    ] as const;

    for (const taskType of types) {
      const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
        title: `Task – ${taskType}`,
        description: "desc",
        taskType,
        dueDate,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const task = await t.run((ctx) => ctx.db.get(taskId));
      expect(task!.taskType).toBe(taskType);
    }
  });

  test("accepts custom task types", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Custom type task",
      description: "desc",
      taskType: "Take-home Quiz",
      dueDate: Date.now() + 86_400_000,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.taskType).toBe("Take-home Quiz");
  });
});
