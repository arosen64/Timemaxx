import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

// Helper: seed a task directly in the db
async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string
) {
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

// Helper: seed a study block directly in the db
async function seedStudyBlock(
  t: ReturnType<typeof makeTestCtx>,
  taskId: string,
  overrides: { title?: string; startTime?: string; studyBlockLength?: number } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as any,
      title: overrides.title ?? "Block 1",
      startTime: overrides.startTime,
      studyBlockLength: overrides.studyBlockLength ?? 60,
    })
  );
}

// ─── googleEventId field ─────────────────────────────────────────────────────

describe("studyBlocks schema – googleEventId field", () => {
  test("googleEventId is undefined on a newly created block", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const blockId = await withAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
      taskId,
      title: "Block",
      studyBlockLength: 60,
    });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.googleEventId).toBeUndefined();
  });

  test("existing block without googleEventId is unaffected when other fields are updated", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);
    const newStart = new Date(Date.now() + 3600_000).toISOString();

    await withAuth.mutation(api.mutations.studyBlocks.editStudyBlockTime, {
      studyBlockId,
      startTime: newStart,
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.startTime).toBe(newStart);
    expect(block!.googleEventId).toBeUndefined();
  });
});

// ─── createStudyBlock ────────────────────────────────────────────────────────

describe("mutations/studyBlocks – createStudyBlock", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(
      t.mutation(api.mutations.studyBlocks.createStudyBlock, {
        taskId,
        title: "Block",
        studyBlockLength: 60,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when user does not own the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);

    await expect(
      otherAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
        taskId,
        title: "Block",
        studyBlockLength: 60,
      })
    ).rejects.toThrow("Unauthorized");
  });

  test("creates a block with no startTime (defaults to undefined)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const blockId = await withAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
      taskId,
      title: "Study session",
      studyBlockLength: 90,
    });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block).not.toBeNull();
    expect(block!.title).toBe("Study session");
    expect(block!.studyBlockLength).toBe(90);
    expect(block!.startTime).toBeUndefined();
  });

  test("creates a block with a startTime when provided", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const start = new Date(Date.now() + 3600_000).toISOString();

    const blockId = await withAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
      taskId,
      title: "Scheduled block",
      studyBlockLength: 60,
      startTime: start,
    });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.startTime).toBe(start);
  });
});

// ─── createTaskBlocks ────────────────────────────────────────────────────────

describe("mutations/studyBlocks – createTaskBlocks", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(
      t.mutation(api.mutations.studyBlocks.createTaskBlocks, {
        taskId,
        blocks: [{ title: "B1", studyBlockLength: 60 }],
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("inserts all blocks when none exist for the task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await withAuth.mutation(api.mutations.studyBlocks.createTaskBlocks, {
      taskId,
      blocks: [
        { title: "Block A", studyBlockLength: 60 },
        { title: "Block B", studyBlockLength: 45 },
      ],
    });

    const blocks = await t.run((ctx) =>
      ctx.db.query("studyBlocks").collect()
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.startTime === undefined)).toBe(true);
  });

  test("skips insertion when blocks already exist for the task (idempotent)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.studyBlocks.createTaskBlocks, {
      taskId,
      blocks: [{ title: "New block", studyBlockLength: 60 }],
    });

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(1); // still only the seeded block
  });
});

// ─── deleteStudyBlock ────────────────────────────────────────────────────────

describe("mutations/studyBlocks – deleteStudyBlock", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await expect(
      t.mutation(api.mutations.studyBlocks.deleteStudyBlock, { studyBlockId })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when user does not own the parent task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await expect(
      otherAuth.mutation(api.mutations.studyBlocks.deleteStudyBlock, { studyBlockId })
    ).rejects.toThrow("Unauthorized");
  });

  test("deletes the study block", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await withAuth.mutation(api.mutations.studyBlocks.deleteStudyBlock, { studyBlockId });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block).toBeNull();
  });
});

// ─── editStudyBlockTime ──────────────────────────────────────────────────────

describe("mutations/studyBlocks – editStudyBlockTime", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await expect(
      t.mutation(api.mutations.studyBlocks.editStudyBlockTime, {
        studyBlockId,
        startTime: new Date(Date.now() + 3600_000).toISOString(),
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when user does not own the parent task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await expect(
      otherAuth.mutation(api.mutations.studyBlocks.editStudyBlockTime, {
        studyBlockId,
        startTime: new Date(Date.now() + 3600_000).toISOString(),
      })
    ).rejects.toThrow("Unauthorized");
  });

  test("updates startTime on the block", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);
    const newStart = new Date(Date.now() + 7200_000).toISOString();

    await withAuth.mutation(api.mutations.studyBlocks.editStudyBlockTime, {
      studyBlockId,
      startTime: newStart,
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.startTime).toBe(newStart);
  });

  test("sets startTime to undefined when null is passed (unschedule)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { startTime: new Date(Date.now() + 3600_000).toISOString() });

    await withAuth.mutation(api.mutations.studyBlocks.editStudyBlockTime, {
      studyBlockId,
      startTime: null,
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.startTime).toBeUndefined();
  });
});
