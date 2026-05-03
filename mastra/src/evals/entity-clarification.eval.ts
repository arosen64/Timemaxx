/**
 * Entity Clarification Eval
 *
 * Evaluates whether taskAgent correctly sets `needsEntityClarification: true`
 * when the user refers to a task ambiguously (no resolvedTaskId in context),
 * and `false` when a resolvedTaskId is present and the action is unambiguous.
 *
 * Key invariant: taskAgent always requires a resolvedTaskId to act — a title
 * mentioned inline is not sufficient to bypass clarification. Only an explicit
 * resolvedTaskId in <resolved_task_context> counts as "entity clear".
 *
 * Scorer: createJsonFieldScorer("needsEntityClarification")
 *
 * Run: npm run eval:entity-clarification (from mastra/)
 */

import { runEvals } from "@mastra/core/evals";
import {
  createJsonFieldScorer,
  makeOnItemComplete,
  printAgentSummary,
  type ItemSummary,
} from "./eval-utils";
import { taskAgent } from "../mastra/agents/taskAgent";

const entityClarificationScorer = createJsonFieldScorer("needsEntityClarification");

function taskContext(userMessage: string, resolvedTask: string): string {
  return `Today (ISO date): 2026-04-15

<conversation_history>
user: ${userMessage}
</conversation_history>

<resolved_task_context>
${resolvedTask}
</resolved_task_context>

<resolved_course_context>
none
</resolved_course_context>

<turn_directive>
Continue the current flow.
</turn_directive>`;
}

// ---------------------------------------------------------------------------
// taskAgent — needsEntityClarification = true
// No resolvedTaskId in context; agent must ask which task the user means.
// ---------------------------------------------------------------------------

const taskNeedsClarifyData: Array<{ input: string; groundTruth: string }> = [
  {
    // Generic possessive "my task" — no title, no resolvedTaskId
    input: taskContext("Update my task", "none"),
    groundTruth: "true",
  },
  {
    // "the assignment" — ambiguous reference, no context
    input: taskContext("Delete the assignment", "none"),
    groundTruth: "true",
  },
  {
    // Pronoun "it" — no prior context to resolve
    input: taskContext("Can you reschedule it to next week?", "none"),
    groundTruth: "true",
  },
  {
    // "my essay" — multiple essays could exist, no resolvedTaskId
    input: taskContext("Show me my essay", "none"),
    groundTruth: "true",
  },
  {
    // Deictic "that task" — unresolvable without an ID
    input: taskContext("What are the details for that task?", "none"),
    groundTruth: "true",
  },
  {
    // Title alone (no resolvedTaskId) — agent still requires clarification
    input: taskContext("Delete my CHEM Essay task", "none"),
    groundTruth: "true",
  },
  {
    // Full title inline but no resolvedTaskId — agent must confirm identity
    input: taskContext("Push back the Linear Algebra Problem Set due date by two days", "none"),
    groundTruth: "true",
  },
];

// ---------------------------------------------------------------------------
// taskAgent — needsEntityClarification = false
// resolvedTaskId is present; agent can act without asking.
// ---------------------------------------------------------------------------

const taskClearData: Array<{ input: string; groundTruth: string }> = [
  {
    // resolvedTaskId + simple field update
    input: taskContext(
      "Update the due date to April 25.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20"
    ),
    groundTruth: "false",
  },
  {
    // resolvedTaskId + read action
    input: taskContext(
      "Show me the details for this task.",
      "resolvedTaskId: task_eval_001\ntitle: Bio Lab Report\ntaskType: Lab\ndueDateIso: 2026-04-22\ndescription: Write up the gel electrophoresis results\nclassTag: BIO 101\nsubtasks: 0"
    ),
    groundTruth: "false",
  },
  {
    // resolvedTaskId + delete action
    input: taskContext(
      "Delete it.",
      "resolvedTaskId: task_eval_002\ntitle: Organic Chemistry Reading\ntaskType: Reading\ndueDateIso: 2026-04-18"
    ),
    groundTruth: "false",
  },
  {
    // resolvedTaskId + reschedule action
    input: taskContext(
      "Move the due date to next Monday.",
      "resolvedTaskId: task_eval_003\ntitle: CS Project Proposal\ntaskType: Project\ndueDateIso: 2026-04-17\nclassTag: CS 439"
    ),
    groundTruth: "false",
  },
  {
    // resolvedTaskId + status update
    input: taskContext(
      "Mark this as complete.",
      "resolvedTaskId: task_eval_004\ntitle: Linear Algebra Problem Set 5\ntaskType: Homework\ndueDateIso: 2026-04-16"
    ),
    groundTruth: "false",
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------

export async function runEntityClarificationEval() {
  if (taskNeedsClarifyData.length === 0 && taskClearData.length === 0) {
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
      target: taskAgent,
      scorers: [entityClarificationScorer],
      onItemComplete: makeOnItemComplete(
        "needsEntityClarification",
        "needsEntityClarification-scorer",
        acc
      ),
    });
    printAgentSummary(label, acc);
    totalItems += r.summary.totalItems;
    allScores[label] = r.scores;
  };

  await runGroup("taskAgent — needs clarification", taskNeedsClarifyData);
  await runGroup("taskAgent — entity clear", taskClearData);

  return { scores: allScores, summary: { totalItems } };
}
