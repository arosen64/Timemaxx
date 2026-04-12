import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { feedbackAgent } from "../agents/feedbackAgent";

export const feedbackAgentOutputSchema = z.object({
  message: z.string(),
  intent: z.enum(["task_feedback", "class_feedback", "unknown"]),
  needsTaskClarification: z.boolean(),
  needsClassClarification: z.boolean(),
  readyToRecord: z.boolean(),
  effortRating: z.enum(["easier", "about_right", "harder"]).nullable(),
  actualMinutes: z.number().nullable(),
  whatWasHard: z.string().nullable(),
  reasoning: z.string(),
});

export type FeedbackAgentOutput = z.infer<typeof feedbackAgentOutputSchema>;

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
