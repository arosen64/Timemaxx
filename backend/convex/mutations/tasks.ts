import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Creates a new task for the authenticated user with timeEstimate left unset.
 * Time estimation is handled separately (e.g. via a Gemini action) after creation.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    taskType: v.union(
      v.literal("Problem Set"),
      v.literal("Essay"),
      v.literal("Coding"),
      v.literal("Exam Prep"),
    ),
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    const now = Date.now();

    // Basic validation
    if (args.title.trim().length === 0) {
      throw new Error("Title cannot be empty");
    }
    if (args.description.trim().length === 0) {
      throw new Error("Description cannot be empty");
    }
    if (args.dueDate <= now) {
      throw new Error("Due date must be in the future");
    }

    // Insert the new task with timeEstimate left as undefined for now
    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      timeEstimate: undefined, // populated asynchronously by estimateTaskTime action
      createdAt: Date.now(),
    });

    return taskId;
  },
});

const taskTypeValidator = v.union(
  v.literal("Problem Set"),
  v.literal("Essay"),
  v.literal("Coding"),
  v.literal("Exam Prep")
);

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      timeEstimate: undefined,
    });
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    await ctx.db.delete(args.taskId);
  },
});
