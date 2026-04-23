import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput } from "../lib/sanitize";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.601.226"
  title: string;
  credits: number;
  term: string; // e.g. "Fall 2022"
  grade: string; // e.g. "A", "A-", "B+"
}

/**
 * Parses a JHU transcript using Mastra:
 *
 * PDF path:
 * 1. `transcript-ocr-workflow`   — Mistral OCR extracts text from base64-encoded PDF bytes
 * 2. `sanitizeUserInput`         — prompt-injection sanitizer runs on the OCR output
 * 3. `transcript-parse-workflow` — Claude agent extracts structured course data
 *
 * Text path (mimeType !== "application/pdf"):
 * 1. `sanitizeUserInput`         — prompt-injection sanitizer runs on the raw text
 * 2. `transcript-parse-workflow` — Claude agent extracts structured course data
 */
export const parseTranscript = action({
  args: {
    fileContents: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ParsedCourse[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) throw new Error("MASTRA_URL not configured");
    const client = new MastraClient({ baseUrl: mastraUrl });

    const TIMEOUT_MS = 30_000;
    const MAX_CHARS = 100_000;

    function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after 30s`)), TIMEOUT_MS)
        ),
      ]);
    }

    let textForParsing: string;

    if (args.mimeType === "application/pdf") {
      // PDF path: run Mistral OCR on the base64-encoded file bytes first
      const ocrWf = client.getWorkflow("transcript-ocr-workflow");
      const ocrRun = await withTimeout(
        ocrWf.startAsync({ inputData: { fileContents: args.fileContents } }),
        "Transcript OCR"
      );
      const ocrStep = ocrRun.steps?.["ocr"];
      const ocrText =
        ocrStep && "output" in ocrStep
          ? (ocrStep.output as { extractedText?: string }).extractedText ?? ""
          : "";
      textForParsing = ocrText;
    } else {
      // Text path: content is already plain text
      textForParsing = args.fileContents;
    }

    // Sanitize — same sanitizer and character limit as the original parseTranscript action
    const sanitizedText = sanitizeUserInput(textForParsing, MAX_CHARS);

    // Parse — Claude agent extracts structured course data
    // Workflow expects already-sanitized input; do not call without sanitizing first.
    const parseWf = client.getWorkflow("transcript-parse-workflow");
    const parseRun = await withTimeout(
      parseWf.startAsync({ inputData: { sanitizedText } }),
      "Transcript parse"
    );

    const parseStep = parseRun.steps?.["parse"];
    if (!parseStep || parseStep.status !== "success" || !("output" in parseStep)) {
      throw new Error("Transcript parse workflow did not complete successfully");
    }

    const parseOutput = parseStep.output as {
      isJhuTranscript: boolean;
      courses: ParsedCourse[];
    };

    if (parseOutput.isJhuTranscript === false) {
      throw new Error("NOT_JHU_TRANSCRIPT");
    }

    const raw: ParsedCourse[] = parseOutput.courses ?? [];

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
