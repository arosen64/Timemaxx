import { mutation, internalMutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { taskTypeValidator } from "../lib/taskValidators";
import { Id } from "../_generated/dataModel";
import { rebuildStudyBlocks } from "./timeEstimate";

export async function cascadeDeleteTask(ctx: MutationCtx, taskId: Id<"tasks">) {
  const subtasks = await ctx.db
    .query("subtasks")
    .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", taskId))
    .collect();

  for (const subtask of subtasks) {
    const subtaskBlocks = await ctx.db
      .query("studyBlocks")
      .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
      .collect();
    for (const block of subtaskBlocks) await ctx.db.delete(block._id);
    await ctx.db.delete(subtask._id);
  }

  const taskBlocks = await ctx.db
    .query("studyBlocks")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const block of taskBlocks) await ctx.db.delete(block._id);

  await ctx.db.delete(taskId);
}

function normalizeClassTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Creates a new task for the authenticated user. If a timeEstimate is provided,
 * it is treated as a manual estimate and study blocks are built immediately.
 * Otherwise, time estimation is handled separately (e.g. via a Gemini action).
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    dueDate: v.number(),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
    timeEstimate: v.optional(v.number()),
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

    const isManualEstimate = args.timeEstimate !== undefined;

    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      courseId: args.courseId,
      classTag: normalizeClassTag(args.classTag),
      timeEstimate: args.timeEstimate,
      isManualEstimate,
      createdAt: Date.now(),
    });

    if (isManualEstimate) {
      await rebuildStudyBlocks(ctx, taskId, args.timeEstimate!);
    }

    if (process.env.GEMINI_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateTaskEmbedding, {
        taskId,
        title: args.title,
        description: args.description,
      });
    }

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
    });

    if (process.env.GEMINI_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateTaskEmbedding, {
        taskId: args.taskId,
        title: args.title,
        description: args.description,
      });
    }
  },
});

/** Creates a task from an action context (bypasses public auth; caller must validate userId). */
export const createTaskInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: v.string(),
    dueDate: v.number(),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    let classTag = normalizeClassTag(args.classTag);
    if (args.courseId) {
      const course = await ctx.db.get(args.courseId);
      if (course) classTag = `${course.courseCode}: ${course.title}`;
    }
    const taskId = await ctx.db.insert("tasks", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      dueDate: args.dueDate,
      courseId: args.courseId,
      classTag,
      createdAt: Date.now(),
      isManualEstimate: false,
    });
    if (process.env.GEMINI_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateTaskEmbedding, {
        taskId,
        title: args.title,
        description: args.description,
      });
    }
    return taskId;
  },
});

/** Partially patches a task from an action context. Only provided fields are updated. */
export const patchTaskFieldsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    taskType: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== args.userId) throw new Error("Task not found");
    const patch: Partial<typeof task> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.taskType !== undefined) patch.taskType = args.taskType;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.courseId !== undefined) {
      patch.courseId = args.courseId;
      const course = await ctx.db.get(args.courseId);
      if (course) patch.classTag = `${course.courseCode}: ${course.title}`;
    } else if (args.classTag !== undefined) {
      patch.classTag = normalizeClassTag(args.classTag);
    }
    await ctx.db.patch(args.taskId, patch);
    if (process.env.GEMINI_API_KEY && (args.title !== undefined || args.description !== undefined)) {
      await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateTaskEmbedding, {
        taskId: args.taskId,
        title: args.title ?? task.title,
        description: args.description ?? task.description,
      });
    }
    return null;
  },
});

/** Deletes a task (with cascade) from an action context. */
export const deleteTaskInternal = internalMutation({
  args: {
    userId: v.id("users"),
    taskId: v.id("tasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== args.userId) throw new Error("Task not found");
    await cascadeDeleteTask(ctx, args.taskId);
    return null;
  },
});

export const patchTaskEmbedding = internalMutation({
  args: {
    taskId: v.id("tasks"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { embedding: args.embedding });
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

    // Collect googleEventIds from all study blocks before deletion
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", args.taskId))
      .collect();

    const [subtaskBlockArrays, taskBlocks] = await Promise.all([
      Promise.all(
        subtasks.map((subtask) =>
          ctx.db
            .query("studyBlocks")
            .withIndex("by_subtaskId", (q) => q.eq("subtaskId", subtask._id))
            .collect(),
        ),
      ),
      ctx.db
        .query("studyBlocks")
        .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
        .collect(),
    ]);

    const googleEventIds = [...subtaskBlockArrays.flat(), ...taskBlocks]
      .map((b) => b.googleEventId)
      .filter((id): id is string => id !== undefined);

    await cascadeDeleteTask(ctx, args.taskId);

    if (googleEventIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.exportStudyBlocksToCalendar.deleteLinkedCalendarEvents,
        { userId, googleEventIds },
      );
    }
  },
});
