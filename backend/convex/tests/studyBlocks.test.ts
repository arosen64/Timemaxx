import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
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
      isCompleted: false,
    })
  );
}

// Helper: seed a subtask and a study block linked to it (no taskId)
async function seedSubtaskBlock(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  overrides: { studyBlockLength?: number } = {}
) {
  const parentTaskId = await t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: "Parent task",
      description: "",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      createdAt: Date.now(),
      isManualEstimate: false,
    })
  );
  const subtaskId = await t.run((ctx) =>
    ctx.db.insert("subtasks", {
      parentTaskId: parentTaskId as any,
      userId: userId as any,
      title: "Sub task",
      description: "",
      taskType: "Essay",
      color: "#000000",
      order: 0,
      createdAt: Date.now(),
    })
  );
  const studyBlockId = await t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      subtaskId: subtaskId as any,
      userId: userId as any,
      title: "Subtask block",
      studyBlockLength: overrides.studyBlockLength ?? 90,
      isCompleted: false,
    })
  );
  return { subtaskId, studyBlockId };
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

  test("throws when studyBlockLength is below 15 minutes", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(
      withAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
        taskId,
        title: "Too short",
        studyBlockLength: 14,
      })
    ).rejects.toThrow("Study block length must be at least 15 minutes");
  });

  test("accepts a block at the minimum 15-minute length", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const blockId = await withAuth.mutation(api.mutations.studyBlocks.createStudyBlock, {
      taskId,
      title: "Min block",
      studyBlockLength: 15,
    });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.studyBlockLength).toBe(15);
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

  test("throws when any block has studyBlockLength below 15 minutes", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    await expect(
      withAuth.mutation(api.mutations.studyBlocks.createTaskBlocks, {
        taskId,
        blocks: [
          { title: "Valid block", studyBlockLength: 60 },
          { title: "Too short", studyBlockLength: 10 },
        ],
      })
    ).rejects.toThrow("Study block length must be at least 15 minutes");

    const blocks = await t.run((ctx) => ctx.db.query("studyBlocks").collect());
    expect(blocks).toHaveLength(0);
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

// ─── splitStudyBlock ─────────────────────────────────────────────────────────

describe("mutations/studyBlocks – splitStudyBlock", () => {
  test("throws when unauthenticated", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 90 });

    await expect(
      t.mutation(api.mutations.studyBlocks.splitStudyBlock, {
        studyBlockId,
        splitAtMinutes: 45,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("throws when user does not own the parent task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 90 });

    await expect(
      otherAuth.mutation(api.mutations.studyBlocks.splitStudyBlock, {
        studyBlockId,
        splitAtMinutes: 45,
      })
    ).rejects.toThrow("Unauthorized");
  });

  test("throws when split point would produce a block shorter than 15 minutes", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 45 });

    await expect(
      withAuth.mutation(api.mutations.studyBlocks.splitStudyBlock, {
        studyBlockId,
        splitAtMinutes: 10,
      })
    ).rejects.toThrow("Each resulting block must be at least 15 minutes");
  });

  test("throws when remainder would be shorter than 15 minutes", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 45 });

    await expect(
      withAuth.mutation(api.mutations.studyBlocks.splitStudyBlock, {
        studyBlockId,
        splitAtMinutes: 35,
      })
    ).rejects.toThrow("Each resulting block must be at least 15 minutes");
  });

  test("deletes original block and creates two blocks with correct lengths", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 90 });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 45 }
    );

    const original = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(original).toBeNull();

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    expect(blockA!.studyBlockLength).toBe(45);
    expect(blockB!.studyBlockLength).toBe(45);
  });

  test("floors fractional splitAtMinutes before splitting", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 89 });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 44.9 }
    );

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    expect(blockA!.studyBlockLength).toBe(44);
    expect(blockB!.studyBlockLength).toBe(45);
  });

  test("block A inherits original startTime; block B gets offset startTime", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const startTime = new Date(Date.now() + 3600_000).toISOString();
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 90, startTime });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 45 }
    );

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    expect(blockA!.startTime).toBe(startTime);
    const expectedStartB = new Date(new Date(startTime).getTime() + 45 * 60 * 1000).toISOString();
    expect(blockB!.startTime).toBe(expectedStartB);
  });

  test("block B has undefined startTime when original block is unplaced", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, { studyBlockLength: 90 });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 45 }
    );

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    expect(blockA!.startTime).toBeUndefined();
    expect(blockB!.startTime).toBeUndefined();
  });

  test("both blocks inherit taskId, userId, and title from original", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId, {
      title: "Study session",
      studyBlockLength: 90,
    });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 45 }
    );

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    for (const block of [blockA, blockB]) {
      expect(block!.taskId).toBe(taskId);
      expect(block!.userId).toBe(userId);
      expect(block!.title).toBe("Study session");
    }
  });

  test("succeeds and returns two blocks when block is owned via subtaskId", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { subtaskId, studyBlockId } = await seedSubtaskBlock(t, userId, { studyBlockLength: 90 });

    const { blockAId, blockBId } = await withAuth.mutation(
      api.mutations.studyBlocks.splitStudyBlock,
      { studyBlockId, splitAtMinutes: 45 }
    );

    const blockA = await t.run((ctx) => ctx.db.get(blockAId));
    const blockB = await t.run((ctx) => ctx.db.get(blockBId));

    expect(blockA!.subtaskId).toBe(subtaskId);
    expect(blockB!.subtaskId).toBe(subtaskId);
    expect(blockA!.studyBlockLength).toBe(45);
    expect(blockB!.studyBlockLength).toBe(45);
  });
});

