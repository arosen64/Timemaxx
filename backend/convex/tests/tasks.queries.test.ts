import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// Helper: create a task directly in the db for a given userId
async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  overrides: {
    title?: string;
    taskType?: string;
    dueDate?: number;
    createdAt?: number;
  } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: overrides.title ?? "Default task",
      description: "Test description",
      taskType: overrides.taskType ?? "Essay",
      dueDate: overrides.dueDate ?? Date.now() + 86_400_000,
      createdAt: overrides.createdAt ?? Date.now(),
      isManualEstimate: false,
    })
  );
}

describe("queries/tasks – getTask", () => {
  test("returns null when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const result = await t.query(api.queries.tasks.getTask, { taskId });
    expect(result).toBeNull();
  });

  test("returns the task for its owner", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { title: "My essay" });

    const result = await withAuth.query(api.queries.tasks.getTask, { taskId });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("My essay");
  });

  test("returns null when task belongs to a different user", async () => {
    const t = makeTestCtx();
    const { withAuth: user1Auth } = await createTestUser(t);
    const { userId: user2Id } = await createTestUser(t, { email: "other@example.com" });

    const taskId = await seedTask(t, user2Id, { title: "Other user task" });

    const result = await user1Auth.query(api.queries.tasks.getTask, { taskId });
    expect(result).toBeNull();
  });
});

describe("queries/tasks – getAllTasks", () => {
  test("returns empty array when unauthenticated", async () => {
    const t = makeTestCtx();
    const result = await t.query(api.queries.tasks.getAllTasks, {});
    expect(result).toEqual([]);
  });

  test("returns all tasks for the authenticated user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { title: "Task A" });
    await seedTask(t, userId, { title: "Task B" });

    const result = await withAuth.query(api.queries.tasks.getAllTasks, {});
    expect(result).toHaveLength(2);
  });

  test("does not return tasks belonging to other users", async () => {
    const t = makeTestCtx();
    const { userId: user1Id, withAuth } = await createTestUser(t);
    const { userId: user2Id } = await createTestUser(t, { email: "other@example.com" });

    await seedTask(t, user1Id, { title: "User 1 task" });
    await seedTask(t, user2Id, { title: "User 2 task" });

    const result = await withAuth.query(api.queries.tasks.getAllTasks, {});
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("User 1 task");
  });

  test("filters by taskType when provided", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { taskType: "Essay" });
    await seedTask(t, userId, { taskType: "Coding" });
    await seedTask(t, userId, { taskType: "Essay" });

    const result = await withAuth.query(api.queries.tasks.getAllTasks, {
      taskType: "Essay",
    });
    expect(result).toHaveLength(2);
    result.forEach((task) => expect(task.taskType).toBe("Essay"));
  });

  test("respects descending sort order (default)", async () => {
    const t = makeTestCtx();
    const now = Date.now();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { title: "Older", createdAt: now - 2000 });
    await seedTask(t, userId, { title: "Newer", createdAt: now - 1000 });

    const result = await withAuth.query(api.queries.tasks.getAllTasks, {
      sortOrder: "desc",
    });
    expect(result[0].title).toBe("Newer");
    expect(result[1].title).toBe("Older");
  });

  test("respects ascending sort order", async () => {
    const t = makeTestCtx();
    const now = Date.now();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { title: "Older", createdAt: now - 2000 });
    await seedTask(t, userId, { title: "Newer", createdAt: now - 1000 });

    const result = await withAuth.query(api.queries.tasks.getAllTasks, {
      sortOrder: "asc",
    });
    expect(result[0].title).toBe("Older");
    expect(result[1].title).toBe("Newer");
  });
});

describe("queries/tasks – getTasksPaginated", () => {
  test("returns null when unauthenticated", async () => {
    const t = makeTestCtx();
    const result = await t.query(api.queries.tasks.getTasksPaginated, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result).toBeNull();
  });

  test("returns paginated tasks for the authenticated user", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { title: "Task 1" });
    await seedTask(t, userId, { title: "Task 2" });
    await seedTask(t, userId, { title: "Task 3" });

    const result = await withAuth.query(api.queries.tasks.getTasksPaginated, {
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(result).not.toBeNull();
    expect(result!.page).toHaveLength(2);
    expect(typeof result!.isDone).toBe("boolean");
  });

  test("filters paginated results by taskType", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    await seedTask(t, userId, { taskType: "Coding" });
    await seedTask(t, userId, { taskType: "Essay" });
    await seedTask(t, userId, { taskType: "Coding" });

    const result = await withAuth.query(api.queries.tasks.getTasksPaginated, {
      paginationOpts: { numItems: 10, cursor: null },
      taskType: "Coding",
    });

    expect(result).not.toBeNull();
    expect(result!.page).toHaveLength(2);
    result!.page.forEach((task) => expect(task.taskType).toBe("Coding"));
  });
});
