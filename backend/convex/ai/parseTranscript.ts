import { action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MastraClient } from "@mastra/client-js";
import { sanitizeUserInput } from "../lib/sanitize";
import { withTimeout } from "../lib/withTimeout";

export interface ParsedCourse {
  courseCode: string; // e.g. "EN.601.226"
  title: string;
  credits: number;
  term: string; // e.g. "Fall 2022"
  grade: string; // e.g. "A", "A-", "B+"
}

const MAX_CHARS = 1_000_000;
// ~1 MB of base64-encoded PDF bytes (~750 KB binary)
const MAX_PDF_BASE64_CHARS = 1_500_000;

/**
 * Parses a JHU transcript using Mastra:
 * 1. `transcript-ocr-workflow`   — Mistral OCR extracts text from base64-encoded PDF bytes
 * 2. `sanitizeUserInput`         — prompt-injection sanitizer runs on the OCR output
 * 3. `transcript-parse-workflow` — Claude agent extracts structured course data
 */
export const parseTranscript = action({
  args: {
    fileContents: v.string(),
  },
  handler: async (ctx, args): Promise<ParsedCourse[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    if (args.fileContents.length > MAX_PDF_BASE64_CHARS) {
      throw new Error("PDF exceeds maximum upload size of 1 MB");
    }

    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) throw new Error("MASTRA_URL not configured");
    const client = new MastraClient({ baseUrl: mastraUrl });

    // OCR: extract text from the base64-encoded PDF
    const ocrWf = client.getWorkflow("transcript-ocr-workflow");
    const ocrRun = await withTimeout(
      ocrWf.startAsync({ inputData: { fileContents: args.fileContents } }),
      "Transcript OCR"
    );
    const ocrStep = ocrRun.steps?.["ocr"] as
      | { status: string; output?: { extractedText?: string }; error?: string | Error }
      | undefined;
    if (!ocrStep || ocrStep.status !== "success") {
      const cause = ocrStep?.error ? String(ocrStep.error) : "step did not complete";
      throw new Error(`Transcript OCR failed: ${cause}`);
    }
    const ocrText = ocrStep.output?.extractedText ?? "";
    if (!ocrText) {
      throw new Error("Transcript OCR did not return any text");
    }

    // Sanitize — prompt-injection guard before sending to Claude
    const sanitizedText = sanitizeUserInput(ocrText, MAX_CHARS);

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
      .filter((c) => c.courseCode?.trim() && c.title?.trim() && c.term?.trim() && c.grade?.trim())
      .map((c) => ({ ...c }));
  },
});
