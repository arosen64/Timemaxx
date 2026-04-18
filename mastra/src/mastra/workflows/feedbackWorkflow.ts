import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { feedbackAgent } from "../agents/feedbackAgent";
import {
  feedbackAgentOutputSchema,
  type FeedbackAgentOutput,
} from "../lib/prompts/feedbackAgent.prompt";

export { feedbackAgentOutputSchema, type FeedbackAgentOutput };

const feedbackAgentStep = createStep({
  id: "feedback-agent",
  inputSchema: z.object({
    contextPrompt: z.string().describe(
      "Full context prompt: today's date + conversation history + resolved entity info",
    ),
  }),
  outputSchema: feedbackAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await feedbackAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: feedbackAgentOutputSchema },
    });
    return response.object;
  },
});

export const feedbackWorkflow = createWorkflow({
  id: "feedback-workflow",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: feedbackAgentOutputSchema,
})
  .then(feedbackAgentStep)
  .commit();
