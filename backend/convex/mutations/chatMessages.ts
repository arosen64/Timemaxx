import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const saveMessage = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    const id = await ctx.db.insert("chatMessages", {
      userId: args.userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
      ...(session?.resolvedTaskId !== undefined
        ? { taskId: session.resolvedTaskId }
        : {}),
      ...(session?.resolvedCourseId !== undefined
        ? { courseId: session.resolvedCourseId }
        : {}),
    });

    await ctx.scheduler.runAfter(0, internal.mutations.chatChunks.rebuildChatChunksForSessionInternal, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

    return id;
  },
});

/**
 * Copy resolved task/class from MCQ onto the user message that started the clarify flow,
 * and optionally drop the session pointer when disambiguation is complete.
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
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!session) throw new Error("chat session missing");

    const triggerId = session.entityClarifyTriggerUserMessageId;
    if (triggerId) {
      const msg = await ctx.db.get(triggerId);
      if (msg && msg.userId === args.userId && msg.role === "user") {
        await ctx.db.patch(triggerId, {
          ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          ...(args.courseId !== undefined ? { courseId: args.courseId } : {}),
        });
      }
    }

    if (args.clearTriggerPointer) {
      await ctx.db.patch(session._id, {
        entityClarifyTriggerUserMessageId: undefined,
      });
    }

    await ctx.scheduler.runAfter(0, internal.mutations.chatChunks.rebuildChatChunksForSessionInternal, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

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
      v.literal("none"),
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
      await ctx.scheduler.runAfter(0, internal.mutations.chatChunks.rebuildChatChunksForSessionInternal, {
        userId: args.userId,
        sessionId: msg.sessionId,
      });
    }

    return null;
  },
});
