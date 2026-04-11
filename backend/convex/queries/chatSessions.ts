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
    };
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
    return { entityScopeTags };
  },
});
