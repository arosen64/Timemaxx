"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.601.226.FA22"
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

    const MAX_CHARS = 100_000;
    if (args.fileText.length > MAX_CHARS) {
      throw new Error("TRANSCRIPT_TOO_LARGE");
    }

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
              text: `You are a JHU transcript parser. First, determine whether the provided text is a Johns Hopkins University transcript. Set "isJhuTranscript" to true only if it is clearly a JHU transcript (contains JHU course codes, terms, and grades in the expected format). If the document is not a JHU transcript, set "isJhuTranscript" to false and return an empty courses array.

If it is a JHU transcript, extract every individual course row.

For each course provide:
- courseCode: JHU course code combining DIV and CRSE# only, separated by a dot (e.g. "EN.601.226", "AS.110.201"). Do NOT include the DEPT column.
- title: the full course title as it appears
- credits: numeric credit value from the CREDITS column (number, e.g. 3.0)
- term: semester and year as "Season YYYY" (e.g. "Fall 2022", "Spring 2023") — no major name suffix
- grade: letter grade as shown (e.g. "A", "A+", "A-", "B+", "S", "NG", "X")

Only return actual JHU course rows. Skip the following:
- Summary rows (TERM GPA, CUM GPA, totals, Dean's List)
- Rows with no course code or grade
- Advanced Placement (AP) Examination courses (sections labeled "Advanced Placement Examination")
- International Baccalaureate (IB) courses (sections labeled "International Baccalaureate")
- Any other pre-college or external curriculum courses (CLEP, dual enrollment, Cambridge A-Level, etc.)
- Transfer courses from other institutions (sections labeled with a university name other than Johns Hopkins, e.g. "Suny Binghamton", "Univ North Dakota Grand Forks")

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
            isJhuTranscript: { type: Type.BOOLEAN },
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
          required: ["isJhuTranscript", "courses"],
        },
      },
    });

    const json = JSON.parse(response.text ?? "{}");

    if (json.isJhuTranscript === false) {
      throw new Error("NOT_JHU_TRANSCRIPT");
    }

    const raw: ParsedCourse[] = json.courses ?? [];

    return raw
      .filter(
        (c) =>
          c.courseCode?.trim() &&
          c.title?.trim() &&
          c.term?.trim() &&
          c.grade?.trim()
      )
      .map((c) => ({ ...c }));
  },
});
