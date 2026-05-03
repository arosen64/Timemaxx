/**
 * Supervisor Routing Eval
 *
 * Tests the `route` field of the supervisor agent across 5 groups:
 *   fresh | disambig (schedule vs tasks) | midflow-stay | midflow-switch | midflow-exit
 *
 * Scorer is deterministic (no LLM judge). Total: 35 cases.
 *
 * Run: npm run eval:supervisor-routing (from mastra/)
 */

import { runEvals } from "@mastra/core/evals";
import {
  createJsonFieldScorer,
  makeOnItemComplete,
  printAgentSummary,
  type ItemSummary,
} from "./eval-utils";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

const routeScorer = createJsonFieldScorer("route");

// ---------------------------------------------------------------------------
// Mid-flow input helper
// ---------------------------------------------------------------------------

function midFlow(
  activeAgent: "tasks" | "feedback" | "schedule" | "preferences" | "classes",
  historyTail: string,
  userMessage: string
): string {
  return `<active_agent>${activeAgent}</active_agent>
<conversation_history>
${historyTail}
</conversation_history>
<user_message>
${userMessage}
</user_message>`;
}

// ---------------------------------------------------------------------------
// 1. Fresh messages — 12 cases
//    One clear primary intent, active_agent = none.
// ---------------------------------------------------------------------------

const freshData: Array<{ input: string; groundTruth: string }> = [
  { input: "Create a task: CHEM Essay, Essay type, due April 20", groundTruth: "tasks" },
  { input: "Add a new homework entry for my CS class", groundTruth: "tasks" },
  { input: "Delete my calculus reading task", groundTruth: "tasks" },
  { input: "Update the due date of my bio lab report to next Friday", groundTruth: "tasks" },
  { input: "Schedule my CHEM reading for this week", groundTruth: "schedule" },
  { input: "Find time to study for my midterm", groundTruth: "schedule" },
  { input: "Connect my Google Calendar to TimeMaxx", groundTruth: "schedule" },
  { input: "Change my focus block length to 45 minutes", groundTruth: "preferences" },
  { input: "Add Organic Chemistry for Spring 2026", groundTruth: "classes" },
  { input: "Drop my Intro to Economics class", groundTruth: "classes" },
  {
    input: "That CS midterm was way harder than I expected — I spent over 6 hours on it",
    groundTruth: "feedback",
  },
  {
    input: "I want to talk about how my CHEM class is going this semester",
    groundTruth: "feedback",
  },
];

// ---------------------------------------------------------------------------
// 2. Schedule vs Tasks disambiguation — 6 cases
//    The verb determines the route, not the noun.
// ---------------------------------------------------------------------------

const disambigData: Array<{ input: string; groundTruth: string }> = [
  { input: "Schedule this assignment for me", groundTruth: "schedule" },
  { input: "Plan study time for my essay", groundTruth: "schedule" },
  { input: "When should I work on my CS homework?", groundTruth: "schedule" },
  { input: "Create a task for my essay", groundTruth: "tasks" },
  { input: "Update the title of my reading assignment", groundTruth: "tasks" },
  { input: "Can you schedule that task?", groundTruth: "schedule" },
];

// ---------------------------------------------------------------------------
// 3. Mid-flow STAY — 6 cases
//    Answer-shaped replies stay in the active agent's route.
// ---------------------------------------------------------------------------

const stayData: Array<{ input: string; groundTruth: string }> = [
  {
    input: midFlow("tasks", "assistant: What is the due date?", "Friday at 5pm"),
    groundTruth: "tasks",
  },
  {
    input: midFlow("tasks", "assistant: Which class is this for?", "no class"),
    groundTruth: "tasks",
  },
  {
    input: midFlow("tasks", "assistant: Should I generate AI subtasks? yes/no", "yes, go ahead"),
    groundTruth: "tasks",
  },
  {
    input: midFlow("classes", "assistant: Which term?", "Spring 2026"),
    groundTruth: "classes",
  },
  {
    input: midFlow("classes", "assistant: Which school?", "Krieger"),
    groundTruth: "classes",
  },
  {
    input: midFlow("schedule", "assistant: How many blocks?", "3 blocks please"),
    groundTruth: "schedule",
  },
];

// ---------------------------------------------------------------------------
// 4. Mid-flow SWITCH — 4 cases
//    User pivots to a different domain; route changes.
// ---------------------------------------------------------------------------

const switchData: Array<{ input: string; groundTruth: string }> = [
  {
    input: midFlow("tasks", "assistant: What is the title?", "actually I want to add a course"),
    groundTruth: "classes",
  },
  {
    input: midFlow(
      "tasks",
      "assistant: What is the due date?",
      "wait, schedule my CHEM reading instead"
    ),
    groundTruth: "schedule",
  },
  {
    input: midFlow("tasks", "assistant: Which class?", "change my focus length to 50 minutes"),
    groundTruth: "preferences",
  },
  {
    input: midFlow(
      "classes",
      "assistant: Which term?",
      "actually create a task for my essay first"
    ),
    groundTruth: "tasks",
  },
];

// ---------------------------------------------------------------------------
// 5. Mid-flow EXIT — 7 cases
//    Cancellation / chit-chat / generic help → route = null.
// ---------------------------------------------------------------------------

const exitData: Array<{ input: string; groundTruth: string }> = [
  {
    input: midFlow(
      "tasks",
      "assistant: What is the title?",
      "actually i no longer want to add a task"
    ),
    groundTruth: "null",
  },
  {
    input: midFlow("tasks", "assistant: What is the due date?", "nevermind, cancel that"),
    groundTruth: "null",
  },
  {
    input: midFlow("classes", "assistant: Which school?", "stop, forget it"),
    groundTruth: "null",
  },
  {
    input: midFlow("tasks", "assistant: What type?", "i just want to chat"),
    groundTruth: "null",
  },
  {
    input: midFlow("feedback", "assistant: How difficult was this?", "how are you?"),
    groundTruth: "null",
  },
  {
    input: midFlow("tasks", "assistant: What is the title?", "what can you do?"),
    groundTruth: "null",
  },
  {
    input: midFlow("schedule", "assistant: Which task?", "i changed my mind"),
    groundTruth: "null",
  },
];

export async function runSupervisorRoutingEval() {
  let totalItems = 0;
  const allScores: Record<string, unknown> = {};

  const runRouteGroup = async (
    label: string,
    data: Array<{ input: string; groundTruth: string }>
  ) => {
    if (data.length === 0) return;
    console.log(`  [${label}]`);
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data,
      target: supervisorAgent,
      scorers: [routeScorer],
      onItemComplete: makeOnItemComplete("route", "route-scorer", acc),
    });
    printAgentSummary(label, acc);
    totalItems += r.summary.totalItems;
    allScores[label] = r.scores;
  };

  await runRouteGroup("fresh", freshData);
  await runRouteGroup("disambig (schedule vs tasks)", disambigData);
  await runRouteGroup("midflow-stay", stayData);
  await runRouteGroup("midflow-switch", switchData);
  await runRouteGroup("midflow-exit", exitData);

  return { scores: allScores, summary: { totalItems } };
}
