"use node";

import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

/**
 * Calls Gemini with structured JSON output and returns the parsed response body.
 * `contents` accepts either a plain prompt string or a role/parts array.
 */
export async function callGeminiJSON<T>(
  contents: string | Array<{ role: string; parts: Array<{ text: string }> }>,
  config: GenerateContentConfig
): Promise<T> {
  const genai = createGeminiClient();
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config,
  });
  return JSON.parse(response.text ?? "{}") as T;
}
