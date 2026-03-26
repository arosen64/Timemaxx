"use node"; // Required: @google/genai uses Node.js APIs not available in the default Convex runtime

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GoogleGenAI, Type, FileState } from "@google/genai";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.CSCI.601.226"
  title: string;
  credits: number;
  term: string; // e.g. "Fall 2022"
  grade: string; // e.g. "A", "A-", "B+"
}

/**
 * Parses a JHU transcript PDF using Gemini and returns extracted courses.
 *
 * Flow:
 * 1. Upload the PDF to the Gemini Files API (avoids inline data size limits).
 * 2. Poll until the file is ACTIVE (usually instant for small PDFs).
 * 3. Call generateContent referencing the uploaded file URI.
 * 4. Delete the uploaded file from Gemini storage.
 * 5. Return the structured course list for the caller to review and save.
 */
export const parseTranscript = action({
  args: {
    fileBase64: v.string(), // raw base64-encoded PDF (no data URL prefix)
  },
  handler: async (ctx, args): Promise<ParsedCourse[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const genai = new GoogleGenAI({ apiKey });

    // 1. Upload PDF to Gemini Files API
    const pdfBuffer = Buffer.from(args.fileBase64, "base64");
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });

    const uploadedFile = await genai.files.upload({
      file: blob,
      config: { mimeType: "application/pdf", displayName: "transcript.pdf" },
    });

    if (!uploadedFile.uri || !uploadedFile.name) {
      throw new Error("File upload to Gemini failed");
    }

    // 2. Poll until the file is ACTIVE (processing is usually instant)
    let fileInfo = uploadedFile;
    let attempts = 0;
    while (fileInfo.state === FileState.PROCESSING && attempts < 10) {
      await new Promise((r) => setTimeout(r, 1000));
      fileInfo = await genai.files.get({ name: uploadedFile.name! });
      attempts++;
    }

    if (fileInfo.state !== FileState.ACTIVE) {
      await genai.files.delete({ name: uploadedFile.name! }).catch(() => {});
      throw new Error("Gemini file processing failed or timed out");
    }

    try {
      // 3. Call Gemini referencing the uploaded file URI
      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: "application/pdf",
                  fileUri: uploadedFile.uri!,
                },
              },
              {
                text: `You are a JHU transcript parser. Extract every individual course row from this Johns Hopkins University transcript.

For each course provide:
- courseCode: JHU course code combining DIV and CRSE# only, separated by a dot (e.g. "EN.601.226", "AS.110.201"). Do NOT include the DEPT column.
- title: the full course title as it appears
- credits: numeric credit value from the CREDITS column (number, e.g. 3.0)
- term: semester and year as "Season YYYY" (e.g. "Fall 2022", "Spring 2023") — no major name suffix
- grade: letter grade as shown (e.g. "A", "A+", "A-", "B+", "S", "NG", "X")

Only return actual course rows. Skip summary rows (TERM GPA, CUM GPA, totals, Dean's List). Skip rows with no course code or grade.`,
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
    } finally {
      // 4. Always clean up the uploaded file from Gemini storage
      await genai.files.delete({ name: uploadedFile.name! }).catch(() => {});
    }
  },
});
