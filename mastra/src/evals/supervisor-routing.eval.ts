/**
 * Supervisor Routing Eval
 *
 * Evaluates whether the supervisor agent routes user messages to the correct
 * downstream route by parsing the `route` field from its structured JSON output.
 *
 * Scorer:
 *   - routeScorer (custom): extracts `route` from the agent's JSON and compares
 *     to groundTruth. Score is 1 on exact match, 0 otherwise.
 *
 * Groups covered:
 *   1. fresh      — active_agent = none; top-level route classification
 *   2. disambig   — schedule vs tasks (verb-based disambiguation)
 *   3. stay       — mid-flow; user gives an answer-shaped message → STAY
 *   4. switch     — mid-flow; user pivots to a different domain → SWITCH
 *   5. exit       — mid-flow; cancellation / chit-chat / generic help → EXIT (route = null)
 *
 * Run: npm run eval (from mastra/)
 */

import { runEvals } from "@mastra/core/evals";
import {
  createJsonFieldScorer,
  makeOnItemComplete,
  printAgentSummary,
  type ItemSummary,
} from "./eval-utils";
import { supervisorAgent } from "../mastra/agents/supervisorAgent";

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const routeScorer = createJsonFieldScorer("route");

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a user message in the structured mid-flow format the supervisor expects
 * when a sub-agent is already active.
 */
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
// 1. Fresh messages (active_agent = none)
//    Each message arrives with no active sub-agent. Supervisor must classify
//    the primary domain from the user's intent.
// ---------------------------------------------------------------------------

const freshTestData: Array<{ input: string; groundTruth: string }> = [
  // ── Tasks (6 cases) ────────────────────────────────────────────────────────
  {
    // Canonical create with all fields
    input: "Create a task: CHEM Essay, Essay type, due April 20",
    groundTruth: "tasks",
  },
  {
    // "add" as an alias for create
    input: "Add a new homework entry for my CS class",
    groundTruth: "tasks",
  },
  {
    // Delete verb — unambiguous CRUD
    input: "Delete my calculus reading task",
    groundTruth: "tasks",
  },
  {
    // "Show me" — read intent
    input: "Show me all my upcoming assignments",
    groundTruth: "tasks",
  },
  {
    // Update with a specific field change
    input: "Update the due date of my bio lab report to next Friday",
    groundTruth: "tasks",
  },
  {
    // Informal "I need to add" phrasing — still a create intent
    input: "I need to add a task for my history essay, it's due Thursday",
    groundTruth: "tasks",
  },

  // ── Schedule (6 cases) ────────────────────────────────────────────────────
  {
    // "Schedule" verb — canonical
    input: "Schedule my CHEM reading for this week",
    groundTruth: "schedule",
  },
  {
    // "Find time" — study-time verb
    input: "Find time to study for my midterm",
    groundTruth: "schedule",
  },
  {
    // "Set up a block" — calendar/block intent
    input: "Set up a study block for my CS project",
    groundTruth: "schedule",
  },
  {
    // Google Calendar import
    input: "Connect my Google Calendar to TimeMaxx",
    groundTruth: "schedule",
  },
  {
    // "when should I" phrasing → schedule
    input: "When should I work on my econ problem set this week?",
    groundTruth: "schedule",
  },
  {
    // "plan" verb — should go to schedule, not tasks
    input: "Can you plan out study sessions for my upcoming finals?",
    groundTruth: "schedule",
  },

  // ── Preferences (4 cases) ─────────────────────────────────────────────────
  {
    // Focus block length — canonical preference
    input: "Change my focus block length to 45 minutes",
    groundTruth: "preferences",
  },
  {
    // Work hours
    input: "I only want to study in the mornings — update my work hours",
    groundTruth: "preferences",
  },
  {
    // Preferred study days
    input: "Set my preferred study days to Monday, Wednesday, and Friday",
    groundTruth: "preferences",
  },
  {
    // Informal "how do I change" — still a preferences intent
    input: "How do I change how long my study sessions are?",
    groundTruth: "preferences",
  },

  // ── Classes (6 cases) ────────────────────────────────────────────────────
  {
    // Add with term
    input: "Add Organic Chemistry for Spring 2026",
    groundTruth: "classes",
  },
  {
    // View enrolled courses
    input: "Show me all the courses I'm enrolled in",
    groundTruth: "classes",
  },
  {
    // Drop a course
    input: "Drop my Intro to Economics class",
    groundTruth: "classes",
  },
  {
    // SIS / course search intent
    input: "Search for Data Structures courses available at JHU",
    groundTruth: "classes",
  },
  {
    // Syllabus upload — still classes domain
    input: "Upload the syllabus for my Organic Chemistry course",
    groundTruth: "classes",
  },
  {
    // Informal "I'm taking" with an action — add intent
    input: "I'm taking Linear Algebra this semester, can you add it?",
    groundTruth: "classes",
  },

  // ── Feedback (5 cases) ────────────────────────────────────────────────────
  {
    // Task-level reflection with effort data
    input: "That CS midterm was way harder than I expected — I spent over 6 hours on it",
    groundTruth: "feedback",
  },
  {
    // Class-level discussion → feedback-first delegation rule
    input: "I want to talk about how my CHEM class is going this semester",
    groundTruth: "feedback",
  },
  {
    // Effort vs estimate mismatch
    input: "The bio lab report took me twice as long as the estimate said it would",
    groundTruth: "feedback",
  },
  {
    // "discuss" verb about an assignment → feedback, not tasks
    input: "Can we discuss how my calc assignment went last week?",
    groundTruth: "feedback",
  },
  {
    // Difficulty reflection — no explicit "feedback" keyword, but intent is reflective
    input: "That project was way more work than I thought it would be",
    groundTruth: "feedback",
  },

  // ── Edge cases ────────────────────────────────────────────────────────────
  {
    // Off-topic / too vague → needsDomainClarification → route = null
    input: "Hi",
    groundTruth: "null",
  },
  {
    // Generic capability question → needsDomainClarification → route = null
    input: "What can you help me with?",
    groundTruth: "null",
  },
  {
    // Two clear domains in one message → needsDomainClarification → route = null
    input: "I want to create a task for my essay and also change my focus block length",
    groundTruth: "null",
  },
];

