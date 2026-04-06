import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";

function normalizeClassTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Creates a new task for the authenticated user with timeEstimate left unset.
 * Time estimation is handled separately (e.g. via a Gemini action) after creation.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    dueDate: v.number(),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
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
      throw new Error("That due date and time are in the past. Choose a later deadline.");
    }

    // Insert the new task with timeEstimate left as undefined for now
    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      courseId: args.courseId,
      classTag: normalizeClassTag(args.classTag),
      timeEstimate: undefined, // populated asynchronously by estimateTaskTime action
      createdAt: Date.now(),
    });

    return taskId;
  },
});


export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    dueDate: v.number(),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
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
      courseId: args.courseId,
      ...(args.classTag !== undefined
        ? { classTag: normalizeClassTag(args.classTag) }
        : {}),
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

    // Cascade: delete subtasks and their study blocks
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    for (const subtask of subtasks) {
      const subtaskBlocks = await ctx.db
        .query("studyBlocks")
        .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
        .collect();
      for (const block of subtaskBlocks) {
        await ctx.db.delete(block._id);
      }
      await ctx.db.delete(subtask._id);
    }

    // Delete the task's own study blocks
    const studyBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    for (const block of studyBlocks) {
      await ctx.db.delete(block._id);
    }

    await ctx.db.delete(args.taskId);
  },
});
