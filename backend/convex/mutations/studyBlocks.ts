import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const studyBlockArgs = {
  taskId: v.id("tasks"),
  title: v.string(),
  studyBlockLength: v.number(),
};

export const createStudyBlock = mutation({
  args: {
    ...studyBlockArgs,
    startTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    return await ctx.db.insert("studyBlocks", {
      taskId: args.taskId,
      title: args.title,
      startTime: args.startTime,
      studyBlockLength: args.studyBlockLength,
    });
  },
});

export const createTaskBlocks = mutation({
  args: {
    taskId: v.id("tasks"),
    blocks: v.array(
      v.object({
        title: v.string(),
        studyBlockLength: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) return;

    for (const block of args.blocks) {
      await ctx.db.insert("studyBlocks", {
        taskId: args.taskId,
        title: block.title,
        startTime: undefined,
        studyBlockLength: block.studyBlockLength,
      });
    }
  },
});

export const deleteStudyBlock = mutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");

    const task = await ctx.db.get(block.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.studyBlockId);
  },
});

export const editStudyBlockTime = mutation({
  args: {
    studyBlockId: v.id("studyBlocks"),
    startTime: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const block = await ctx.db.get(args.studyBlockId);
    if (!block) throw new Error("Study block not found");

    const task = await ctx.db.get(block.taskId);
    if (!task || task.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(args.studyBlockId, {
      startTime: args.startTime ?? undefined,
    });
  },
});
