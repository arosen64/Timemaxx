import { internalMutation } from "../_generated/server";
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
    return await ctx.db.insert("chatMessages", {
      userId: args.userId,
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
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
