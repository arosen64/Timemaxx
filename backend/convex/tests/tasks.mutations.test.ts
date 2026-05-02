import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";
import type { Id } from "../_generated/dataModel";

async function seedTask(t: ReturnType<typeof makeTestCtx>, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as Id<"users">,
      title: "Test task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      createdAt: Date.now(),
      isManualEstimate: false,
      status: "not_started",
    })
  );
}

async function seedStudyBlock(
  t: ReturnType<typeof makeTestCtx>,
  taskId: string,
  opts: { googleEventId?: string; userId?: string } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as Id<"tasks">,
      title: "Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
      ...(opts.userId ? { userId: opts.userId as Id<"users"> } : {}),
      ...(opts.googleEventId ? { googleEventId: opts.googleEventId } : {}),
    })
  );
}

async function seedSubtask(t: ReturnType<typeof makeTestCtx>, taskId: string, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert("subtasks", {
      parentTaskId: taskId as Id<"tasks">,
      userId: userId as Id<"users">,
      title: "Subtask",
      description: "desc",
      taskType: "Essay",
      color: "#ffffff",
      order: 0,
      createdAt: Date.now(),
      status: "not_started",
    })
  );
}

async function seedSubtaskStudyBlock(
  t: ReturnType<typeof makeTestCtx>,
  subtaskId: string,
  opts: { googleEventId?: string; userId?: string } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      subtaskId: subtaskId as Id<"subtasks">,
      title: "Subtask Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
      ...(opts.userId ? { userId: opts.userId as Id<"users"> } : {}),
      ...(opts.googleEventId ? { googleEventId: opts.googleEventId } : {}),
    })
  );
}

describe("mutations/tasks – deleteTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(t.mutation(api.mutations.tasks.deleteTask, { taskId })).rejects.toThrow(
      "Unauthenticated"
    );
  });

  test("throws when user does not own the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);

    await expect(otherAuth.mutation(api.mutations.tasks.deleteTask, { taskId })).rejects.toThrow(
      "Task not found"
    );
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

  test("schedules GCal deletion for googleEventIds on subtask study blocks", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const subtaskId1 = await seedSubtask(t, taskId, userId);
    const subtaskId2 = await seedSubtask(t, taskId, userId);
    await seedSubtaskStudyBlock(t, subtaskId1, { googleEventId: "gcal-event-1" });
    await seedSubtaskStudyBlock(t, subtaskId2, { googleEventId: "gcal-event-2" });
    // A subtask block without a googleEventId should not appear in the scheduled call
    await seedSubtaskStudyBlock(t, subtaskId2);

    await withAuth.mutation(api.mutations.tasks.deleteTask, { taskId });

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());

    const calDeletion = scheduled.find((f) => f.name.includes("deleteLinkedCalendarEvents"));
    expect(calDeletion).toBeDefined();
    // convex-test stores scheduled function args as [parsedArgs]
    const { googleEventIds } = (
      calDeletion!.args as [{ userId: string; googleEventIds: string[] }]
    )[0];
    expect(googleEventIds).toHaveLength(2);
    expect(googleEventIds).toContain("gcal-event-1");
    expect(googleEventIds).toContain("gcal-event-2");
  });
});

describe("mutations/tasks – updateTaskStatus study block sync", () => {
  test("completing a task marks all task-level study blocks as completed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);
    await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "completed",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks.every((b) => b.isCompleted)).toBe(true);
  });

  test("completing a task marks all subtask-level study blocks as completed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, taskId, userId);
    await seedSubtaskStudyBlock(t, subtaskId, { userId });
    await seedSubtaskStudyBlock(t, subtaskId, { userId });

    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "completed",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks.every((b) => b.isCompleted)).toBe(true);
  });

  test("reopening a task as not_started unmarks all task-level study blocks", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);
    await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, { taskId, status: "completed" });
    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "not_started",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks.every((b) => !b.isCompleted)).toBe(true);
  });

  test("reopening a task as not_started unmarks all subtask-level study blocks", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, taskId, userId);
    await seedSubtaskStudyBlock(t, subtaskId, { userId });
    await seedSubtaskStudyBlock(t, subtaskId, { userId });

    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, { taskId, status: "completed" });
    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "not_started",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks.every((b) => !b.isCompleted)).toBe(true);
  });

  test("setting task to in_progress does not change study block completion state", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, { taskId, status: "completed" });
    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "in_progress",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks.every((b) => b.isCompleted)).toBe(true);
  });

  test("toggling the only block after completed→in_progress reopen sets task to not_started", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const blockId = await seedStudyBlock(t, taskId, { userId });

    // Complete the task (marks block isCompleted: true)
    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, { taskId, status: "completed" });
    // Reopen to in_progress (block stays isCompleted: true)
    await withAuth.mutation(api.mutations.tasks.updateTaskStatus, {
      taskId,
      status: "in_progress",
    });
    // Toggle the block to uncomplete it
    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.isCompleted).toBe(false);
    expect(task!.status).toBe("not_started");
  });
});
