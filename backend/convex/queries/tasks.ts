import { internalQuery, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Internal query for fetching a task by ID without auth (used by scheduled actions)
export const getTaskInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

// Internal query for fetching all tasks for a user — used by AI scheduling actions
export const getAllTasksForUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getEstimateFeedbackContextInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(25);

    return tasks
      .filter((t) => t.timeEstimate !== undefined && t.estimateFeedbackRating !== undefined)
      .slice(0, 10)
      .map((t) => ({
        title: t.title,
        taskType: t.taskType,
        estimatedMinutes: t.timeEstimate as number,
        rating: t.estimateFeedbackRating as "up" | "down",
        correctedEstimateMinutes: t.correctedEstimateMinutes,
      }));
  },
});

// Get a single task by ID
export const getTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) return null;

    return task;
  },
});

//Sorted list of all queries
export const getAllTasks = query({
  args: {
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    taskType: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const order = args.sortOrder ?? "desc";

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order(order)
      .collect();

    if (args.taskType) {
      return tasks.filter((t) => t.taskType === args.taskType);
    }

    return tasks;
  },
});

// Get tasks for one class/course. If courseId is omitted, returns uncategorized tasks.
export const getTasksByCourseId = query({
  args: {
    courseId: v.optional(v.id("userCourses")),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const order = args.sortOrder ?? "desc";

    if (!args.courseId) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_userId_courseId", (q) => q.eq("userId", userId).eq("courseId", undefined))
        .order(order)
        .collect();
    }

    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_courseId", (q) => q.eq("userId", userId).eq("courseId", args.courseId!))
      .order(order)
      .collect();
  },
});

// Internal query for fetching all tasks for a user.
// Used by the retrieval layer (slices to 10) and AI scheduling actions (needs all tasks).
export const getAllTasksInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Internal query for batch-fetching tasks by IDs (used by context builders)
export const getTasksByIdsInternal = internalQuery({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.taskIds.map((id) => ctx.db.get(id)));
    return results.filter((t): t is NonNullable<typeof t> => t !== null);
  },
});

export const getTasksPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    taskType: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const order = args.sortOrder ?? "desc";

    const result = await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order(order)
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: args.taskType ? result.page.filter((t) => t.taskType === args.taskType) : result.page,
    };
  },
});
