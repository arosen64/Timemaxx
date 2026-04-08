import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callGemini } from "../lib/gemini";
import { sanitizeUserInput, validateLength } from "../lib/sanitize";
import {
  TRANSCRIPT_SYSTEM,
  buildTranscriptPrompt,
  transcriptResponseSchema,
} from "../lib/prompts/parseTranscript.prompt";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.601.226"
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
    validateLength(args.fileText, MAX_CHARS, "fileText");

    const sanitized = sanitizeUserInput(args.fileText, MAX_CHARS);

    const json = await callGemini({
      system: TRANSCRIPT_SYSTEM,
      prompt: buildTranscriptPrompt(sanitized),
      schema: transcriptResponseSchema,
      schemaName: "TranscriptResult",
    });

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
