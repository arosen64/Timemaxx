"use node";

import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const EMBEDDING_MODEL = "gemini-embedding-001";

/** 3072-dim embeddings; matches tasks/userCourses vector indexes. */
export async function embedGeminiText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const google = createGoogleGenerativeAI({ apiKey });
  const { embedding } = await embed({
    model: google.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}
