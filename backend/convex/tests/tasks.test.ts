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

  test("stores optional classTag when provided", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Tagged task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      classTag: "EN.601.220",
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.classTag).toBe("EN.601.220");
  });

  test("omits classTag when whitespace-only", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "No tag task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      classTag: "   ",
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.classTag).toBeUndefined();
  });

  test("stores assignmentWeight when provided", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Weighted assignment",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      assignmentWeight: 20,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.assignmentWeight).toBe(20);
  });

  test("assignmentWeight is undefined when not provided", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "No weight task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.assignmentWeight).toBeUndefined();
  });

  test("recommendedStart is undefined when no timeEstimate is provided", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const dueDate = Date.now() + 30 * 86_400_000;

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Task without estimate",
      description: "desc",
      taskType: "Essay",
      dueDate,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.recommendedStart).toBeUndefined();
  });

  test("recommendedStart is computed from timeEstimate when provided", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const now = Date.now();
    // 30 days out; 240 min estimate = ceil(240/120)=2 days needed → dueDate - 2 days
    const dueDate = now + 30 * 86_400_000;
    const timeEstimate = 240;

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Task with estimate",
      description: "desc",
      taskType: "Essay",
      dueDate,
      timeEstimate,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    const DAY_MS = 24 * 60 * 60 * 1000;
    expect(task!.recommendedStart).toBe(dueDate - 2 * DAY_MS);
  });

  test("recommendedStart is clamped to now when estimate exceeds available window", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    vi.setSystemTime(new Date("2026-04-25T12:00:00Z"));
    try {
      const now = Date.now();
      // Due in 3 days, but 1200 min estimate = ceil(1200/120)=10 days needed → clamp to now
      const dueDate = now + 3 * 86_400_000;
      const timeEstimate = 1200;

      const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
        title: "Big task tight deadline",
        description: "desc",
        taskType: "Problem Set",
        dueDate,
        timeEstimate,
      });

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const task = await t.run((ctx) => ctx.db.get(taskId));
      expect(task!.recommendedStart).toBe(now);
    } finally {
      vi.useRealTimers();
    }
  });

  test("recomputes recommendedStart using existing estimate when dueDate is updated", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const originalDue = Date.now() + 30 * 86_400_000;

    const taskId = await withAuth.mutation(api.mutations.tasks.createTask, {
      title: "Rescheduled task",
      description: "desc",
      taskType: "Essay",
      dueDate: originalDue,
      timeEstimate: 240,
    });

    const newDue = Date.now() + 60 * 86_400_000;
    await withAuth.mutation(api.mutations.tasks.updateTask, {
      taskId,
      title: "Rescheduled task",
      description: "desc",
      taskType: "Essay",
      dueDate: newDue,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const task = await t.run((ctx) => ctx.db.get(taskId));
    const DAY_MS = 24 * 60 * 60 * 1000;
    // timeEstimate=240 → daysNeeded=2 → recommendedStart = newDue - 2 days
    expect(task!.recommendedStart).toBe(newDue - 2 * DAY_MS);
  });

  test("throws when assignmentWeight is out of range", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);

    await expect(
      withAuth.mutation(api.mutations.tasks.createTask, {
        title: "Bad weight",
        description: "desc",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        assignmentWeight: 150,
      })
    ).rejects.toThrow("Assignment weight must be between 0 and 100");
  });
});
