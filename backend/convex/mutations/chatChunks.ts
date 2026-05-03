import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { buildChatChunkSpecs, type ChatMessageForChunking } from "../lib/chatChunking";
import type { Id } from "../_generated/dataModel";

/**
 * Replaces all chatChunks for a session from the current chatMessages tail.
 * Scheduled after new messages and when message metadata (tags, resolved entities) changes.
 */
export const rebuildChatChunksForSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const messages: ChatMessageForChunking[] = all
      .filter((m) => m.userId === args.userId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        taskId: m.taskId,
        courseId: m.courseId,
        clarificationIntent: m.clarificationIntent,
      }));

    const existing = await ctx.db
      .query("chatChunks")
      .withIndex("by_userId_sessionId", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    if (messages.length === 0) {
      return null;
    }

    const specs = buildChatChunkSpecs(messages);
    const now = Date.now();

    const insertedIds: Id<"chatChunks">[] = [];

    for (const spec of specs) {
      const id = await ctx.db.insert("chatChunks", {
        userId: args.userId,
        sessionId: args.sessionId,
        text: spec.text,
        chunkIndex: spec.chunkIndex,
        startCreatedAt: spec.startCreatedAt,
        linkedTaskIds: spec.linkedTaskIds,
        linkedCourseIds: spec.linkedCourseIds,
        ...(spec.clarificationIntent !== undefined
          ? { clarificationIntent: spec.clarificationIntent }
          : {}),
        createdAt: now,
      });
      insertedIds.push(id);
    }

    if (process.env.GEMINI_API_KEY) {
      for (let i = 0; i < insertedIds.length; i++) {
        const chunkId = insertedIds[i];
        const spec = specs[i];
        if (chunkId === undefined || spec === undefined) continue;
        await ctx.scheduler.runAfter(0, internal.ai.embeddings.generateChatChunkEmbedding, {
          chatChunkId: chunkId,
          text: spec.text,
        });
      }
    }

    return null;
  },
});