// ─── setGoogleEventId ────────────────────────────────────────────────────────

describe("mutations/studyBlocks – setGoogleEventId", () => {
  test("sets googleEventId on a block that has none", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await seedStudyBlock(t, taskId);

    await t.mutation(internal.mutations.studyBlocks.setGoogleEventId, {
      studyBlockId,
      googleEventId: "gcal_event_abc123",
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.googleEventId).toBe("gcal_event_abc123");
  });

  test("overwrites an existing googleEventId", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const studyBlockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        title: "Block",
        studyBlockLength: 60,
        googleEventId: "old_event_id",
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.setGoogleEventId, {
      studyBlockId,
      googleEventId: "new_event_id",
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.googleEventId).toBe("new_event_id");
  });

  test("does not affect other fields on the block", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const startTime = new Date(Date.now() + 3600_000).toISOString();
    const studyBlockId = await seedStudyBlock(t, taskId, {
      title: "My block",
      startTime,
      studyBlockLength: 45,
    });

    await t.mutation(internal.mutations.studyBlocks.setGoogleEventId, {
      studyBlockId,
      googleEventId: "evt_xyz",
    });

    const block = await t.run((ctx) => ctx.db.get(studyBlockId));
    expect(block!.title).toBe("My block");
    expect(block!.startTime).toBe(startTime);
    expect(block!.studyBlockLength).toBe(45);
    expect(block!.googleEventId).toBe("evt_xyz");
  });
});

// ─── flagFutureBlocksForReexport ─────────────────────────────────────────────

describe("mutations/studyBlocks – flagFutureBlocksForReexport", () => {
  test("sets needsExport=true and clears googleEventId on future exported blocks", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        userId: userId as any,
        title: "Exported block",
        startTime: futureStart,
        studyBlockLength: 60,
        googleEventId: "gcal-evt-123",
        needsExport: false,
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, { userId });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.needsExport).toBe(true);
    expect(block!.googleEventId).toBeUndefined();
  });

  test("skips past blocks", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const pastStart = new Date(Date.now() - 3600_000).toISOString();

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        title: "Past block",
        startTime: pastStart,
        studyBlockLength: 60,
        googleEventId: "gcal-past-evt",
        needsExport: false,
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, { userId });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.googleEventId).toBe("gcal-past-evt");
    expect(block!.needsExport).toBe(false);
  });

  test("skips blocks with no startTime", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        title: "Unscheduled block",
        studyBlockLength: 60,
        googleEventId: "gcal-evt-unscheduled",
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, { userId });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.googleEventId).toBe("gcal-evt-unscheduled");
  });

  test("skips future blocks that were never exported (no googleEventId, needsExport undefined)", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const futureStart = new Date(Date.now() + 3600_000).toISOString();

    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: taskId as any,
        title: "Never exported",
        startTime: futureStart,
        studyBlockLength: 60,
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, { userId });

    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.needsExport).toBeUndefined();
    expect(block!.googleEventId).toBeUndefined();
  });

  test("only flags blocks belonging to the given user", async () => {
    const t = makeTestCtx();
    const { userId: user1Id } = await createTestUser(t);
    const { userId: user2Id } = await createTestUser(t, { email: "other@example.com" });
    const futureStart = new Date(Date.now() + 3600_000).toISOString();

    const task1Id = await seedTask(t, user1Id);
    const task2Id = await seedTask(t, user2Id);

    const block1Id = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: task1Id as any,
        userId: user1Id as any,
        title: "User 1 block",
        startTime: futureStart,
        studyBlockLength: 60,
        googleEventId: "evt-user1",
        needsExport: false,
        isCompleted: false,
      })
    );
    const block2Id = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        taskId: task2Id as any,
        userId: user2Id as any,
        title: "User 2 block",
        startTime: futureStart,
        studyBlockLength: 60,
        googleEventId: "evt-user2",
        needsExport: false,
        isCompleted: false,
      })
    );

    await t.mutation(internal.mutations.studyBlocks.flagFutureBlocksForReexport, { userId: user1Id });

    const block1 = await t.run((ctx) => ctx.db.get(block1Id));
    const block2 = await t.run((ctx) => ctx.db.get(block2Id));

    expect(block1!.needsExport).toBe(true);
    expect(block1!.googleEventId).toBeUndefined();
    expect(block2!.needsExport).toBe(false);
    expect(block2!.googleEventId).toBe("evt-user2");
  });
});

