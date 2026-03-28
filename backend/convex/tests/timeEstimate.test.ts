import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  overrides: { focusBlockLength?: number } = {}
) {
  // Optionally set focusBlockLength on the user
  if (overrides.focusBlockLength !== undefined) {
    await t.run((ctx) =>
      ctx.db.patch(userId as any, { focusBlockLength: overrides.focusBlockLength })
    );
  }

  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: "Test task",
      description: "desc",
      taskType: "Essay",
      dueDate: Date.now() + 86_400_000,
      createdAt: Date.now(),
    })
  );
}

describe("mutations/timeEstimate – setTimeEstimate auto-generates study blocks", () => {
  test("generates correct number of blocks for an even division", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 120,
    });

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );

    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.studyBlockLength === 60)).toBe(true);
    expect(blocks.every((b) => b.startTime === undefined)).toBe(true);
  });

  test("generates a partial last block when there is a remainder", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 90,
    });

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );

    expect(blocks).toHaveLength(2);
    const lengths = blocks.map((b) => b.studyBlockLength).sort((a, b) => b - a);
    expect(lengths).toEqual([60, 30]);
  });

  test("deletes existing blocks and regenerates when called again with a new estimate", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 60,
    });

    const firstBlocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );
    expect(firstBlocks).toHaveLength(1);

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 180,
    });

    const secondBlocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );
    expect(secondBlocks).toHaveLength(3);
    expect(secondBlocks.every((b) => b.studyBlockLength === 60)).toBe(true);
  });

  test("uses default 60-minute block length when user has no focusBlockLength", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId); // no focusBlockLength set

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 120,
    });

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );

    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.studyBlockLength === 60)).toBe(true);
  });

  test("creates a single block when timeEstimate is less than focusBlockLength", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 45,
    });

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].studyBlockLength).toBe(45);
  });

  test("each generated block has a unique _id", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 30 });

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 120,
    });

    const blocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );

    const ids = blocks.map((b) => b._id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
