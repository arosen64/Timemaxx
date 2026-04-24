/**
 * Batch estimation workflow — fans out estimation across an array of subtasks
 * in parallel using Mastra's `.foreach()` control flow.
 *
 * Input:  Array of { subtaskId, contextPrompt } — one entry per subtask.
 * Output: Array of { subtaskId, estimatedMinutes, reasoningTrace } — same order.
 *
 * Concurrency is set to 5 so that up to 5 LLM calls run simultaneously.
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

const batchResultSchema = z.object({
  subtaskId: z.string(),
  estimatedMinutes: z.number().int().positive(),
  reasoningTrace: z.object({
    classes: z.string(),
    tasks: z.string(),
    chats: z.string(),
    profile: z.string(),
  }),
});

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
    return { subtaskId: inputData.subtaskId, ...response.object };
  },
});

export const batchEstimationWorkflow = createWorkflow({
  id: "batch-estimation-workflow",
  inputSchema: z.array(batchItemSchema),
  outputSchema: z.array(batchResultSchema),
})
  .foreach(estimateSubtaskStep, { concurrency: 10 })
  .commit();
