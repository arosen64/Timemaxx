import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string
) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: "Test task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      createdAt: Date.now(),
      isManualEstimate: false,
    })
  );
}

async function seedStudyBlock(
  t: ReturnType<typeof makeTestCtx>,
  taskId: string,
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as any,
      title: "Block",
      studyBlockLength: 60,
    })
  );
}

describe("mutations/tasks – deleteTask", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(
      t.mutation(api.mutations.tasks.deleteTask, { taskId })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when user does not own the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);

    await expect(
      otherAuth.mutation(api.mutations.tasks.deleteTask, { taskId })
    ).rejects.toThrow("Task not found");
  });

  test("deletes a task with no study blocks", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await withAuth.mutation(api.mutations.tasks.deleteTask, { taskId });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task).toBeNull();
  });

  test("deletes all associated study blocks before deleting the task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);
    await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.tasks.deleteTask, { taskId });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task).toBeNull();

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(0);
  });

  test("only deletes study blocks belonging to the deleted task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId1 = await seedTask(t, userId);
    const taskId2 = await seedTask(t, userId);
    await seedStudyBlock(t, taskId1);
    await seedStudyBlock(t, taskId2);

    await withAuth.mutation(api.mutations.tasks.deleteTask, { taskId: taskId1 });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(1);
    expect(blocks[0].taskId).toBe(taskId2);
  });
});
