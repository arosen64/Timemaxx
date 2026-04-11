import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

export const getChatSessionInternal = internalQuery({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("chatSessions"),
      resolvedTaskId: v.optional(v.id("tasks")),
      resolvedCourseId: v.optional(v.id("userCourses")),
      lastEntityQueryText: v.optional(v.string()),
      activeEntityStep: v.optional(
        v.union(v.literal("task"), v.literal("class")),
      ),
      needsClassAfterTask: v.optional(v.boolean()),
      clarificationAttemptCount: v.optional(v.number()),
      clarificationExhausted: v.optional(v.boolean()),
      awaitingEntityResolution: v.optional(v.boolean()),
      awaitingScopeConfirm: v.optional(v.boolean()),
      chatInputLocked: v.optional(v.boolean()),
      scopeBypassNextMessage: v.optional(v.boolean()),
      pendingScopeUserMessageId: v.optional(v.id("chatMessages")),
      activeAgent: v.optional(v.literal("task")),
      taskAgentIntent: v.optional(v.union(v.literal("create"), v.literal("rud"))),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return null;
    return {
      _id: row._id,
      resolvedTaskId: row.resolvedTaskId,
      resolvedCourseId: row.resolvedCourseId,
      lastEntityQueryText: row.lastEntityQueryText,
      activeEntityStep: row.activeEntityStep,
      needsClassAfterTask: row.needsClassAfterTask,
      clarificationAttemptCount: row.clarificationAttemptCount,
      clarificationExhausted: row.clarificationExhausted,
      awaitingEntityResolution: row.awaitingEntityResolution,
      awaitingScopeConfirm: row.awaitingScopeConfirm,
      chatInputLocked: row.chatInputLocked,
      scopeBypassNextMessage: row.scopeBypassNextMessage,
      pendingScopeUserMessageId: row.pendingScopeUserMessageId,
      activeAgent: row.activeAgent,
      taskAgentIntent: row.taskAgentIntent,
    };
  },
});

export const getResolvedEntityLabelsInternal = internalQuery({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.object({
    taskTitle: v.union(v.string(), v.null()),
    courseLabel: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return { taskTitle: null, courseLabel: null };

    let taskTitle: string | null = null;
    if (row.resolvedTaskId) {
      const t = await ctx.db.get(row.resolvedTaskId);
      if (t && t.userId === args.userId) taskTitle = t.title;
    }
    let courseLabel: string | null = null;
    if (row.resolvedCourseId) {
      const c = await ctx.db.get(row.resolvedCourseId);
      if (c && c.userId === args.userId) {
        courseLabel = `${c.courseCode} · ${c.title}`;
      }
    }
    return { taskTitle, courseLabel };
  },
});

/** Tags for the chat widget header: which entity IDs are locked for this session. */
export const getChatSessionEntityScope = query({
  args: { sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      entityScopeTags: v.array(
        v.union(v.literal("task_id_set"), v.literal("class_id_set")),
      ),
      chatInputLocked: v.boolean(),
      awaitingScopeConfirm: v.boolean(),
      scopeConfirmTaskLabel: v.union(v.string(), v.null()),
      scopeConfirmClassLabel: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const row = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!row) return null;

    const entityScopeTags: Array<"task_id_set" | "class_id_set"> = [];
    if (row.resolvedTaskId) entityScopeTags.push("task_id_set");
    if (row.resolvedCourseId) entityScopeTags.push("class_id_set");

    let scopeConfirmTaskLabel: string | null = null;
    let scopeConfirmClassLabel: string | null = null;
    if (row.awaitingScopeConfirm === true) {
      if (row.resolvedTaskId) {
        const t = await ctx.db.get(row.resolvedTaskId);
        if (t && t.userId === userId) scopeConfirmTaskLabel = t.title;
      }
      if (row.resolvedCourseId) {
        const c = await ctx.db.get(row.resolvedCourseId);
        if (c && c.userId === userId) {
          scopeConfirmClassLabel = `${c.courseCode} · ${c.title}`;
        }
      }
    }

    return {
      entityScopeTags,
      chatInputLocked: row.chatInputLocked === true,
      awaitingScopeConfirm: row.awaitingScopeConfirm === true,
      scopeConfirmTaskLabel,
      scopeConfirmClassLabel,
    };
  },
});
