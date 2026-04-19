"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { embedGeminiText } from "../lib/geminiEmbedding";

async function computeEmbedding(title: string, description?: string): Promise<number[]> {
  const input = description ? `${title}\n\n${description}` : title;
  return embedGeminiText(input);
}

export const generateCourseEmbedding = internalAction({
  args: {
    userCourseId: v.id("userCourses"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embedding = await computeEmbedding(args.title, args.description);
    await ctx.runMutation(internal.mutations.userCourses.patchCourseEmbedding, {
      userCourseId: args.userCourseId,
      embedding,
    });
    return null;
  },
});

export const generateTaskEmbedding = internalAction({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embedding = await computeEmbedding(args.title, args.description);
    await ctx.runMutation(internal.mutations.tasks.patchTaskEmbedding, {
      taskId: args.taskId,
      embedding,
    });
    return null;
  },
});

export const generateSubtaskEmbedding = internalAction({
  args: {
    subtaskId: v.id("subtasks"),
    title: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embedding = await computeEmbedding(args.title, args.description);
    await ctx.runMutation(internal.mutations.subtasks.patchSubtaskEmbedding, {
      subtaskId: args.subtaskId,
      embedding,
    });
    return null;
  },
});

/** Used by chat RAG retrieval; same model/dimensions as task/course/chunk embeddings. */
export const embedRetrievalQueryInternal = internalAction({
  args: { text: v.string() },
  returns: v.union(v.array(v.float64()), v.null()),
  handler: async (_ctx, args) => {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    try {
      return await embedGeminiText(args.text);
    } catch {
      return null;
    }
  },
});

/** Same 3072-dim Gemini pipeline as tasks/courses; patches `chatChunks.embedding`. */
export const generateChatChunkEmbedding = internalAction({
  args: {
    chatChunkId: v.id("chatChunks"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    try {
      const embedding = await embedGeminiText(args.text);
      await ctx.runMutation(internal.mutations.chatChunkEmbeddings.patchChatChunkEmbedding, {
        chatChunkId: args.chatChunkId,
        embedding,
      });
    } catch {
      // Best-effort: chunk rebuild may have deleted the row; embedding can fail transiently.
    }
    return null;
  },
});