import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { preferencesAgent } from "../agents/preferencesAgent";
import {
  preferencesAgentOutputSchema,
  type PreferencesAgentOutput,
} from "../lib/prompts/preferencesAgent.prompt";

export { preferencesAgentOutputSchema, type PreferencesAgentOutput };

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
