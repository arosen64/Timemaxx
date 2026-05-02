import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { activeAgentValidator } from "../lib/chatValidators";

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

/** Lock the thread after hitting the per-session message cap. */
export const setChatInputLockedInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    locked: v.boolean(),
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
      chatInputLocked: args.locked,
    });
    return null;
  },
});

export const setTaskAgentStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    activeAgent: v.optional(activeAgentValidator),
    taskAgentIntent: v.optional(v.union(v.literal("create"), v.literal("rud"))),
    courseAgentIntent: v.optional(
      v.union(v.literal("add"), v.literal("drop"), v.literal("view"), v.literal("update")),
    ),
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
      ...(args.courseAgentIntent !== undefined ? { courseAgentIntent: args.courseAgentIntent } : {}),
    });
    return null;
  },
});

export const clearAgentStateInternal = internalMutation({
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
    // Clear subagent mode so the next turn can route via supervisor again.
    await ctx.db.patch(row._id, {
      activeAgent: undefined,
      taskAgentIntent: undefined,
      courseAgentIntent: undefined,
      awaitingEntityResolution: false,
      activeEntityStep: undefined,
      lastEntityQueryText: undefined,
      entityClarifyTriggerUserMessageId: undefined,
      needsClassAfterTask: false,
      clarificationAttemptCount: 0,
      clarificationExhausted: false,
      activeTaskId: undefined,
      activeCourseId: undefined,
      pendingScheduleAction: undefined,
      activeBlockId: undefined,
    });
    return null;
  },
});

// Backwards-compatible alias for generated API/type references until next codegen.
export const clearTaskAgentStateInternal = clearAgentStateInternal;

export const setMessageScopeInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    taskId: v.optional(v.id("tasks")),
    courseId: v.optional(v.id("userCourses")),
    clear: v.boolean(),
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

    if (args.clear) {
      await ctx.db.patch(row._id, {
        activeTaskId: undefined,
        activeCourseId: undefined,
      });
      return null;
    }

    await ctx.db.patch(row._id, {
      ...(args.taskId !== undefined ? { activeTaskId: args.taskId } : {}),
      ...(args.courseId !== undefined ? { activeCourseId: args.courseId } : {}),
    });
    return null;
  },
});

export const setBlockPromptStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    pendingScheduleAction: v.literal("schedule_block"),
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
      pendingScheduleAction: args.pendingScheduleAction,
      activeBlockId: undefined,
    });
    return null;
  },
});

export const resolvePickedBlockInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
    blockId: v.id("studyBlocks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new Error("Block not found");
    const ownerId = block.taskId
      ? (await ctx.db.get(block.taskId))?.userId
      : block.subtaskId
        ? (await ctx.db.get(block.subtaskId))?.userId
        : undefined;
    if (ownerId !== args.userId) throw new Error("Unauthorized");
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) throw new Error("chat session missing");
    await ctx.db.patch(row._id, {
      activeBlockId: args.blockId,
      pendingScheduleAction: undefined,
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
