import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

export const syllabusOcrTool = createTool({
  id: "syllabus-ocr",
  description: "Extract text from a syllabus document using Mistral OCR",
  inputSchema: z.object({
    fileContents: z.string().describe("The syllabus file contents to process"),
  }),
  outputSchema: z.object({
    extractedText: z.string().describe("The text extracted from the syllabus"),
  }),
  execute: async ({ context }) => {
    const blob = new Blob([context.fileContents], { type: "text/plain" });

    const uploaded = await client.files.upload({
      file: new File([blob], "syllabus.txt", { type: "text/plain" }),
      purpose: "ocr",
    });

    try {
      const response = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "file",
          fileId: uploaded.id,
        },
      });

      const extractedText = response.pages
        .map((page) => page.markdown)
        .join("\n\n");

      return { extractedText };
    } finally {
      await client.files.delete({ fileId: uploaded.id }).catch(() => {});
    }
  },
});
