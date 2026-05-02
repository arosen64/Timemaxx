/**
 * Subtask generation workflow — single-step pipeline that runs the subtaskAgent
 * and validates its structured output with Zod.
 *
 * Triggered by the Convex `generateSubtasks` internal action via the
 * MastraClient SDK. The action is responsible for assembling the task context
 * into a prompt and persisting the result; this workflow only owns the LLM call.
 *
 * Input:  { contextPrompt: string } — assembled from task title, type, due date,
 *         description, and optional uploaded file content.
 * Output: SubtaskAgentOutput        — array of { title, description, taskType }.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { subtaskAgent } from "../agents/subtaskAgent";
import { subtaskAgentOutputSchema } from "../lib/prompts/subtaskAgent.prompt";

const SUBTASK_STEP_ID = "subtask-generation-step";

/** Passes the assembled context prompt to the subtaskAgent and returns its structured output. */
const subtaskGenerationStep = createStep({
  id: SUBTASK_STEP_ID,
  inputSchema: z.object({
    contextPrompt: z
      .string()
      .describe(
        "Full context prompt: assignment title, type, due date, description, and optional file content"
      ),
  }),
  outputSchema: subtaskAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await subtaskAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: subtaskAgentOutputSchema },
    });
    if (!response.object) throw new Error("subtaskAgent returned no structured output");
    const subtasks = response.object.subtasks;
    if (!Array.isArray(subtasks)) {
      throw new Error("subtaskAgent returned a non-array subtasks value");
    }
    return { subtasks };
  },
});

export const subtaskGenerationWorkflow = createWorkflow({
  id: "subtask-generation-workflow",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: subtaskAgentOutputSchema,
})
  .then(subtaskGenerationStep)
  .commit();

export { SUBTASK_STEP_ID };
