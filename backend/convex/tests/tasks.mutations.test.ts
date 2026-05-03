import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../_generated/api";
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
  userId: string,
  taskId: string,
  opts: { googleEventId?: string; title?: string } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as Id<"tasks">,
      userId: userId as Id<"users">,
      title: opts.title ?? "Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
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
  userId: string,
  subtaskId: string,
  opts: { googleEventId?: string } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      subtaskId: subtaskId as Id<"subtasks">,
      userId: userId as Id<"users">,
      title: "Subtask Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
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
    await seedStudyBlock(t, userId, taskId);
    await seedStudyBlock(t, userId, taskId);

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
    await seedStudyBlock(t, userId, taskId1);
    await seedStudyBlock(t, userId, taskId2);

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
    await seedSubtaskStudyBlock(t, userId, subtaskId1, { googleEventId: "gcal-event-1" });
    await seedSubtaskStudyBlock(t, userId, subtaskId2, { googleEventId: "gcal-event-2" });
    // A subtask block without a googleEventId should not appear in the scheduled call
    await seedSubtaskStudyBlock(t, userId, subtaskId2);

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
    await seedStudyBlock(t, userId, taskId);
    await seedStudyBlock(t, userId, taskId);

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
    await seedSubtaskStudyBlock(t, userId, subtaskId);
    await seedSubtaskStudyBlock(t, userId, subtaskId);

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
    await seedStudyBlock(t, userId, taskId);
    await seedStudyBlock(t, userId, taskId);

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
    await seedSubtaskStudyBlock(t, userId, subtaskId);
    await seedSubtaskStudyBlock(t, userId, subtaskId);

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
    await seedStudyBlock(t, userId, taskId);

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
    const blockId = await seedStudyBlock(t, userId, taskId);

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

describe("mutations/tasks – patchTaskEmbedding ownership guard", () => {
  const EMBEDDING = Array.from({ length: 8 }, (_, i) => i * 0.1);

  test("patches embedding when userId matches task owner", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await t.mutation(internal.mutations.tasks.patchTaskEmbedding, {
      taskId,
      userId: userId as Id<"users">,
      embedding: EMBEDDING,
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task?.embedding).toEqual(EMBEDDING);
  });

  test("throws when userId does not own the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { userId: attackerId } = await createTestUser(t, { email: "attacker@example.com" });
    const taskId = await seedTask(t, userId);

    await expect(
      t.mutation(internal.mutations.tasks.patchTaskEmbedding, {
        taskId,
        userId: attackerId as Id<"users">,
        embedding: EMBEDDING,
      })
    ).rejects.toThrow("Task not found");
  });

  test("throws when taskId does not exist", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const nonExistentId = taskId;
    await t.run((ctx) => ctx.db.delete(taskId));

    await expect(
      t.mutation(internal.mutations.tasks.patchTaskEmbedding, {
        taskId: nonExistentId,
        userId: userId as Id<"users">,
        embedding: EMBEDDING,
      })
    ).rejects.toThrow("Task not found");
describe("mutations/tasks – updateTask title cascade", () => {
  test("updates study block titles when the task title changes", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId, { title: "Old title" });
    await seedStudyBlock(t, userId, taskId, { title: "Old title" });

    await withAuth.mutation(api.mutations.tasks.updateTask, {
      taskId,
      title: "New title",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.title === "New title")).toBe(true);
  });

  test("does not touch study blocks when the title is unchanged", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId, { title: "Test task" });

    await withAuth.mutation(api.mutations.tasks.updateTask, {
      taskId,
      title: "Test task",
      description: "updated desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks[0].title).toBe("Test task");
  });

  test("does not update blocks belonging to a different task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId1 = await seedTask(t, userId);
    const taskId2 = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId1, { title: "Old title" });
    await seedStudyBlock(t, userId, taskId2, { title: "Other task block" });

    await withAuth.mutation(api.mutations.tasks.updateTask, {
      taskId: taskId1,
      title: "New title",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
    });

    const otherBlocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId2))
        .collect()
    );
    expect(otherBlocks[0].title).toBe("Other task block");
  });
});

describe("mutations/tasks – patchTaskFieldsInternal title cascade", () => {
  test("updates study block titles when title changes via internal patch", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId, { title: "Old title" });
    await seedStudyBlock(t, userId, taskId, { title: "Old title" });

    await t.mutation(internal.mutations.tasks.patchTaskFieldsInternal, {
      userId: userId as Id<"users">,
      taskId,
      title: "AI-updated title",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.title === "AI-updated title")).toBe(true);
  });

  test("does not update study blocks when title is not provided", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId, { title: "Original" });

    await t.mutation(internal.mutations.tasks.patchTaskFieldsInternal, {
      userId: userId as Id<"users">,
      taskId,
      description: "New description only",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks[0].title).toBe("Original");
  });

  test("does not update study blocks when title is the same", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, userId, taskId, { title: "Test task" });

    await t.mutation(internal.mutations.tasks.patchTaskFieldsInternal, {
      userId: userId as Id<"users">,
      taskId,
      title: "Test task",
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks[0].title).toBe("Test task");
  });
});
