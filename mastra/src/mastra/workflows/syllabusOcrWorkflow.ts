import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

const ocrStep = createStep({
  id: "ocr",
  inputSchema: z.object({
    fileContents: z.string(),
  }),
  outputSchema: z.object({
    extractedText: z.string(),
  }),
  execute: async ({ inputData }) => {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return { extractedText: inputData.fileContents };

    const client = new Mistral({ apiKey });
    try {
      const blob = new Blob([inputData.fileContents], { type: "text/plain" });
      const uploaded = await client.files.upload({
        file: new File([blob], "syllabus.txt", { type: "text/plain" }),
        purpose: "ocr",
      });

      try {
        const response = await client.ocr.process({
          model: "mistral-ocr-latest",
          document: { type: "file", fileId: uploaded.id },
        });
        const extractedText = response.pages?.map((p) => p.markdown).join("\n\n") ?? inputData.fileContents;
        return { extractedText: extractedText || inputData.fileContents };
      } finally {
        await client.files.delete({ fileId: uploaded.id }).catch(() => {});
      }
    } catch {
      return { extractedText: inputData.fileContents };
    }
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
