import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const saveMessage = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      userId: args.userId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});
