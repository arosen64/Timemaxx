import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";
import type { Id } from "../_generated/dataModel";

async function seedTask(
  t: ReturnType<typeof makeTestCtx>,
  userId: string,
  opts: { dueDate?: number; recommendedStart?: number } = {}
) {
  const dueDate = opts.dueDate ?? Date.now() + 30 * 86_400_000;
  return t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId: userId as Id<"users">,
      title: "Test task",
      description: "desc",
      taskType: "Essay",
      dueDate,
      recommendedStart: opts.recommendedStart,
      createdAt: Date.now(),
      isManualEstimate: false,
      status: "not_started",
    })
  );
}

async function seedBlock(t: ReturnType<typeof makeTestCtx>, taskId: string, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      taskId: taskId as Id<"tasks">,
      userId: userId as Id<"users">,
      title: "Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
    })
  );
}

async function seedSubtask(
  t: ReturnType<typeof makeTestCtx>,
  parentTaskId: string,
  userId: string,
  opts: { dueDate?: number } = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("subtasks", {
      parentTaskId: parentTaskId as Id<"tasks">,
      userId: userId as Id<"users">,
      title: "Subtask",
      description: "desc",
      taskType: "Essay",
      color: "#000000",
      order: 0,
      createdAt: Date.now(),
      dueDate: opts.dueDate ?? Date.now() + 30 * 86_400_000,
      status: "not_started",
    })
  );
}

async function seedSubtaskBlock(
  t: ReturnType<typeof makeTestCtx>,
  subtaskId: string,
  userId: string
) {
  return t.run((ctx) =>
    ctx.db.insert("studyBlocks", {
      subtaskId: subtaskId as Id<"subtasks">,
      userId: userId as Id<"users">,
      title: "Subtask Block",
      studyBlockLength: 60,
      isCompleted: false,
      isConflicted: false,
    })
  );
}

describe("functions/scheduleBlock – recommendedStart constraint", () => {
  test("returns no_slot_found when recommendedStart equals dueDate (zero schedulable window)", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const dueDate = Date.now() + 7 * 86_400_000;
    const taskId = await seedTask(t, userId, { dueDate, recommendedStart: dueDate });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.functions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ error: "no_slot_found" });
  });

  test("schedules successfully when recommendedStart is not set", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId);
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.functions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(block!.startTime).toBeDefined();
  });

  test("schedules successfully when recommendedStart is in the past", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, {
      recommendedStart: Date.now() - 86_400_000, // yesterday
    });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.functions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
  });

  test("places block at or after recommendedStart when it is in the future", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const recommendedStart = Date.now() + 10 * 86_400_000;
    const taskId = await seedTask(t, userId, {
      dueDate: Date.now() + 30 * 86_400_000,
      recommendedStart: recommendedStart,
    });
    const blockId = await seedBlock(t, taskId, userId);

    const result = await withAuth.action(api.functions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(new Date(block!.startTime!).getTime()).toBeGreaterThanOrEqual(recommendedStart);
  });

  test("subtask block inherits recommendedStart from parent task", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const recommendedStart = Date.now() + 10 * 86_400_000;
    const taskId = await seedTask(t, userId, {
      dueDate: Date.now() + 30 * 86_400_000,
      recommendedStart,
    });
    const subtaskId = await seedSubtask(t, taskId, userId, {
      dueDate: Date.now() + 30 * 86_400_000,
    });
    const blockId = await seedSubtaskBlock(t, subtaskId, userId);

    const result = await withAuth.action(api.functions.scheduleBlock.scheduleBlock, {
      studyBlockId: blockId,
      timezone: "America/New_York",
    });

    expect(result).toEqual({ scheduled: 1 });
    const block = await t.run((ctx) => ctx.db.get(blockId));
    expect(new Date(block!.startTime!).getTime()).toBeGreaterThanOrEqual(recommendedStart);
  });
});
