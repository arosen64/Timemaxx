import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { preferencesAgent } from "../agents/preferencesAgent";

export const preferencesAgentOutputSchema = z.object({
  message: z.string(),
  reasoning: z.string(),
});

export type PreferencesAgentOutput = z.infer<typeof preferencesAgentOutputSchema>;

const preferencesAgentStep = createStep({
  id: "preferences-agent",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: preferencesAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await preferencesAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: preferencesAgentOutputSchema },
    });
    return response.object;
  },
});

export const preferencesWorkflow = createWorkflow({
  id: "preferences-workflow",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: preferencesAgentOutputSchema,
})
  .then(preferencesAgentStep)
  .commit();
