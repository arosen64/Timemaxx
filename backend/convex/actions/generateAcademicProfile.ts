"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Type } from "@google/genai";
import { callGeminiJSON } from "../lib/gemini";

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
        difficultyRating: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<AcademicInsight[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const courseList = args.courses
      .map(
        (c) =>
          `${c.title}${c.grade ? ` (${c.grade})` : ""}${c.term ? ` — ${c.term}` : ""}${c.difficultyRating != null ? ` [difficulty: ${c.difficultyRating}/5]` : ""}`
      )
      .join("\n");

    const prompt = `You are an academic advisor analyzing a student's transcript.

Courses taken (difficulty rating 1–5 is self-reported by the student, where 5 is hardest):
${courseList}

Generate exactly 5 short, specific insights about this student's academic profile based solely on the courses, grades, and difficulty ratings above. Each insight must use exactly these labels in this order:
1. label: "Academic Strengths"
2. label: "Areas for Improvement"
3. label: "Performance Trend"
4. label: "Course Load & Patterns"
5. label: "Study Recommendations"

Each insight's text is a 1–2 sentence description grounded in the actual data.

Be specific to their actual courses and grades. Be encouraging but honest. Keep each description under 40 words.`;

    const json = await callGeminiJSON<{ insights: AcademicInsight[] }>(
      [{ role: "user", parts: [{ text: prompt }] }],
      {
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
      }
    );
    return (json.insights ?? []).slice(0, 5);
  },
});
