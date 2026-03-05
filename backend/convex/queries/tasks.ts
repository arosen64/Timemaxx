import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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

// Get paginated + sorted list of tasks
export const getTasks = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    taskType: v.optional(
      v.union(
        v.literal("Problem Set"),
        v.literal("Essay"),
        v.literal("Coding"),
        v.literal("Exam Prep")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const order = args.sortOrder ?? "desc";

    const baseQuery = ctx.db
      .query("tasks")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order(order);

    // No pagination — return all (filtered)
    if (!args.paginationOpts) {
      const tasks = await baseQuery.collect();
      return args.taskType
        ? tasks.filter((t) => t.taskType === args.taskType)
        : tasks;
    }

    // With pagination
    const result = await baseQuery.paginate(args.paginationOpts);

    return {
      ...result,
      page: args.taskType
        ? result.page.filter((t) => t.taskType === args.taskType)
        : result.page,
    };
  },
});