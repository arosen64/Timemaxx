import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

async function seedTask(t: ReturnType<typeof makeTestCtx>, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: "Test task",
      description: "Test description",
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
  overrides: {
    title?: string;
    startTime?: string;
    studyBlockLength?: number;
    isCompleted?: boolean;
  } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as any,
      title: overrides.title ?? "Block 1",
      startTime: overrides.startTime,
      studyBlockLength: overrides.studyBlockLength ?? 60,
      isCompleted: overrides.isCompleted ?? false,
    })
  );
}

// ─── getStudyBlocksByTask ────────────────────────────────────────────────────

describe("queries/studyBlocks – getStudyBlocksByTask", () => {
  test("returns empty array when no blocks exist for the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const result = await t.query(api.queries.studyBlocks.getStudyBlocksByTask, { taskId });
    expect(result).toEqual([]);
  });

  test("returns all blocks for the given task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId, { title: "Block A" });
    await seedStudyBlock(t, taskId, { title: "Block B" });

    const result = await t.query(api.queries.studyBlocks.getStudyBlocksByTask, { taskId });
    expect(result).toHaveLength(2);
    const titles = result.map((b) => b.title);
    expect(titles).toContain("Block A");
    expect(titles).toContain("Block B");
  });

  test("does not return blocks belonging to a different task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId1 = await seedTask(t, userId);
    const taskId2 = await seedTask(t, userId);
    await seedStudyBlock(t, taskId1, { title: "Task 1 block" });
    await seedStudyBlock(t, taskId2, { title: "Task 2 block" });

    const result = await t.query(api.queries.studyBlocks.getStudyBlocksByTask, { taskId: taskId1 });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Task 1 block");
  });
});

// ─── getStudyBlockById ───────────────────────────────────────────────────────

describe("queries/studyBlocks – getStudyBlockById", () => {
  test("returns the study block when it exists", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { title: "My block" });

    const result = await t.query(api.queries.studyBlocks.getStudyBlockById, { studyBlockId });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("My block");
  });

  test("returns null when the study block does not exist", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    // Delete it so we can test the not-found path
    await t.run((ctx) => ctx.db.delete(studyBlockId));

    const result = await t.query(api.queries.studyBlocks.getStudyBlockById, { studyBlockId });
    expect(result).toBeNull();
  });
});

// ─── getFutureStudyBlocksForExport ───────────────────────────────────────────

describe("queries/studyBlocks – getFutureStudyBlocksForExport", () => {
  test("returns empty array when user has no tasks", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toEqual([]);
  });

  test("skips blocks with no startTime", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId); // no startTime

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(0);
  });

  test("skips blocks whose startTime is in the past", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const pastStart = new Date(Date.now() - 3600_000).toISOString();
    await seedStudyBlock(t, taskId, { startTime: pastStart });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(0);
  });

  test("returns future blocks with correct fields", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    await seedStudyBlock(t, taskId, {
      title: "Future block",
      startTime: futureStart,
      studyBlockLength: 90,
      isCompleted: false,
    });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Future block");
    expect(result[0].startTime).toBe(futureStart);
    expect(result[0].studyBlockLength).toBe(90);
    expect(result[0].googleEventId).toBeUndefined();
  });

  test("includes googleEventId when already set", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        title: "Exported block",
        startTime: futureStart,
        studyBlockLength: 60,
        googleEventId: "existing_gcal_event",
        isCompleted: false,
      })
    );

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].googleEventId).toBe("existing_gcal_event");
  });

  test("returns only future blocks when a task has a mix of past, unscheduled, and future blocks", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 7200_000).toISOString();
    await seedStudyBlock(t, taskId, { title: "Unscheduled" }); // no startTime
    await seedStudyBlock(t, taskId, {
      title: "Past",
      startTime: new Date(Date.now() - 3600_000).toISOString(),
    });
    await seedStudyBlock(t, taskId, {
      title: "Future",
      startTime: futureStart,
      isCompleted: false,
    });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Future");
  });

  test("includes courseName when the task has an associated course", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const courseId = await t.run((ctx) =>
      ctx.db.insert("userCourses", {
        userId: userId as any,
        courseCode: "EN.601.315",
        title: "Databases",
        term: "Fall 2025",
      })
    );
    const taskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as any,
        title: "HW6",
        description: "Database homework",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        courseId: courseId as any,
      })
    );
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    await seedStudyBlock(t, taskId, { startTime: futureStart, isCompleted: false });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseName).toBe("Databases");
  });

  test("courseName is undefined when the task has no associated course", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    await seedStudyBlock(t, taskId, { startTime: futureStart, isCompleted: false });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: userId as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].courseName).toBeUndefined();
  });

  test("does not return blocks belonging to another user", async () => {
    const t = makeTestCtx();
    const { userId: aliceId } = await createTestUser(t, { email: "alice@example.com" });
    const { userId: bobId } = await createTestUser(t, { email: "bob@example.com" });
    const aliceTaskId = await seedTask(t, aliceId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    await seedStudyBlock(t, aliceTaskId, { startTime: futureStart });

    const result = await t.query(internal.queries.studyBlocks.getFutureStudyBlocksForExport, {
      userId: bobId as any,
    });
    expect(result).toHaveLength(0);
  });
});

// ─── getAllStudyBlocksWithTasksInternal (taskRecommendedStart) ────────────────

describe("queries/studyBlocks – getAllStudyBlocksWithTasksInternal taskRecommendedStart", () => {
  test("includes taskRecommendedStart when the task has recommendedStart set", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const dueDate = Date.now() + 30 * 86_400_000;
    const recommendedStart = dueDate - 14 * 24 * 60 * 60 * 1000;

    const taskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as any,
        title: "Task with recommended start",
        description: "desc",
        taskType: "Essay",
        dueDate,
        recommendedStart: recommendedStart,
        createdAt: Date.now(),
        isManualEstimate: false,
      })
    );
    await seedStudyBlock(t, taskId);

    const result = await t.query(internal.queries.studyBlocks.getAllStudyBlocksWithTasksInternal, {
      userId: userId as any,
    });

    expect(result).toHaveLength(1);
    expect(result[0].taskRecommendedStart).toBe(recommendedStart);
  });

  test("returns taskRecommendedStart as undefined when task has no recommendedStart", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);

    const result = await t.query(internal.queries.studyBlocks.getAllStudyBlocksWithTasksInternal, {
      userId: userId as any,
    });

    expect(result).toHaveLength(1);
    expect(result[0].taskRecommendedStart).toBeUndefined();
  });
});
