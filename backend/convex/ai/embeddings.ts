"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const EMBEDDING_MODEL = "gemini-embedding-001";

async function computeEmbedding(title: string, description?: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const google = createGoogleGenerativeAI({ apiKey });
  const input = description ? `${title}\n\n${description}` : title;

  const { embedding } = await embed({
    model: google.embedding(EMBEDDING_MODEL),
    value: input,
  });

  return embedding;
}

export const generateCourseEmbedding = internalAction({
  args: {
    userCourseId: v.id("userCourses"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const embedding = await computeEmbedding(args.title, args.description);
    await ctx.runMutation(internal.mutations.userCourses.patchCourseEmbedding, {
      userCourseId: args.userCourseId,
      embedding,
    });
  },
});

export const generateTaskEmbedding = internalAction({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const embedding = await computeEmbedding(args.title, args.description);
    await ctx.runMutation(internal.mutations.tasks.patchTaskEmbedding, {
      taskId: args.taskId,
      embedding,
    });
  },
});