/**
 * Entity Clarification Eval
 *
 * Evaluates whether sub-agents correctly set `needsEntityClarification: true`
 * when the user refers to a task or course ambiguously, and correctly set it
 * `false` when the entity is unambiguously identified from context.
 *
 * Entity clarification is a sub-agent concern — the supervisor only routes.
 * This eval targets taskAgent and courseAgent directly.
 *
 * Scorer:
 *   - entityClarificationScorer (custom): extracts `needsEntityClarification`
 *     from the agent's JSON and compares to groundTruth ("true" or "false").
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
import { taskAgent } from "../mastra/agents/taskAgent";
import { courseAgent } from "../mastra/agents/courseAgent";

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

function courseContext(userMessage: string, resolvedCourse: string): string {
  return `Today (ISO date): 2026-04-15

<conversation_history>
user: ${userMessage}
</conversation_history>

<resolved_task_context>
none
</resolved_task_context>

<resolved_course_context>
${resolvedCourse}
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
    // "my task" — no title, no resolvedTaskId
    input: taskContext("Update my task", "none"),
    groundTruth: "true",
  },
  {
    // "the assignment" — ambiguous reference, no context
    input: taskContext("Delete the assignment", "none"),
    groundTruth: "true",
  },
  {
    // Pronoun reference "it" — no prior context to resolve
    input: taskContext("Can you reschedule it to next week?", "none"),
    groundTruth: "true",
  },
  {
    // Vague "my essay" — multiple essays could exist, no resolvedTaskId
    input: taskContext("Show me my essay", "none"),
    groundTruth: "true",
  },
  {
    // "that task" — deictic reference, unresolvable without context
    input: taskContext("What are the details for that task?", "none"),
    groundTruth: "true",
  },
];

// ---------------------------------------------------------------------------
// taskAgent — needsEntityClarification = false
// resolvedTaskId is present in context; agent can act without asking.
// ---------------------------------------------------------------------------

const taskClearData: Array<{ input: string; groundTruth: string }> = [
  {
    // resolvedTaskId provided — agent knows exactly which task
    input: taskContext(
      "Update the due date to April 25.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20"
    ),
    groundTruth: "false",
  },
  {
    // Exact title match — unambiguous even without resolvedTaskId
    input: taskContext("Delete my CHEM Essay task", "none"),
    groundTruth: "false",
  },
  {
    // resolvedTaskId + clear action
    input: taskContext(
      "Show me the details for this task.",
      "resolvedTaskId: task_eval_001\ntitle: Bio Lab Report\ntaskType: Lab\ndueDateIso: 2026-04-22\ndescription: Write up the gel electrophoresis results\nclassTag: BIO 101\nsubtasks: 0"
    ),
    groundTruth: "false",
  },
  {
    // Full title named inline — agent can identify without resolvedTaskId
    input: taskContext("Push back the Linear Algebra Problem Set due date by two days", "none"),
    groundTruth: "false",
  },
];

// ---------------------------------------------------------------------------
// courseAgent — needsEntityClarification = true
// No resolvedCourseId; agent must ask which course the user means.
// ---------------------------------------------------------------------------

const courseNeedsClarifyData: Array<{ input: string; groundTruth: string }> = [
  {
    // "my class" — completely ambiguous
    input: courseContext("Drop my class", "none"),
    groundTruth: "true",
  },
  {
    // "the course" — no name or ID
    input: courseContext("Update the study goal for the course", "none"),
    groundTruth: "true",
  },
  {
    // Pronoun "it" — no course in context to resolve
    input: courseContext("Can you remove it?", "none"),
    groundTruth: "true",
  },
  {
    // Partial name match — "chemistry" 
    input: courseContext("Drop my chemistry class", "none"),
    groundTruth: "true",
  },
];

// ---------------------------------------------------------------------------
// courseAgent — needsEntityClarification = false
// resolvedCourseId present or course named precisely enough to act.
// ---------------------------------------------------------------------------

const courseClearData: Array<{ input: string; groundTruth: string }> = [
  {
    // resolvedCourseId provided — unambiguous
    input: courseContext(
      "Drop this course.",
      "resolvedCourseId: course_eval_001\ncourseName: Organic Chemistry\nterm: Spring 2026"
    ),
    groundTruth: "false",
  },
  {
    // Precise course code — unambiguous even without resolvedCourseId
    input: courseContext("Update the study goal for AS.030.205", "none"),
    groundTruth: "false",
  },
  {
    // resolvedCourseId + clear update action
    input: courseContext(
      "Change the study goal to Do well.",
      "resolvedCourseId: course_eval_001\ncourseName: Organic Chemistry\nterm: Spring 2026\nstudyGoal: Ace it"
    ),
    groundTruth: "false",
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------

export async function runEntityClarificationEval() {
  const hasAny =
    taskNeedsClarifyData.length > 0 ||
    taskClearData.length > 0 ||
    courseNeedsClarifyData.length > 0 ||
    courseClearData.length > 0;

  if (!hasAny) {
    console.log("  (no test cases — add items to testData arrays to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  let totalItems = 0;
  const allScores: Record<string, unknown> = {};

  const runGroup = async (
    label: string,
    target: typeof taskAgent | typeof courseAgent,
    data: Array<{ input: string; groundTruth: string }>
  ) => {
    if (data.length === 0) return;
    console.log(`  [${label}]`);
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data,
      target,
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

  await runGroup("taskAgent — needs clarification", taskAgent, taskNeedsClarifyData);
  await runGroup("taskAgent — entity clear", taskAgent, taskClearData);
  await runGroup("courseAgent — needs clarification", courseAgent, courseNeedsClarifyData);
  await runGroup("courseAgent — entity clear", courseAgent, courseClearData);

  return { scores: allScores, summary: { totalItems } };
}