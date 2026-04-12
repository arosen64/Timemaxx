import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const getOrCreateChatSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("chatSessions", {
      userId: args.userId,
      sessionId: args.sessionId,
      clarificationAttemptCount: 0,
    });
  },
});

export const setEntityPromptStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    lastEntityQueryText: v.string(),
    activeEntityStep: v.union(v.literal("task"), v.literal("class")),
    needsClassAfterTask: v.boolean(),
    awaitingEntityResolution: v.boolean(),
    /** Set only when starting a new MCQ from a user turn; omit to keep existing trigger id */
    clarifyTriggerUserMessageId: v.optional(v.id("chatMessages")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      lastEntityQueryText: args.lastEntityQueryText,
      activeEntityStep: args.activeEntityStep,
      needsClassAfterTask: args.needsClassAfterTask,
      awaitingEntityResolution: args.awaitingEntityResolution,
      ...(args.clarifyTriggerUserMessageId !== undefined
        ? { entityClarifyTriggerUserMessageId: args.clarifyTriggerUserMessageId }
        : {}),
    });
    return null;
  },
});

export const resolvePickedTaskInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    taskId: v.id("tasks"),
  },
  returns: v.object({
    needsClassNext: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== args.userId) {
      throw new Error("Invalid task");
    }
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");

    const needsClassNext = row.needsClassAfterTask === true;
    await ctx.db.patch(row._id, {
      resolvedTaskId: args.taskId,
      clarificationAttemptCount: 0,
      clarificationExhausted: false,
      needsClassAfterTask: false,
      ...(needsClassNext
        ? {
            activeEntityStep: "class" as const,
            awaitingEntityResolution: true,
          }
        : {
            activeEntityStep: undefined,
            awaitingEntityResolution: false,
          }),
    });
    return { needsClassNext };
  },
});

export const resolvePickedCourseInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    courseId: v.id("userCourses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== args.userId) {
      throw new Error("Invalid course");
    }
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");

    await ctx.db.patch(row._id, {
      resolvedCourseId: args.courseId,
      activeEntityStep: undefined,
      awaitingEntityResolution: false,
      needsClassAfterTask: false,
      clarificationAttemptCount: 0,
      clarificationExhausted: false,
    });
    return null;
  },
});

export const clearEntityAwaitingInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      awaitingEntityResolution: false,
      activeEntityStep: undefined,
      entityClarifyTriggerUserMessageId: undefined,
    });
    return null;
  },
});

export const beginAwaitingScopeConfirmInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    pendingScopeUserMessageId: v.optional(v.id("chatMessages")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      awaitingScopeConfirm: true,
      ...(args.pendingScopeUserMessageId !== undefined
        ? { pendingScopeUserMessageId: args.pendingScopeUserMessageId }
        : {}),
    });
    return null;
  },
});

export const resolveScopeConfirmYesInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      awaitingScopeConfirm: false,
      scopeBypassNextMessage: true,
      pendingScopeUserMessageId: undefined,
    });
    return null;
  },
});

export const resolveScopeConfirmNoInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      awaitingScopeConfirm: false,
      scopeBypassNextMessage: false,
      chatInputLocked: true,
      pendingScopeUserMessageId: undefined,
    });
    return null;
  },
});

export const consumeScopeBypassInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      scopeBypassNextMessage: false,
    });
    return null;
  },
});

export const setTaskAgentStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    activeAgent: v.optional(v.union(v.literal("task"), v.literal("feedback"), v.literal("preferences"))),
    taskAgentIntent: v.optional(v.union(v.literal("create"), v.literal("rud"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      ...(args.activeAgent !== undefined ? { activeAgent: args.activeAgent } : {}),
      ...(args.taskAgentIntent !== undefined ? { taskAgentIntent: args.taskAgentIntent } : {}),
    });
    return null;
  },
});

export const clearTaskAgentStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return null;
    // Clear agent state AND resolved entities — each subagent interaction is self-contained.
    // The next invocation starts fresh so the user can act on a different task or class.
    await ctx.db.patch(row._id, {
      activeAgent: undefined,
      taskAgentIntent: undefined,
      resolvedTaskId: undefined,
      resolvedCourseId: undefined,
      awaitingEntityResolution: false,
      activeEntityStep: undefined,
      needsClassAfterTask: false,
      clarificationAttemptCount: 0,
      clarificationExhausted: false,
    });
    return null;
  },
});

export const incrementClarificationFailureInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.object({
    count: v.number(),
    exhausted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    const prev = row.clarificationAttemptCount ?? 0;
    const count = prev + 1;
    const exhausted = count >= 3;
    await ctx.db.patch(row._id, {
      clarificationAttemptCount: count,
      clarificationExhausted: exhausted,
      awaitingEntityResolution: exhausted ? false : row.awaitingEntityResolution,
    });
    return { count, exhausted };
  },
});
