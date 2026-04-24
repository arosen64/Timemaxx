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
      lastEntityQueryText: v.optional(v.string()),
      activeEntityStep: v.optional(
        v.union(v.literal("task"), v.literal("class")),
      ),
      needsClassAfterTask: v.optional(v.boolean()),
      clarificationAttemptCount: v.optional(v.number()),
      clarificationExhausted: v.optional(v.boolean()),
      awaitingEntityResolution: v.optional(v.boolean()),
      chatInputLocked: v.optional(v.boolean()),
      activeAgent: v.optional(
        v.union(
          v.literal("task"),
          v.literal("feedback"),
          v.literal("preferences"),
          v.literal("classes"),
        ),
      ),
      taskAgentIntent: v.optional(v.union(v.literal("create"), v.literal("rud"))),
      courseAgentIntent: v.optional(
        v.union(v.literal("add"), v.literal("drop"), v.literal("view"), v.literal("update")),
      ),
      activeTaskId: v.optional(v.id("tasks")),
      activeCourseId: v.optional(v.id("userCourses")),
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
      lastEntityQueryText: row.lastEntityQueryText,
      activeEntityStep: row.activeEntityStep,
      needsClassAfterTask: row.needsClassAfterTask,
      clarificationAttemptCount: row.clarificationAttemptCount,
      clarificationExhausted: row.clarificationExhausted,
      awaitingEntityResolution: row.awaitingEntityResolution,
      chatInputLocked: row.chatInputLocked,
      activeAgent: row.activeAgent,
      taskAgentIntent: row.taskAgentIntent,
      courseAgentIntent: row.courseAgentIntent,
      activeTaskId: row.activeTaskId,
      activeCourseId: row.activeCourseId,
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
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(40);

    let taskTitle: string | null = null;
    let courseLabel: string | null = null;

    for (const m of msgs) {
      if (m.userId !== args.userId) continue;
      if (taskTitle === null && m.taskId) {
        const t = await ctx.db.get(m.taskId);
        if (t && t.userId === args.userId) taskTitle = t.title;
      }
      if (courseLabel === null && m.courseId) {
        const c = await ctx.db.get(m.courseId);
        if (c && c.userId === args.userId) {
          courseLabel = `${c.courseCode} · ${c.title}`;
        }
      }
      if (taskTitle !== null && courseLabel !== null) break;
    }

    return { taskTitle, courseLabel };
  },
});

/** Tags for the chat widget header — derived from chatSessions active scope. */
export const getChatSessionEntityScope = query({
  args: { sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      entityScopeTags: v.array(
        v.union(v.literal("task_id_set"), v.literal("class_id_set")),
      ),
      chatInputLocked: v.boolean(),
      activeAgent: v.union(
        v.literal("task"),
        v.literal("feedback"),
        v.literal("preferences"),
        v.literal("classes"),
        v.null(),
      ),
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
    if (row.activeTaskId) entityScopeTags.push("task_id_set");
    if (row.activeCourseId) entityScopeTags.push("class_id_set");

    return {
      entityScopeTags,
      chatInputLocked: row.chatInputLocked === true,
      activeAgent: row.activeAgent ?? null,
    };
  },
});
