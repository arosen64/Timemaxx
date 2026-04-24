import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

export function createOcrWorkflow(id: string, filename: string) {
  const ocrStep = createStep({
    id: "ocr",
    inputSchema: z.object({
      // Base64-encoded PDF bytes
      fileContents: z.string(),
    }),
    outputSchema: z.object({
      extractedText: z.string(),
    }),
    execute: async ({ inputData }) => {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new Error("MISTRAL_API_KEY is not set");

      const client = new Mistral({ apiKey });
      const buffer = Buffer.from(inputData.fileContents, "base64");
      const blob = new Blob([buffer], { type: "application/pdf" });
      const uploaded = await client.files.upload({
        file: new File([blob], filename, { type: "application/pdf" }),
        purpose: "ocr",
      });

      try {
        const response = await client.ocr.process({
          model: "mistral-ocr-latest",
          document: { type: "file", fileId: uploaded.id },
        });
        const extractedText = response.pages?.map((p) => p.markdown).join("\n\n") ?? "";
        if (!extractedText) throw new Error("Mistral OCR returned no text from the document");
        return { extractedText };
      } finally {
        await client.files.delete({ fileId: uploaded.id }).catch(() => {});
      }
    },
  });

  return createWorkflow({
    id,
    inputSchema: z.object({
      fileContents: z.string(),
    }),
    outputSchema: z.object({
      extractedText: z.string(),
    }),
  })
    .then(ocrStep)
    .commit();
}
