import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supervisorAgent } from "../agents/supervisorAgent";
import { supervisorAgentOutputSchema } from "../lib/prompts/supervisorAgent.prompt";

const routeStep = createStep({
  id: "route",
  inputSchema: z.object({
    query: z.string().describe("The user's raw input message"),
  }),
  outputSchema: supervisorAgentOutputSchema,
  execute: async ({ inputData }) => {
    const response = await supervisorAgent.generate(inputData.query, {
      structuredOutput: {
        schema: supervisorAgentOutputSchema,
      },
    });
    return response.object;
  },
});

export const supervisorWorkflow = createWorkflow({
  id: "supervisor-workflow",
  inputSchema: z.object({
    query: z.string().describe("The user's raw input message"),
  }),
  outputSchema: supervisorAgentOutputSchema,
})
  .then(routeStep)
  .commit();
