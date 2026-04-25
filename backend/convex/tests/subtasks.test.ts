import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const makeReasoning = () => ({
  classes: "Course context.",
  tasks: "Prior tasks context.",
  chats: "Chat context.",
  profile: "Profile context.",
});

const FUTURE = Date.now() + 86_400_000;

async function seedTask(t: ReturnType<typeof makeTestCtx>, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as never,
      title: "Parent Task",
      description: "desc",
      taskType: "Essay",
      dueDate: FUTURE,
      isManualEstimate: false,
      createdAt: Date.now(),
    })
  );
}

async function seedSubtask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  parentTaskId: string,
  order = 0
) {
  return t.run((ctx) =>
    ctx.db.insert("subtasks", {
      parentTaskId: parentTaskId as never,
      userId: userId as never,
      title: "Subtask",
      description: "desc",
      taskType: "Essay",
      color: "#2563eb",
      order,
      createdAt: Date.now(),
    })
  );
}

// ─── createSubtask ────────────────────────────────────────────────────────────

describe("mutations/subtasks – createSubtask", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("creates a subtask with valid input and returns its ID", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);

    const subtaskId = await withAuth.mutation(
      api.mutations.subtasks.createSubtask,
      {
        parentTaskId,
        title: "Write intro",
        description: "Draft the introduction section",
        taskType: "Essay",
        color: "#2563eb",
        order: 0,
      }
    );

    const record = await t.run((ctx) => ctx.db.get(subtaskId));
    expect(record).not.toBeNull();
    expect(record!.title).toBe("Write intro");
    expect(record!.parentTaskId).toBe(parentTaskId);
    expect(record!.userId).toBe(userId);
  });

  test("clears parent task reasoning when a subtask is created", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);
    await t.run((ctx) =>
      ctx.db.patch(parentTaskId, {
        reasoning: makeReasoning(),
      })
    );

    await withAuth.mutation(api.mutations.subtasks.createSubtask, {
      parentTaskId,
      title: "Write intro",
      description: "Draft the introduction section",
      taskType: "Essay",
      color: "#2563eb",
      order: 0,
    });

    const parent = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(parent!.reasoning).toBeUndefined();
  });

  test("throws when parent task does not belong to the user", async () => {
    const t = makeTestCtx();
    const { withAuth } = await createTestUser(t);
    const { userId: otherUserId } = await createTestUser(t);
    const otherTaskId = await seedTask(t, otherUserId);

    await expect(
      withAuth.mutation(api.mutations.subtasks.createSubtask, {
        parentTaskId: otherTaskId,
        title: "Sneaky subtask",
        description: "desc",
        taskType: "Essay",
        color: "#2563eb",
        order: 0,
      })
    ).rejects.toThrow("Parent task not found");
  });

  test("throws when title is empty", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);

    await expect(
      withAuth.mutation(api.mutations.subtasks.createSubtask, {
        parentTaskId,
        title: "   ",
        description: "desc",
        taskType: "Essay",
        color: "#2563eb",
        order: 0,
      })
    ).rejects.toThrow("Title cannot be empty");
  });

  test("schedules generateSubtaskEmbedding after createSubtask", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);

    await withAuth.mutation(api.mutations.subtasks.createSubtask, {
      parentTaskId,
      title: "Write intro",
      description: "Draft the introduction section",
      taskType: "Essay",
      color: "#2563eb",
      order: 0,
    });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    const embeddingJob = scheduled.find((f) =>
      f.name.includes("generateSubtaskEmbedding")
    );
    expect(embeddingJob).toBeDefined();
    const args = (embeddingJob!.args as [{ title: string; description: string }])[0];
    expect(args.title).toBe("Write intro");
    expect(args.description).toBe("Draft the introduction section");
  });
});

// ─── updateSubtask ────────────────────────────────────────────────────────────

