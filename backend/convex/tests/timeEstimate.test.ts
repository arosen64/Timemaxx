import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

const makeReasoning = () => ({
  classes: "No enrolled course context was available.",
  tasks: "No prior task history was available.",
  chats: "No chat history was available.",
  profile: "No profile context was available.",
});

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
      isManualEstimate: false,
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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
      reasoning: makeReasoning(),
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

  test("persists the reasoning trace on the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    const reasoning = {
      classes: "Student is enrolled in EN.601.421 with a difficulty of 4/5.",
      tasks: "Prior essay tasks averaged 90 minutes with positive feedback.",
      chats: "No chat history was available.",
      profile: "Student is a junior CS major with strong writing skills.",
    };

    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 90,
      reasoning,
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.reasoning).toEqual(reasoning);
  });
});

// ─── setManualTimeEstimate ────────────────────────────────────────────────────

describe("mutations/timeEstimate – setManualTimeEstimate", () => {
  test("sets timeEstimate and isManualEstimate to true", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await withAuth.mutation(api.mutations.timeEstimate.setManualTimeEstimate, {
      taskId,
      timeEstimate: 120,
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.timeEstimate).toBe(120);
    expect(task!.isManualEstimate).toBe(true);
  });

  test("regenerates study blocks after setting manual estimate", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await withAuth.mutation(api.mutations.timeEstimate.setManualTimeEstimate, {
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

  test("throws when user does not own the task", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);
    const { withAuth: otherAuth } = await createTestUser(t, { email: "other@example.com" });
    const taskId = await seedTask(t, userId);

    await expect(
      otherAuth.mutation(api.mutations.timeEstimate.setManualTimeEstimate, { taskId, timeEstimate: 60 })
    ).rejects.toThrow("Task not found");
  });

  test("deletes existing subtasks and their blocks when switching to manual", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    // Simulate AI-generated subtasks with blocks
    const subtaskId = await t.run((ctx) =>
      ctx.db.insert("subtasks", {
        parentTaskId: taskId,
        userId: userId as any,
        title: "Subtask 1",
        description: "desc",
        taskType: "Essay",
        color: "#000",
        order: 0,
        createdAt: Date.now(),
        timeEstimate: 60,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("studyBlocks", {
        subtaskId,
        userId: userId as any,
        title: "Subtask 1",
        studyBlockLength: 60,
        isCompleted: false,
      })
    );

    await withAuth.mutation(api.mutations.timeEstimate.setManualTimeEstimate, {
      taskId,
      timeEstimate: 90,
    });

    const subtasks = await t.run((ctx) =>
      ctx.db
        .query("subtasks")
        .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", taskId))
        .collect()
    );
    expect(subtasks).toHaveLength(0);

    const subtaskBlocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtaskId))
        .collect()
    );
    expect(subtaskBlocks).toHaveLength(0);

    const taskBlocks = await t.run((ctx) =>
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    );
    expect(taskBlocks).toHaveLength(2); // 90 min / 60 min blocks
  });

  test("setTimeEstimate does not overwrite a manual estimate", async () => {
    const t = makeTestCtx();
    const { userId, withAuth } = await createTestUser(t);
    const taskId = await seedTask(t, userId, { focusBlockLength: 60 });

    await withAuth.mutation(api.mutations.timeEstimate.setManualTimeEstimate, {
      taskId,
      timeEstimate: 90,
    });

    // AI pipeline tries to set a different estimate
    await t.mutation(internal.mutations.timeEstimate.setTimeEstimate, {
      taskId,
      timeEstimate: 999,
      reasoning: makeReasoning(),
    });

    const task = await t.run((ctx) => ctx.db.get(taskId));
    expect(task!.timeEstimate).toBe(90); // unchanged
    expect(task!.isManualEstimate).toBe(true);
  });
});
