import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { syllabusOcrTool } from "../tools/syllabusOcrTool";

const ocrStep = createStep({
  id: "ocr",
  inputSchema: z.object({
    fileContents: z.string(),
  }),
  outputSchema: z.object({
    extractedText: z.string(),
  }),
  execute: async ({ inputData }) => {
    const result = await syllabusOcrTool.execute({
      context: { fileContents: inputData.fileContents },
      mastra: undefined as never,
      runId: "",
    });
    return { extractedText: result.extractedText };
  },
});

export const syllabusOcrWorkflow = createWorkflow({
  id: "syllabus-ocr-workflow",
  inputSchema: z.object({
    fileContents: z.string(),
  }),
  outputSchema: z.object({
    extractedText: z.string(),
  }),
})
  .then(ocrStep)
  .commit();