// ─── toggleStudyBlockComplete – supertask status propagation ─────────────────

describe("mutations/studyBlocks – toggleStudyBlockComplete supertask status", () => {
  async function seedTaskWithBlocks(
    t: ReturnType<typeof makeTestCtx>,
    userId: string,
    count: number
  ) {
    const taskId = await seedTask(t, userId);
    const blockIds: Id<"studyBlocks">[] = [];
    for (let i = 0; i < count; i++) {
      const id = await t.run((ctx) =>
        ctx.db.insert("studyBlocks", {
          taskId: taskId as any,
          userId: userId as any,
          title: `Block ${i + 1}`,
          studyBlockLength: 60,
          isCompleted: false,
        })
      );
      blockIds.push(id);
    }
    return { taskId, blockIds };
  }

  test("completing one of multiple blocks sets task to in_progress", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { taskId, blockIds } = await seedTaskWithBlocks(t, userId, 3);

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockIds[0],
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.status).toBe("in_progress");
  });

  test("completing all blocks sets task to completed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { taskId, blockIds } = await seedTaskWithBlocks(t, userId, 2);

    for (const blockId of blockIds) {
      await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
        studyBlockId: blockId,
      });
    }

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.status).toBe("completed");
  });

  test("uncompleting a block when others remain completed keeps task in_progress", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { taskId, blockIds } = await seedTaskWithBlocks(t, userId, 2);

    for (const blockId of blockIds) {
      await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
        studyBlockId: blockId,
      });
    }

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockIds[0],
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.status).toBe("in_progress");
  });

  test("uncompleting the only completed block sets task back to not_started", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { taskId, blockIds } = await seedTaskWithBlocks(t, userId, 2);

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockIds[0],
    });
    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockIds[0],
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.status).toBe("not_started");
  });
});

// ─── toggleStudyBlockComplete – supertask propagation via subtask ─────────────

describe("mutations/studyBlocks – toggleStudyBlockComplete supertask propagation via subtask", () => {
  async function seedSupertaskWithSubtaskBlock(
    t: ReturnType<typeof makeTestCtx>,
    userId: string
  ) {
    const parentTaskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId: userId as any,
        title: "Parent task",
        description: "",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        isManualEstimate: false,
      })
    );
    const subtaskId = await t.run((ctx) =>
      ctx.db.insert("subtasks", {
        parentTaskId: parentTaskId as any,
        userId: userId as any,
        title: "Subtask",
        description: "",
        taskType: "Essay",
        color: "#000000",
        order: 0,
        createdAt: Date.now(),
      })
    );
    const blockId = await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId: subtaskId as any,
        userId: userId as any,
        title: "Block",
        studyBlockLength: 60,
        isCompleted: false,
      })
    );
    return { parentTaskId, subtaskId, blockId };
  }

  test("completing one block on a subtask sets supertask to in_progress", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { parentTaskId, subtaskId, blockId } = await seedSupertaskWithSubtaskBlock(t, userId);

    // Add a second block so the subtask isn't fully complete after one toggle
    await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId: subtaskId as any,
        userId: userId as any,
        title: "Block 2",
        studyBlockLength: 60,
        isCompleted: false,
      })
    );

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });

    const task = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(task!.status).toBe("in_progress");
  });

  test("completing all blocks on the only subtask sets supertask to completed", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { parentTaskId, blockId } = await seedSupertaskWithSubtaskBlock(t, userId);

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });

    const task = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(task!.status).toBe("completed");
  });

  test("uncompleting the last block sets supertask back to not_started", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { parentTaskId, blockId } = await seedSupertaskWithSubtaskBlock(t, userId);

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });
    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });

    const task = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(task!.status).toBe("not_started");
  });

  test("only one subtask fully done does not complete supertask when sibling subtask is not_started", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const { parentTaskId, blockId } =
      await seedSupertaskWithSubtaskBlock(t, userId);

    // Second subtask with no blocks — status stays not_started
    await t.run((ctx) =>
      ctx.db.insert("subtasks", {
        parentTaskId: parentTaskId as any,
        userId: userId as any,
        title: "Subtask 2",
        description: "",
        taskType: "Essay",
        color: "#000000",
        order: 1,
        createdAt: Date.now(),
      })
    );

    await withAuth.mutation(api.mutations.studyBlocks.toggleStudyBlockComplete, {
      studyBlockId: blockId,
    });

    const task = await t.run((ctx) => ctx.db.get(parentTaskId));
    expect(task!.status).toBe("in_progress");
  });
});
