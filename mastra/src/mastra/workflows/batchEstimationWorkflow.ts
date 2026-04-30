/**
 * Batch estimation workflow — fans out estimation across an array of subtasks
 * in parallel using Mastra's `.foreach()` control flow.
 *
 * Input:  Array of { subtaskId, contextPrompt } — one entry per subtask.
 * Output: Array of { subtaskId, estimatedMinutes, reasoningTrace } — same order.
 *
 * Concurrency is set to 10 so that up to 10 LLM calls run simultaneously.
 * Triggered by the Convex `estimateSubtasksBatch` internal action.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { estimationAgent } from "../agents/estimationAgent";
import { estimationAgentOutputSchema } from "../lib/prompts/estimationAgent.prompt";

const batchItemSchema = z.object({
  subtaskId: z.string(),
  contextPrompt: z.string(),
});

const batchResultSchema = z.object({ subtaskId: z.string() }).merge(estimationAgentOutputSchema);

/** Estimates one subtask; used as the foreach body. */
const estimateSubtaskStep = createStep({
  id: "estimate-subtask",
  inputSchema: batchItemSchema,
  outputSchema: batchResultSchema,
  execute: async ({ inputData }) => {
    const response = await estimationAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: estimationAgentOutputSchema },
    });
    if (!response.object) {
      throw new Error(`estimationAgent returned no output for subtask ${inputData.subtaskId}`);
    }
    const minutes = response.object.estimatedMinutes;
    if (!Number.isFinite(minutes)) {
      throw new Error(
        `estimationAgent returned non-numeric estimatedMinutes for subtask ${inputData.subtaskId}`
      );
    }
    return {
      subtaskId: inputData.subtaskId,
      ...response.object,
      estimatedMinutes: Math.max(1, Math.round(minutes)),
    };
  },
});

export const batchEstimationWorkflow = createWorkflow({
  id: "batch-estimation-workflow",
  inputSchema: z.array(batchItemSchema),
  outputSchema: z.array(batchResultSchema),
})
  .foreach(estimateSubtaskStep, { concurrency: 10 })
  .commit();
