import { internalMutation } from "../_generated/server";
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
    let courseId: Id<"userCourses"> | undefined = args.courseId;
    if (courseId === undefined && args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (task && task.userId === args.userId && task.courseId) {
        courseId = task.courseId;
      }
    }
    return await ctx.db.insert("chatMessages", {
      userId: args.userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
      ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    });
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
    return null;
  },
});
