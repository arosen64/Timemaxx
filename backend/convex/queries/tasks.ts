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


// Internal query for fetching recent tasks for a user (used by retrieval layer).
// Takes 25 so the retrieval layer can exclude the current task and still have
// enough candidates to fill its 10-result slice.
export const getAllTasksInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(25);
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
      page: args.taskType
        ? result.page.filter((t) => t.taskType === args.taskType)
        : result.page,
    };
  },
});
