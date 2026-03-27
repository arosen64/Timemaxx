"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.CSCI.601.226"
  title: string;
  credits: number;
  term: string; // e.g. "Fall 2022"
  grade: string; // e.g. "A", "A-", "B+"
}

/**
 * Parses a JHU transcript using Gemini and returns extracted courses.
 * Accepts pre-extracted text (via pdfjs-dist on the client).
 */
export const parseTranscript = action({
  args: {
    fileText: v.string(),
  },
  handler: async (ctx, args): Promise<ParsedCourse[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const genai = new GoogleGenAI({ apiKey });

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a JHU transcript parser. Extract every individual course row from the following Johns Hopkins University transcript text.

For each course provide:
- courseCode: JHU course code combining DIV and CRSE# only, separated by a dot (e.g. "EN.601.226", "AS.110.201"). Do NOT include the DEPT column.
- title: the full course title as it appears
- credits: numeric credit value from the CREDITS column (number, e.g. 3.0)
- term: semester and year as "Season YYYY" (e.g. "Fall 2022", "Spring 2023") — no major name suffix
- grade: letter grade as shown (e.g. "A", "A+", "A-", "B+", "S", "NG", "X")

Only return actual course rows. Skip summary rows (TERM GPA, CUM GPA, totals, Dean's List). Skip rows with no course code or grade.

Transcript text:
${args.fileText}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            courses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  courseCode: { type: Type.STRING },
                  title: { type: Type.STRING },
                  credits: { type: Type.NUMBER },
                  term: { type: Type.STRING },
                  grade: { type: Type.STRING },
                },
                required: ["courseCode", "title", "credits", "term", "grade"],
              },
            },
          },
          required: ["courses"],
        },
      },
    });

    const json = JSON.parse(response.text ?? "{}");
    const raw: ParsedCourse[] = json.courses ?? [];

    return raw.filter(
      (c) =>
        c.courseCode?.trim() &&
        c.title?.trim() &&
        c.term?.trim() &&
        c.grade?.trim()
    );
  },
});
