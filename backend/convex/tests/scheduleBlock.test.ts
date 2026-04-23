import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  opts: { dueDate?: number; recommended_start?: number } = {},
) {
  const dueDate = opts.dueDate ?? Date.now() + 30 * 86_400_000;
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as any,
      title: "Test task",
      description: "desc",
      taskType: "Essay",
      dueDate,
      recommended_start: opts.recommended_start,
      createdAt: Date.now(),
      isManualEstimate: false,
    })
  );
}

async function seedBlock(
  t: ReturnType<typeof makeTestCtx>,
  taskId: string,
  userId: string,
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as any,
      userId: userId as any,
      title: "Block",
      studyBlockLength: 60,
    })
  );
}

describe("actions/scheduleBlock – recommended_start constraint", () => {
  test("returns no_slot_found when recommended_start equals dueDate (zero schedulable window)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const dueDate = Date.now() + 7 * 86_400_000;
    const taskId = await seedTask(t, userId, { dueDate, recommended_start: dueDate });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ error: "no_slot_found" });
  });

  test("schedules successfully when recommended_start is not set", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.startTime).toBeDefined();
  });

  test("schedules successfully when recommended_start is in the past", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, {
      recommended_start: Date.now() - 86_400_000, // yesterday
    });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
  });

  test("places block at or after recommended_start when it is in the future", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const recommendedStart = Date.now() + 10 * 86_400_000;
    const taskId = await seedTask(t, userId, {
      dueDate: Date.now() + 30 * 86_400_000,
      recommended_start: recommendedStart,
    });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.actions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(new Date(block!.startTime!).getTime()).toBeGreaterThanOrEqual(recommendedStart);
  });
});