describe("mutations/subtasks – updateSubtask", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("schedules generateSubtaskEmbedding after updateSubtask", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, userId, parentTaskId);

    await withAuth.mutation(api.mutations.subtasks.updateSubtask, {
      subtaskId,
      title: "Revised intro",
      description: "Updated draft",
      taskType: "Essay",
    });

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    const embeddingJob = scheduled.find((f) =>
      f.name.includes("generateSubtaskEmbedding")
    );
    expect(embeddingJob).toBeDefined();
    const args = (embeddingJob!.args as [{ title: string; description: string }])[0];
    expect(args.title).toBe("Revised intro");
    expect(args.description).toBe("Updated draft");
  });
});

// ─── setSubtaskTimeEstimate (internal) ────────────────────────────────────────

describe("mutations/subtasks – setSubtaskTimeEstimate", () => {
  test("persists reasoning on the subtask and rolls up parent time", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, userId, parentTaskId);

    await t.mutation(internal.mutations.subtasks.setSubtaskTimeEstimate, {
      subtaskId,
      timeEstimate: 45,
      reasoning: makeReasoning(),
    });

    const subtask = await t.run((ctx) => ctx.db.get(subtaskId));
    expect(subtask!.timeEstimate).toBe(45);
    expect(subtask!.reasoning).toEqual(makeReasoning());

    const parent = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(parent!.timeEstimate).toBe(45);
  });
});

// ─── deleteSubtask ────────────────────────────────────────────────────────────

describe("mutations/subtasks – deleteSubtask", () => {
  test("deletes the subtask and its study blocks", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, userId, parentTaskId);

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId: subtaskId as never,
        title: "Block",
        studyBlockLength: 30,
        isCompleted: false,
      })
    );

    await withAuth.mutation(api.mutations.subtasks.deleteSubtask, {
      subtaskId,
    });

    expect(await t.run((ctx) => ctx.db.get(subtaskId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(blockId))).toBeNull();
  });

  test("throws when subtask belongs to a different user", async () => {
    const t = makeTestCtx();
    const { userId: ownerUserId } = await createTestUser(t);
    const { withAuth: attackerAuth } = await createTestUser(t);
    const parentTaskId = await seedTask(t, ownerUserId);
    const subtaskId = await seedSubtask(t, ownerUserId, parentTaskId);

    await expect(
      attackerAuth.mutation(api.mutations.subtasks.deleteSubtask, { subtaskId })
    ).rejects.toThrow("Subtask not found");
  });
});

// ─── deleteTask cascade ───────────────────────────────────────────────────────

describe("mutations/tasks – deleteTask cascade", () => {
  test("deletes subtasks and their study blocks when parent task is deleted", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const subtaskId = await seedSubtask(t, userId, taskId);

    const subtaskBlockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId: subtaskId as never,
        title: "Subtask block",
        studyBlockLength: 30,
        isCompleted: false,
      })
    );

    const taskBlockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as never,
        title: "Task block",
        studyBlockLength: 60,
        isCompleted: false,
      })
    );

    await withAuth.mutation(api.mutations.tasks.deleteTask, { taskId });

    expect(await t.run((ctx) => ctx.db.get(taskId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(subtaskId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(subtaskBlockId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(taskBlockId))).toBeNull();
  });
});

// ─── deleteUserCourse cascade ─────────────────────────────────────────────────

describe("mutations/userCourses – deleteUserCourse cascade", () => {
  test("deletes subtasks linked to course tasks when course is deleted", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);

    const userCourseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as never,
        courseCode: "EN.601.226.FA25",
        title: "Data Structures",
        term: "Fall 2025",
      })
    );

    const taskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as never,
        title: "HW1",
        description: "d",
        taskType: "Problem Set",
        dueDate: FUTURE,
        isManualEstimate: false,
        createdAt: Date.now(),
        courseId: userCourseId,
      })
    );

    const subtaskId = await seedSubtask(t, userId, taskId);

    const subtaskBlockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId: subtaskId as never,
        title: "Block",
        studyBlockLength: 30,
        isCompleted: false,
      })
    );

    await withAuth.mutation(api.mutations.userCourses.deleteUserCourse, {
      userCourseId,
    });

    expect(await t.run((ctx) => ctx.db.get(userCourseId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(taskId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(subtaskId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(subtaskBlockId))).toBeNull();
  });
});