// ---------------------------------------------------------------------------
// 2. Schedule vs Tasks disambiguation
//    The verb determines the route — not the noun. Messages containing
//    "assignment", "task", or "homework" can go to either domain.
// ---------------------------------------------------------------------------

const disambigTestData: Array<{ input: string; groundTruth: string }> = [
  // Must route to schedule (study-time verbs)
  {
    input: "Schedule this assignment for me",
    groundTruth: "schedule",
  },
  {
    input: "Plan study time for my essay",
    groundTruth: "schedule",
  },
  {
    input: "When should I work on my CS homework?",
    groundTruth: "schedule",
  },
  {
    input: "Block off time for my midterm prep",
    groundTruth: "schedule",
  },
  {
    input: "Can you schedule that task?",
    groundTruth: "schedule",
  },
  // Must route to tasks (CRUD verbs)
  {
    input: "Create a task for my essay",
    groundTruth: "tasks",
  },
  {
    input: "Update the title of my reading assignment",
    groundTruth: "tasks",
  },
  {
    input: "Edit the description for my CS homework",
    groundTruth: "tasks",
  },
];

// ---------------------------------------------------------------------------
// 3. Mid-flow STAY
//    User gives an answer-shaped reply that belongs to the active agent's domain.
//    Route must remain the active agent's route.
// ---------------------------------------------------------------------------

