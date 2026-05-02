import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { syllabusAgent } from "../agents/syllabusAgent";
import {
  syllabusResponseSchema,
  buildSyllabusParsePrompt,
  type SyllabusResponse,
} from "../lib/prompts/syllabusAgent.prompt";

// sanitizedText must have had sanitizeUserInput applied before reaching this workflow.
const parseStep = createStep({
  id: "parse",
  inputSchema: z.object({
    sanitizedText: z.string(),
  }),
  outputSchema: syllabusResponseSchema,
  execute: async ({ inputData }) => {
    const result = await syllabusAgent.generate(buildSyllabusParsePrompt(inputData.sanitizedText), {
      structuredOutput: { schema: syllabusResponseSchema },
    });
    return result.object as SyllabusResponse;
  },
});

export const syllabusParseWorkflow = createWorkflow({
  id: "syllabus-parse-workflow",
  inputSchema: z.object({
    sanitizedText: z.string(),
  }),
  outputSchema: syllabusResponseSchema,
})
  .then(parseStep)
  .commit();
