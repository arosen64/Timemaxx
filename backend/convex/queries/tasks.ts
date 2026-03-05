import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyTasks = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
    sortBy: v.optional(v.union(
      v.literal("createdAt"),
      v.literal("timeEstimate"),
      v.literal("title"),
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filterByType: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, sortBy = "createdAt", sortOrder = "desc", filterByType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: null };

    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();

    if (filterByType) {
      tasks = tasks.filter((t) => t.taskType === filterByType);
    }

    tasks.sort((a, b) => {
      const aVal = sortBy === "title" ? a.title.toLowerCase() : a[sortBy];
      const bVal = sortBy === "title" ? b.title.toLowerCase() : b[sortBy];
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    if (!paginationOpts) {
      return { page: tasks, isDone: true, continueCursor: null };
    }

    const { numItems, cursor } = paginationOpts;
    if (numItems < 1 || numItems > 100) {
      throw new Error("numItems must be between 1 and 100");
    }

    const startIndex = cursor ? parseInt(cursor) : 0;
    const page = tasks.slice(startIndex, startIndex + numItems);
    const nextIndex = startIndex + numItems;
    const isDone = nextIndex >= tasks.length;

    return {
      page,
      isDone,
      continueCursor: isDone ? null : String(nextIndex),
    };
  },
});

export const getTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId) return null;
    return task;
  },
});