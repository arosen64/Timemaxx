import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";

export const getStudyBlocksByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const getStudyBlockById = query({
  args: {
    studyBlockId: v.id("studyBlocks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studyBlockId);
  },
});

async function fetchAllStudyBlocksWithTasks(ctx: any, userId: Id<"users">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  const result: Array<{
    _id: Id<"studyBlocks">;
    taskId: Id<"tasks">;
    title: string;
    startTime: string | undefined;
    studyBlockLength: number;
    isConflicted: boolean | undefined;
    taskTitle: string;
    taskDueDate: number;
    courseColor: string | undefined;
    courseName: string | undefined;
  }> = [];

  for (const task of tasks) {
    const course = task.courseId ? await ctx.db.get(task.courseId) : null;
    const courseColor: string | undefined = course?.color ?? undefined;
    const courseName: string | undefined = course?.courseCode ?? undefined;

    const blocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q: any) => q.eq("taskId", task._id))
      .collect();
    for (const block of blocks) {
      result.push({
        _id: block._id,
        taskId: block.taskId,
        title: block.title,
        startTime: block.startTime,
        studyBlockLength: block.studyBlockLength,
        isConflicted: block.isConflicted,
        taskTitle: task.title,
        taskDueDate: task.dueDate,
        courseColor,
        courseName,
      });
    }
  }

  return result;
}

export const getUpcomingStudyBlocks = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    const allBlocks = await fetchAllStudyBlocksWithTasks(ctx, userId);

    return allBlocks
      .filter((b) => {
        if (!b.startTime) return false;
        const startMs = new Date(b.startTime).getTime();
        return startMs >= now && startMs <= in24h;
      })
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
  },
});

export const getAllStudyBlocksWithTasks = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await fetchAllStudyBlocksWithTasks(ctx, userId);
  },
});

export const getAllStudyBlocksWithTasksInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await fetchAllStudyBlocksWithTasks(ctx, args.userId);
  },
});
