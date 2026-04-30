import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { transcriptAgent } from "../agents/transcriptAgent";
import {
  transcriptResponseSchema,
  buildTranscriptParsePrompt,
  type TranscriptResponse,
} from "../lib/prompts/transcriptAgent.prompt";

// sanitizedText must have had sanitizeUserInput applied before reaching this workflow.
const parseStep = createStep({
  id: "parse",
  inputSchema: z.object({
    sanitizedText: z.string(),
  }),
  outputSchema: transcriptResponseSchema,
  execute: async ({ inputData }) => {
    const result = await transcriptAgent.generate(
      buildTranscriptParsePrompt(inputData.sanitizedText),
      { structuredOutput: { schema: transcriptResponseSchema } }
    );
    return result.object as TranscriptResponse;
  },
});

export const transcriptParseWorkflow = createWorkflow({
  id: "transcript-parse-workflow",
  inputSchema: z.object({
    sanitizedText: z.string(),
  }),
  outputSchema: transcriptResponseSchema,
})
  .then(parseStep)
  .commit();
