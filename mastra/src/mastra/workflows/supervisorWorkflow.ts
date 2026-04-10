import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { clarifierAgent, supervisorAgent, type Route } from "../agents/supervisorAgent";

// ─── Step 1: Clarifier ────────────────────────────────────────────────────────
// Determines if the query has enough detail or asks a follow-up question.

const clarifyStep = createStep({
  id: "clarify",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    needsClarification: z.boolean(),
    clarifyingQuestion: z.string().nullable(),
    refinedQuery: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const schema = z.object({
      needsClarification: z.boolean(),
      clarifyingQuestion: z.string().nullable(),
      refinedQuery: z.string().nullable(),
    });
    const response = await clarifierAgent.generate(inputData.query, {
      structuredOutput: { schema },
    });
    return response.object;
  },
});

// ─── Step 2: Supervisor Router ────────────────────────────────────────────────
// Routes a clear query to the appropriate specialist agent.

const routeStep = createStep({
  id: "route",
  inputSchema: z.object({
    needsClarification: z.boolean(),
    clarifyingQuestion: z.string().nullable(),
    refinedQuery: z.string().nullable(),
  }),
  outputSchema: z.object({
    status: z.enum(["needs_clarification", "routed"]),
    clarifyingQuestion: z.string().nullable(),
    route: z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]).nullable(),
    reasoning: z.string().nullable(),
    query: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.needsClarification) {
      return {
        status: "needs_clarification" as const,
        clarifyingQuestion: inputData.clarifyingQuestion,
        route: null,
        reasoning: null,
        query: null,
      };
    }

    const query = inputData.refinedQuery!;

    const schema = z.object({
      route: z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]),
      reasoning: z.string(),
    });
    const response = await supervisorAgent.generate(query, {
      structuredOutput: { schema },
    });

    return {
      status: "routed" as const,
      clarifyingQuestion: null,
      route: response.object.route as Route,
      reasoning: response.object.reasoning,
      query,
    };
  },
});

// Routes that have dedicated pages and return a canned redirect response
const CANNED_RESPONSES: Partial<Record<Route, string>> = {
  classes:
    "To add or remove a course, or to upload a class syllabus, please visit the **Classes** page — you can manage all of that there.",
  schedule:
    "To schedule or manage your study blocks, visit the **Schedule** page. To connect or revoke Google Calendar access, head to the **Profile** page.",
};

// ─── Step 3: Respond ──────────────────────────────────────────────────────────
// Attaches a canned response for page-specific routes; leaves response null for
// routes that should be handled by a downstream specialist agent (tasks, preferences, feedback).

const respondStep = createStep({
  id: "respond",
  inputSchema: z.object({
    status: z.enum(["needs_clarification", "routed"]),
    clarifyingQuestion: z.string().nullable(),
    route: z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]).nullable(),
    reasoning: z.string().nullable(),
    query: z.string().nullable(),
  }),
  outputSchema: z.object({
    status: z.enum(["needs_clarification", "routed"]),
    clarifyingQuestion: z.string().nullable(),
    route: z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]).nullable(),
    query: z.string().nullable(),
    // Non-null when this step has a ready answer; null when a specialist agent should handle it
    cannedResponse: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    const { status, clarifyingQuestion, route, query } = inputData;
    const cannedResponse =
      status === "routed" && route ? (CANNED_RESPONSES[route as Route] ?? null) : null;
    return { status, clarifyingQuestion, route, query, cannedResponse };
  },
});

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const supervisorWorkflow = createWorkflow({
  id: "supervisor-workflow",
  inputSchema: z.object({
    query: z.string().describe("The user's raw input message"),
  }),
  outputSchema: z.object({
    status: z.enum(["needs_clarification", "routed"]),
    clarifyingQuestion: z.string().nullable(),
    route: z.enum(["tasks", "schedule", "preferences", "feedback", "classes"]).nullable(),
    query: z.string().nullable(),
    cannedResponse: z.string().nullable(),
  }),
})
  .then(clarifyStep)
  .then(routeStep)
  .then(respondStep)
  .commit();
