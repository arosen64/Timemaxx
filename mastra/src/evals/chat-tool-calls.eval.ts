/**
 * Chat Tool Calls Eval
 *
 * Evaluates whether each subagent returns the correct `actionType` (or `intent`
 * for feedbackAgent) in its structured JSON output for a given user message.
 *
 * Since these agents use structured output instead of Mastra createTool() calls,
 * a custom scorer parses the relevant field from the assistant message JSON and
 * compares it to a `groundTruth` string.
 *
 * Scorer:
 *   - actionTypeScorer (custom): parses `actionType` from the agent's JSON output
 *     and compares it to `groundTruth`. For feedbackAgent, parses `intent` instead.
 *
 * Agents covered:
 *   - taskAgent:     create_task | update_task | delete_task | read_task
 *   - courseAgent:   add_course | drop_course | update_course | view_courses
 *   - scheduleAgent: schedule_task | schedule_block | import_google_calendar
 *   - feedbackAgent: task_feedback | class_feedback  (uses `intent` field)
 *
 * HOW TO ADD TEST CASES:
 * 1. Add an item to the relevant agent's testData array:
 *      { input: "user message (or full context string)", groundTruth: "expected value" }
 * 2. For operations that need a resolved entity (update/delete/read/drop/schedule),
 *    craft the input as a full context string using the format below so the agent
 *    sees a resolvedTaskId or resolvedCourseId:
 *
 *    Today (ISO date): YYYY-MM-DD
 *
 *    <conversation_history>
 *    user: <user message>
 *    </conversation_history>
 *
 *    <resolved_task_context>
 *    resolvedTaskId: <id>
 *    title: <title>
 *    ...
 *    </resolved_task_context>
 *
 *    <resolved_course_context>
 *    none
 *    </resolved_course_context>
 *
 *    <turn_directive>
 *    Continue the current flow.
 *    </turn_directive>
 *
 * 3. Run: npm run eval (from mastra/)
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
import { scheduleAgent } from "../mastra/agents/scheduleAgent";
import { feedbackAgent } from "../mastra/agents/feedbackAgent";

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

const actionTypeScorer = createJsonFieldScorer("actionType");
const intentScorer = createJsonFieldScorer("intent");

// ---------------------------------------------------------------------------
// taskAgent test data
// ---------------------------------------------------------------------------
//
// Context helper: wraps a user message with the standard agent context format
// so the agent sees a resolvedTaskId for RUD operations.
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

// For create_task we simulate the second turn after all fields are gathered
// and the user answers the subtask question, so the agent can set readyToExecute=true.
function createTaskContext(): string {
  return `Today (ISO date): 2026-04-15

<conversation_history>
user: Create a task: CHEM Essay, Essay type, due 2026-04-20, no class.
assistant: {"message":"Should I generate AI subtasks for the CHEM Essay? yes/no","intent":"create","needsEntityClarification":false,"needsClassClarification":false,"readyToExecute":false,"actionType":"none","title":"CHEM Essay","description":"CHEM Essay","taskType":"Essay","dueDateIso":"2026-04-20","classTag":null,"deleteConfirmed":false,"updatedTitle":null,"updatedDescription":null,"updatedTaskType":null,"updatedDueDateIso":null,"updatedClassTag":null,"generateSubtasks":null,"reasoning":"All required fields gathered; asking about subtask generation."}
user: No subtasks.
</conversation_history>

<resolved_task_context>
none
</resolved_task_context>

<resolved_course_context>
none
</resolved_course_context>

<turn_directive>
Continue the task creation flow.
</turn_directive>`;
}

// For delete_task we simulate the second turn after the agent asked for confirmation.
function deleteTaskContext(): string {
  return `Today (ISO date): 2026-04-15

<conversation_history>
user: Delete my CHEM Essay task.
assistant: {"message":"Are you sure you want to delete **CHEM Essay**? Reply 'yes' to confirm.","intent":"rud","needsEntityClarification":false,"needsClassClarification":false,"readyToExecute":false,"actionType":"none","title":null,"description":null,"taskType":null,"dueDateIso":null,"classTag":null,"deleteConfirmed":false,"updatedTitle":null,"updatedDescription":null,"updatedTaskType":null,"updatedDueDateIso":null,"updatedClassTag":null,"generateSubtasks":null,"reasoning":"resolvedTaskId present; asking user to confirm deletion."}
user: Yes, delete it.
</conversation_history>

<resolved_task_context>
resolvedTaskId: task_eval_001
title: CHEM Essay
taskType: Essay
dueDateIso: 2026-04-20
</resolved_task_context>

<resolved_course_context>
none
</resolved_course_context>

<turn_directive>
Continue the delete flow.
</turn_directive>`;
}

const taskTestData: Array<{ input: string; groundTruth: string }> = [
  {
    input: createTaskContext(),
    groundTruth: "create_task",
  },
  {
    input: taskContext(
      "Update the due date of my CHEM Essay to April 25.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20\nsubtasks: 0"
    ),
    groundTruth: "update_task",
  },
  {
    input: deleteTaskContext(),
    groundTruth: "delete_task",
  },
  {
    input: taskContext(
      "Show me the details of my CHEM Essay task.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20\ndescription: CHEM Essay\nclassTag: none\nsubtasks: 0"
    ),
    groundTruth: "read_task",
  },
  // Ambiguous phrasing — should still resolve to the correct action
  {
    // Informal "push it back" — should still be update_task with resolvedTaskId
    input: taskContext(
      "Actually push it back to the 22nd.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20\nsubtasks: 0"
    ),
    groundTruth: "update_task",
  },
  // No-tool cases — agent should ask a clarifying question, not execute
  {
    // Vague intent — no specific action can be determined
    input: "I have so much homework right now.",
    groundTruth: "none",
  },
];

// ---------------------------------------------------------------------------
// courseAgent test data
// ---------------------------------------------------------------------------

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

const courseTestData: Array<{ input: string; groundTruth: string }> = [
  {
    // view_courses — no resolved entity needed
    input: "Show me all my courses.",
    groundTruth: "view_courses",
  },
  {
    // drop_course — resolvedCourseId provided so agent can execute immediately
    input: courseContext(
      "Drop my Organic Chemistry course.",
      "resolvedCourseId: course_eval_001\ncourseName: Organic Chemistry\nterm: Spring 2026"
    ),
    groundTruth: "drop_course",
  },
  // Ambiguous phrasing — should still resolve to the correct action
  {
    // Informal "enrolled in" phrasing instead of "show my courses"
    input: "What am I enrolled in right now?",
    groundTruth: "view_courses",
  },
  // No-tool cases
  {
    // Vague — no specific course intent can be determined
    input: "I don't know what to do about my courses.",
    groundTruth: "none",
  },
  {
    // add_course — simulate second turn after class picker resolved; user provides studyGoal
    input: `Today (ISO date): 2026-04-15

<conversation_history>
user: Add Organic Chemistry for Spring 2026 in Krieger School.
assistant: {"message":"Which class are you referring to? Pick one below, or choose **Other** to see more options.","intent":"add","needsClassClarification":true,"readyToExecute":false,"actionType":"none","courseName":null,"sisQuery":"Organic Chemistry","term":"Spring 2026","school":"Krieger School of Arts and Sciences","studyGoal":null,"grade":null,"difficultyRating":null,"reasoning":"term and school gathered; triggering class picker for sisQuery."}
user: I selected it.
assistant: {"message":"What is your study goal for Organic Chemistry? Options: Just pass, Do well, Ace it.","intent":"add","needsClassClarification":false,"readyToExecute":false,"actionType":"none","courseName":"Organic Chemistry","sisQuery":"Organic Chemistry","term":"Spring 2026","school":"Krieger School of Arts and Sciences","studyGoal":null,"grade":null,"difficultyRating":null,"reasoning":"resolvedCourseId now in context; asking for studyGoal since term is future."}
user: Ace it.
</conversation_history>

<resolved_task_context>
none
</resolved_task_context>

<resolved_course_context>
resolvedCourseId: course_eval_001
courseName: Organic Chemistry
term: Spring 2026
school: Krieger School of Arts and Sciences
</resolved_course_context>

<turn_directive>
Continue the add course flow.
</turn_directive>`,
    groundTruth: "add_course",
  },
  {
    // update_course — resolvedCourseId provided; user updates studyGoal (an allowed field)
    input: courseContext(
      "Change my study goal for Organic Chemistry to Do well.",
      "resolvedCourseId: course_eval_001\ncourseName: Organic Chemistry\nterm: Spring 2026\nstudyGoal: Ace it"
    ),
    groundTruth: "update_course",
  },
];

// ---------------------------------------------------------------------------
// scheduleAgent test data
// ---------------------------------------------------------------------------

function scheduleContext(userMessage: string, resolvedTask: string): string {
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

const scheduleTestData: Array<{ input: string; groundTruth: string }> = [
  {
    // schedule_task — resolvedTaskId provided so agent can set readyToExecute=true
    input: scheduleContext(
      "Schedule all study blocks for my CHEM Essay.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20"
    ),
    groundTruth: "schedule_task",
  },
  {
    // schedule_block — explicit "one block" phrasing with resolvedTaskId
    input: scheduleContext(
      "Schedule one study block for my CHEM Essay.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20"
    ),
    groundTruth: "schedule_block",
  },
  {
    // import_google_calendar — no entity needed
    input: "Connect my Google Calendar to TimeMaxx.",
    groundTruth: "import_google_calendar",
  },
  // Ambiguous phrasing — should still resolve to the correct action
  {
    // "Find time" instead of "schedule" — should still be schedule_task with resolvedTaskId
    input: scheduleContext(
      "Find some time for my CHEM Essay this week.",
      "resolvedTaskId: task_eval_001\ntitle: CHEM Essay\ntaskType: Essay\ndueDateIso: 2026-04-20"
    ),
    groundTruth: "schedule_task",
  },
  // No-tool cases
  {
    // No specific task mentioned — agent should ask which task
    input: "I should probably study at some point.",
    groundTruth: "none",
  },
];

// ---------------------------------------------------------------------------
// feedbackAgent test data — uses `intent` field (no actionType in this agent)
// ---------------------------------------------------------------------------

const feedbackTestData: Array<{ input: string; groundTruth: string }> = [
  {
    // task_feedback — user is reflecting on a specific assignment
    input: "That CS midterm was way harder than expected. I ended up spending over 5 hours on it.",
    groundTruth: "task_feedback",
  },
  {
    // class_feedback — user is talking about a course overall
    input:
      "I want to talk about how my CHEM 101 class is going overall. The lab reports are really time-consuming.",
    groundTruth: "class_feedback",
  },
  // Ambiguous phrasing — should still resolve to the correct intent
  {
    // Colloquial — no assignment named but "assignment" is mentioned, should be task_feedback
    input: "That assignment really got me this week, way more time than I thought it would take.",
    groundTruth: "task_feedback",
  },
  {
    // "How things are going" could suggest class_feedback, but "this semester" + course context = class_feedback
    input: "Honestly CHEM has been a lot more work than I expected this semester.",
    groundTruth: "class_feedback",
  },
  // No-tool cases — intent is too vague to classify
  {
    // Could be task or class — agent should ask a clarifying question
    input: "I want to share some thoughts about how things went.",
    groundTruth: "unknown",
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------

export async function runChatToolCallsEval() {
  const hasAny =
    taskTestData.length > 0 ||
    courseTestData.length > 0 ||
    scheduleTestData.length > 0 ||
    feedbackTestData.length > 0;

  if (!hasAny) {
    console.log("  (no test cases — add items to testData arrays to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  let totalItems = 0;
  const allScores: Record<string, unknown> = {};

  if (taskTestData.length > 0) {
    console.log("  [taskAgent — actionType]");
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data: taskTestData,
      target: taskAgent,
      scorers: [actionTypeScorer],
      onItemComplete: makeOnItemComplete("actionType", "actionType-scorer", acc),
    });
    printAgentSummary("taskAgent", acc);
    totalItems += r.summary.totalItems;
    allScores["taskAgent"] = r.scores;
  }

  if (courseTestData.length > 0) {
    console.log("  [courseAgent — actionType]");
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data: courseTestData,
      target: courseAgent,
      scorers: [actionTypeScorer],
      onItemComplete: makeOnItemComplete("actionType", "actionType-scorer", acc),
    });
    printAgentSummary("courseAgent", acc);
    totalItems += r.summary.totalItems;
    allScores["courseAgent"] = r.scores;
  }

  if (scheduleTestData.length > 0) {
    console.log("  [scheduleAgent — actionType]");
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data: scheduleTestData,
      target: scheduleAgent,
      scorers: [actionTypeScorer],
      onItemComplete: makeOnItemComplete("actionType", "actionType-scorer", acc),
    });
    printAgentSummary("scheduleAgent", acc);
    totalItems += r.summary.totalItems;
    allScores["scheduleAgent"] = r.scores;
  }

  if (feedbackTestData.length > 0) {
    console.log("  [feedbackAgent — intent]");
    const acc: ItemSummary[] = [];
    const r = await runEvals({
      data: feedbackTestData,
      target: feedbackAgent,
      scorers: [intentScorer],
      onItemComplete: makeOnItemComplete("intent", "intent-scorer", acc),
    });
    printAgentSummary("feedbackAgent", acc);
    totalItems += r.summary.totalItems;
    allScores["feedbackAgent"] = r.scores;
  }

  return { scores: allScores, summary: { totalItems } };
}
