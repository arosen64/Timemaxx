import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { taskAgent } from "../agents/taskAgent";

export const taskAgentOutputSchema = z.object({
  message: z.string(),
  intent: z.enum(["create", "rud", "unknown"]),
  needsEntityClarification: z.boolean(),
  needsClassClarification: z.boolean(),
  readyToExecute: z.boolean(),
  actionType: z.enum(["create_task", "update_task", "delete_task", "read_task", "none"]),
  title: z.string().nullable(),
  description: z.string().nullable(),
  taskType: z.string().nullable(),
  dueDateIso: z.string().nullable(),
  classTag: z.string().nullable(),
  deleteConfirmed: z.boolean(),
  updatedTitle: z.string().nullable(),
  updatedDescription: z.string().nullable(),
  updatedTaskType: z.string().nullable(),
  updatedDueDateIso: z.string().nullable(),
  updatedClassTag: z.string().nullable(),
  reasoning: z.string(),
});

export type TaskAgentOutput = z.infer<typeof taskAgentOutputSchema>;

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
