import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supervisorAgent, type Route } from "../agents/supervisorAgent";

const routeEnum = z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]);
const entityKindEnum = z.enum(["task", "class", "both", "none"]);
const messageTagEnum = z.enum(["task_feedback", "class_difficulty", "none"]);

const supervisorOutputSchema = z.object({
  needsDomainClarification: z.boolean(),
  domainClarifyingQuestion: z.string().nullable(),
  needsEntityClarification: z.boolean(),
  entityKind: entityKindEnum,
  messageTag: messageTagEnum,
  tagConfidence: z.number().min(0).max(1),
  route: routeEnum.nullable(),
  reasoning: z.string(),
});

const superviseStepOutputSchema = supervisorOutputSchema.extend({
  originalQuery: z.string(),
});

const superviseStep = createStep({
  id: "supervise",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: superviseStepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await supervisorAgent.generate(inputData.query, {
      structuredOutput: { schema: supervisorOutputSchema },
    });
    return { ...response.object, originalQuery: inputData.query };
  },
});

const CANNED_RESPONSES: Partial<Record<Route, string>> = {
  tasks:
    "Yes — you can create tasks in TimeMaxx. Open **Tasks** from the app to add an assignment, set a due date, and link it to a class if you want. If you describe what you’re working on, I can help you break it down or think about time.",
  preferences:
    "You can update study preferences (focus length, work hours, and similar options) from the **Preferences** page.",
  feedback:
    "To rate how long something took versus the estimate, or give time feedback, use the feedback options on a task or visit the **Feedback** / task-detail flow from your list.",
  classes:
    "To add or remove a course, or to upload a class syllabus, please visit the **Classes** page — you can manage all of that there.",
  schedule:
    "To schedule or manage your study blocks, visit the **Schedule** page. To connect or revoke Google Calendar access, head to the **Profile** page.",
};

const respondStep = createStep({
  id: "respond",
  inputSchema: superviseStepOutputSchema,
  outputSchema: z.object({
    status: z.enum([
      "needs_domain_clarification",
      "needs_entity_clarification",
      "routed",
    ]),
    clarifyingQuestion: z.string().nullable(),
    entityKind: entityKindEnum,
    messageTag: messageTagEnum,
    tagConfidence: z.number(),
    route: routeEnum.nullable(),
    reasoning: z.string().nullable(),
    query: z.string().nullable(),
    cannedResponse: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const s = inputData;
    const originalQuery = s.originalQuery;

    if (s.needsDomainClarification) {
      return {
        status: "needs_domain_clarification" as const,
        clarifyingQuestion: s.domainClarifyingQuestion,
        entityKind: "none" as const,
        messageTag: "none" as const,
        tagConfidence: 0,
        route: null,
        reasoning: null,
        query: null,
        cannedResponse: null,
      };
    }

    if (s.needsEntityClarification && s.entityKind !== "none") {
      return {
        status: "needs_entity_clarification" as const,
        clarifyingQuestion: null,
        entityKind: s.entityKind,
        messageTag: s.messageTag,
        tagConfidence: s.tagConfidence,
        route: s.route,
        reasoning: s.reasoning,
        query: originalQuery,
        cannedResponse: null,
      };
    }

    const route = s.route as Route | null;
    if (!route) {
      return {
        status: "routed" as const,
        clarifyingQuestion: null,
        entityKind: "none" as const,
        messageTag: s.messageTag,
        tagConfidence: s.tagConfidence,
        route: null,
        reasoning: s.reasoning,
        query: originalQuery,
        cannedResponse: null,
      };
    }

    const cannedResponse = CANNED_RESPONSES[route] ?? null;
    return {
      status: "routed" as const,
      clarifyingQuestion: null,
      entityKind: "none" as const,
      messageTag: s.messageTag,
      tagConfidence: s.tagConfidence,
      route,
      reasoning: s.reasoning,
      query: originalQuery,
      cannedResponse,
    };
  },
});

export const supervisorWorkflow = createWorkflow({
  id: "supervisor-workflow",
  inputSchema: z.object({
    query: z.string().describe("The user's raw input message"),
  }),
  outputSchema: z.object({
    status: z.enum([
      "needs_domain_clarification",
      "needs_entity_clarification",
      "routed",
    ]),
    clarifyingQuestion: z.string().nullable(),
    entityKind: entityKindEnum,
    messageTag: messageTagEnum,
    tagConfidence: z.number(),
    route: routeEnum.nullable(),
    reasoning: z.string().nullable(),
    query: z.string().nullable(),
    cannedResponse: z.string().nullable(),
  }),
})
  .then(superviseStep)
  .then(respondStep)
  .commit();
