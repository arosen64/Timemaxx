import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const saveMessage = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    /** Tag this message with a task. courseId is derived from the task unless explicitly set. */
    taskId: v.optional(v.id("tasks")),
    /** Explicit course tag — takes precedence over the one derived from taskId. */
    courseId: v.optional(v.id("userCourses")),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args) => {
    let taskId: Id<"tasks"> | undefined = args.taskId;
    let courseId: Id<"userCourses"> | undefined = args.courseId;
    let sessionRow: {
      _id: Id<"chatSessions">;
      activeTaskId?: Id<"tasks">;
      activeCourseId?: Id<"userCourses">;
    } | null = null;

    if (args.sessionId) {
      sessionRow = await ctx.db
        .query("chatSessions")
        .withIndex("by_userId_sessionId", (q) =>
          q.eq("userId", args.userId).eq("sessionId", args.sessionId)
        )
        .unique();
    }

    if (taskId === undefined && courseId === undefined && sessionRow) {
      taskId = sessionRow.activeTaskId;
      courseId = sessionRow.activeCourseId;
    }

    if (courseId === undefined && taskId) {
      const task = await ctx.db.get(taskId);
      if (task && task.userId === args.userId && task.courseId) {
        courseId = task.courseId;
      }
    }
    const id = await ctx.db.insert("chatMessages", {
      userId: args.userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
      ...(taskId !== undefined ? { taskId } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    });

    if (sessionRow && (taskId !== undefined || courseId !== undefined)) {
      await ctx.db.patch(sessionRow._id, {
        ...(taskId !== undefined ? { activeTaskId: taskId } : {}),
        ...(courseId !== undefined ? { activeCourseId: courseId } : {}),
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.mutations.chatChunks.rebuildChatChunksForSessionInternal,
      {
        userId: args.userId,
        sessionId: args.sessionId,
      }
    );

    return id;
  },
});

/**
 * Copy picked task/course from MCQ onto the session's clarify-trigger user message,
 * and optionally clear entityClarifyTriggerUserMessageId when the flow is done.
 */
export const applyResolvedEntityToClarifyTriggerMessageInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    taskId: v.optional(v.id("tasks")),
    courseId: v.optional(v.id("userCourses")),
    clearTriggerPointer: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .unique();
    if (!session) throw new Error("chat session missing");

    const triggerId = session.entityClarifyTriggerUserMessageId;
    if (triggerId) {
      const msg = await ctx.db.get(triggerId);
      if (msg && msg.userId === args.userId && msg.role === "user") {
        let courseId: Id<"userCourses"> | undefined = args.courseId;
        if (courseId === undefined && args.taskId) {
          const task = await ctx.db.get(args.taskId);
          if (task && task.userId === args.userId && task.courseId) {
            courseId = task.courseId;
          }
        }
        await ctx.db.patch(triggerId, {
          ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          ...(courseId !== undefined ? { courseId } : {}),
        });
        await ctx.db.patch(session._id, {
          ...(args.taskId !== undefined ? { activeTaskId: args.taskId } : {}),
          ...(courseId !== undefined ? { activeCourseId: courseId } : {}),
        });
      }
    }

    if (args.clearTriggerPointer) {
      await ctx.db.patch(session._id, {
        entityClarifyTriggerUserMessageId: undefined,
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.mutations.chatChunks.rebuildChatChunksForSessionInternal,
      {
        userId: args.userId,
        sessionId: args.sessionId,
      }
    );

    return null;
  },
});

export const patchUserMessageClarificationIntent = internalMutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("chatMessages"),
    clarificationIntent: v.union(
      v.literal("task_feedback"),
      v.literal("class_difficulty"),
      v.literal("none")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.userId !== args.userId) {
      throw new Error("Message not found");
    }
    await ctx.db.patch(args.messageId, {
      clarificationIntent: args.clarificationIntent,
    });

    if (msg.sessionId) {
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.chatChunks.rebuildChatChunksForSessionInternal,
        {
          userId: args.userId,
          sessionId: msg.sessionId,
        }
      );
    }

    return null;
  },
});

export const clearTaskTagForSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const taggedMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    let patchedCount = 0;
    for (const message of taggedMessages) {
      if (message.userId !== args.userId || message.sessionId !== args.sessionId) continue;
      await ctx.db.patch(message._id, { taskId: undefined });
      patchedCount += 1;
    }

    if (patchedCount > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.chatChunks.rebuildChatChunksForSessionInternal,
        {
          userId: args.userId,
          sessionId: args.sessionId,
        }
      );
    }

    return patchedCount;
  },
});

export const clearEntityTagsForSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    taskId: v.optional(v.id("tasks")),
    courseId: v.optional(v.id("userCourses")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const sessionMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    let patchedCount = 0;
    for (const message of sessionMessages) {
      if (message.userId !== args.userId) continue;

      const matchesTask = args.taskId !== undefined && message.taskId === args.taskId;
      const matchesCourse = args.courseId !== undefined && message.courseId === args.courseId;
      if (!matchesTask && !matchesCourse) continue;

      await ctx.db.patch(message._id, {
        taskId: undefined,
        courseId: undefined,
      });
      patchedCount += 1;
    }

    if (patchedCount > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.mutations.chatChunks.rebuildChatChunksForSessionInternal,
        {
          userId: args.userId,
          sessionId: args.sessionId,
        }
      );
    }

    return patchedCount;
  },
});
