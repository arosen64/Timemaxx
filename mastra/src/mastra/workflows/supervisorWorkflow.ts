import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supervisorAgent } from "../agents/supervisorAgent";

const routeEnum = z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]);

const routeStep = createStep({
  id: "route",
  inputSchema: z.object({
    query: z.string().describe("The user's raw input message"),
  }),
  outputSchema: z.object({
    route: routeEnum.nullable(),
    needsDomainClarification: z.boolean(),
    domainClarifyingQuestion: z.string().nullable(),
    reasoning: z.string(),
  }),
  execute: async ({ inputData }) => {
    const response = await supervisorAgent.generate(inputData.query, {
      structuredOutput: {
        schema: z.object({
          route: routeEnum.nullable(),
          needsDomainClarification: z.boolean(),
          domainClarifyingQuestion: z.string().nullable(),
          reasoning: z.string(),
        }),
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
  outputSchema: z.object({
    route: routeEnum.nullable(),
    needsDomainClarification: z.boolean(),
    domainClarifyingQuestion: z.string().nullable(),
    reasoning: z.string(),
  }),
})
  .then(routeStep)
  .commit();