const stayTestData: Array<{ input: string; groundTruth: string }> = [
  // tasks mid-flow — supervisor collects fields (due date, class, yes/no)
  {
    input: midFlow("tasks", "assistant: What is the due date?", "Friday at 5pm"),
    groundTruth: "tasks",
  },
  {
    input: midFlow("tasks", "assistant: Which class is this for?", "no class"),
    groundTruth: "tasks",
  },
  {
    input: midFlow(
      "tasks",
      "assistant: Should I generate AI subtasks for this task? yes/no",
      "yes, go ahead"
    ),
    groundTruth: "tasks",
  },
  {
    input: midFlow("tasks", "assistant: What type of assignment is this?", "Essay"),
    groundTruth: "tasks",
  },
  // classes mid-flow — term and school collection
  {
    input: midFlow("classes", "assistant: Which term?", "Spring 2026"),
    groundTruth: "classes",
  },
  {
    input: midFlow("classes", "assistant: Which school?", "Krieger"),
    groundTruth: "classes",
  },
  {
    input: midFlow(
      "classes",
      "assistant: What is your study goal? Options: Just pass / Do well / Ace it",
      "Ace it"
    ),
    groundTruth: "classes",
  },
  // schedule mid-flow
  {
    input: midFlow(
      "schedule",
      "assistant: How many study blocks should I schedule?",
      "3 blocks please"
    ),
    groundTruth: "schedule",
  },
  // feedback mid-flow
  {
    input: midFlow(
      "feedback",
      "assistant: How difficult was this task on a scale of 1–5?",
      "4, it was pretty rough"
    ),
    groundTruth: "feedback",
  },
];

// ---------------------------------------------------------------------------
// 4. Mid-flow SWITCH
//    User explicitly pivots to a different domain while another agent is active.
//    Route must change to the new domain; exitActiveAgent must remain false.
// ---------------------------------------------------------------------------

const switchTestData: Array<{ input: string; groundTruth: string }> = [
  {
    // tasks → classes
    input: midFlow("tasks", "assistant: What is the title?", "actually I want to add a course"),
    groundTruth: "classes",
  },
  {
    // tasks → schedule
    input: midFlow(
      "tasks",
      "assistant: What is the due date?",
      "wait, can you schedule my CHEM reading instead"
    ),
    groundTruth: "schedule",
  },
  {
    // tasks → preferences
    input: midFlow(
      "tasks",
      "assistant: Which class is this for?",
      "change my focus length to 50 minutes"
    ),
    groundTruth: "preferences",
  },
  {
    // classes → tasks
    input: midFlow(
      "classes",
      "assistant: Which term?",
      "actually create a task for my essay first"
    ),
    groundTruth: "tasks",
  },
  {
    // schedule → feedback
    input: midFlow(
      "schedule",
      "assistant: Which task would you like to schedule?",
      "let me give feedback on my essay first"
    ),
    groundTruth: "feedback",
  },
];

// ---------------------------------------------------------------------------
// 5. Mid-flow EXIT
//    User cancels, chit-chats, or asks generic help with no domain intent.
//    Supervisor must return route = null. groundTruth = "null" (String(null)).
// ---------------------------------------------------------------------------

const exitTestData: Array<{ input: string; groundTruth: string }> = [
  // Explicit cancellations
  {
    input: midFlow("tasks", "assistant: What is the title?", "actually i no longer want to add a task"),
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
    input: midFlow("schedule", "assistant: Which task?", "i changed my mind"),
    groundTruth: "null",
  },
  // Chit-chat
  {
    input: midFlow("tasks", "assistant: What type of assignment?", "i just want to chat"),
    groundTruth: "null",
  },
  {
    input: midFlow("feedback", "assistant: How difficult was this?", "how are you?"),
    groundTruth: "null",
  },
  {
    input: midFlow("classes", "assistant: What term?", "lol never mind"),
    groundTruth: "null",
  },
  // Generic help / capability questions
  {
    input: midFlow("tasks", "assistant: What is the title?", "what can you do?"),
    groundTruth: "null",
  },
  {
    input: midFlow("schedule", "assistant: Which task?", "help"),
    groundTruth: "null",
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------

export async function runSupervisorRoutingEval() {
  const hasAny =
    freshTestData.length > 0 ||
    disambigTestData.length > 0 ||
    stayTestData.length > 0 ||
    switchTestData.length > 0 ||
    exitTestData.length > 0;

  if (!hasAny) {
    console.log("  (no test cases — add items to testData arrays to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  let totalItems = 0;
  const allScores: Record<string, unknown> = {};

  const runGroup = async (label: string, data: Array<{ input: string; groundTruth: string }>) => {
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

  await runGroup("fresh", freshTestData);
  await runGroup("disambig (schedule vs tasks)", disambigTestData);
  await runGroup("midflow-stay", stayTestData);
  await runGroup("midflow-switch", switchTestData);
  await runGroup("midflow-exit", exitTestData);

  return { scores: allScores, summary: { totalItems } };
}
