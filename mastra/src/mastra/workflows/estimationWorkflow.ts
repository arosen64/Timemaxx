/**
 * Estimation workflow — single-step pipeline that runs the estimationAgent
 * and validates its structured output with Zod.
 *
 * Triggered by the Convex `estimateTaskTime` internal action via the
 * MastraClient SDK. The action is responsible for fetching context from the
 * database, building the prompt, and storing the result; this workflow only
 * owns the LLM call.
 *
 * Input:  { contextPrompt: string } — the fully-assembled prompt from
 *         `buildTimeEstimatePrompt()` in estimateTaskTime.prompt.ts.
 * Output: EstimationAgentOutput    — estimatedMinutes + reasoningTrace.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { estimationAgent } from "../agents/estimationAgent";
import { estimationAgentOutputSchema } from "../lib/prompts/estimationAgent.prompt";

/** Passes the assembled context prompt to the estimationAgent and returns its structured output. */
const estimationAgentStep = createStep({
  id: "estimation-agent",
  inputSchema: z.object({
    contextPrompt: z.string().describe(
      "Full context prompt: task details + course context + prior task history + chat history + student profile",
    ),
  }),
  outputSchema: estimationAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await estimationAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: estimationAgentOutputSchema },
    });
    if (!response.object) throw new Error("estimationAgent returned no structured output");
    return response.object;
  },
});

export const estimationWorkflow = createWorkflow({
  id: "estimation-workflow",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: estimationAgentOutputSchema,
})
  .then(estimationAgentStep)
  .commit();
