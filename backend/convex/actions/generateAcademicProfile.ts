"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenAI, Type } from "@google/genai";

export interface AcademicInsight {
  label: string;
  text: string;
}

export const generateAcademicProfile = action({
  args: {
    courses: v.array(
      v.object({
        title: v.string(),
        grade: v.optional(v.string()),
        term: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<AcademicInsight[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const genai = new GoogleGenAI({ apiKey });

    const courseList = args.courses
      .map(
        (c) =>
          `${c.title}${c.grade ? ` (${c.grade})` : ""}${c.term ? ` — ${c.term}` : ""}`
      )
      .join("\n");

    const prompt = `You are an academic advisor analyzing a student's transcript.

Courses taken:
${courseList}

Generate exactly 5 short, specific insights about this student's academic profile based solely on the courses and grades above. Each insight should have a concise label (2–4 words) and a 1–2 sentence description grounded in the actual data. The 5 insights must cover these topics in order:
1. Academic Strengths
2. Areas for Improvement
3. Performance Trend
4. Course Load & Patterns
5. Study Recommendations

Be specific to their actual courses and grades. Be encouraging but honest. Keep each description under 40 words.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["label", "text"],
              },
            },
          },
          required: ["insights"],
        },
      },
    });

    const json = JSON.parse(response.text ?? "{}");
    return (json.insights ?? []).slice(0, 5);
  },
});
