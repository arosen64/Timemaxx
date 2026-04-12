import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

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
      })
    );

    const taskBlockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as never,
        title: "Task block",
        studyBlockLength: 60,
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
