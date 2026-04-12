"use node";

import OpenAI from "openai";

const OPENAI_MODEL = "gpt-4o-mini";

/**
 * Calls GPT-4o mini with structured JSON output and returns the parsed response.
 * Uses OpenAI's json_object response format — prompt must instruct the model to
 * return JSON.
 */
export async function callOpenAIJSON<T>(prompt: string): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text) as T;
}
