import { describe, expect, test } from "vitest";
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
      description: "Test description",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      createdAt: Date.now(),
    })
  );
}

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
