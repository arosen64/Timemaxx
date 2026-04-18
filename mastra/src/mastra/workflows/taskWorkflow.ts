import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { taskAgent } from "../agents/taskAgent";
import {
  taskAgentOutputSchema,
  type TaskAgentOutput,
} from "../lib/prompts/taskAgent.prompt";

export { taskAgentOutputSchema, type TaskAgentOutput };

const taskAgentStep = createStep({
  id: "task-agent",
  inputSchema: z.object({
    contextPrompt: z.string().describe(
      "Full context prompt: today's date + conversation history + resolved task info",
    ),
  }),
  outputSchema: taskAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await taskAgent.generate(inputData.contextPrompt, {
      structuredOutput: { schema: taskAgentOutputSchema },
    });
    return response.object;
  },
});

export const taskWorkflow = createWorkflow({
  id: "task-workflow",
  inputSchema: z.object({
    contextPrompt: z.string(),
  }),
  outputSchema: taskAgentOutputSchema,
})
  .then(taskAgentStep)
  .commit();
