import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supervisorAgent } from "../agents/supervisorAgent";
import { taskAgent } from "../agents/taskAgent";
import { feedbackAgent } from "../agents/feedbackAgent";

import { supervisorAgentOutputSchema } from "../lib/prompts/supervisorAgent.prompt";
import { taskAgentOutputSchema, type TaskAgentOutput } from "../lib/prompts/taskAgent.prompt";
import { feedbackAgentOutputSchema, type FeedbackAgentOutput } from "../lib/prompts/feedbackAgent.prompt";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const chatContextSchema = z.object({
  message: z.string(),
  historyText: z.string(),
  taggedEntitiesBlock: z.string(),
  hasCourseTag: z.boolean(),
  taggedTaskId: z.string().nullable(),
  today: z.string(),
  activeAgent: z.enum(["task", "feedback", "preferences"]).nullable(),
  taskAgentIntent: z.enum(["create", "rud"]).nullable(),
});

// routerStep passes all context through plus the routing decision
const routedContextSchema = chatContextSchema.extend({
  route: z.string().nullable(),
  needsDomainClarification: z.boolean(),
  domainClarifyingQuestion: z.string().nullable(),
});

export const chatWorkflowOutputSchema = z.object({
  reply: z.string(),
  route: z.string().nullable(),
  status: z.enum(["reply", "domain_clarify", "needs_task_mcq", "needs_class_mcq", "task_action", "canned"]),
  mcqQueryText: z.string().nullable(),
  needsClassAfterTask: z.boolean(),
  actionType: z.enum(["create_task", "update_task", "delete_task", "read_task", "none"]).nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  taskType: z.string().nullable(),
  dueDateIso: z.string().nullable(),
  classTag: z.string().nullable(),
  deleteConfirmed: z.boolean(),
  updatedTitle: z.string().nullable(),
  updatedDescription: z.string().nullable(),
  updatedTaskType: z.string().nullable(),
  updatedDueDateIso: z.string().nullable(),
  updatedClassTag: z.string().nullable(),
  newActiveAgent: z.enum(["task", "feedback", "preferences"]).nullable(),
  clearActiveAgent: z.boolean(),
  newTaskAgentIntent: z.enum(["create", "rud"]).nullable(),
  readyToRecord: z.boolean(),
});

export type ChatWorkflowOutput = z.infer<typeof chatWorkflowOutputSchema>;


// For task action clarifying
const NO_ACTION = {
  actionType: null, title: null, description: null, taskType: null, dueDateIso: null,
  classTag: null, deleteConfirmed: false, updatedTitle: null, updatedDescription: null,
  updatedTaskType: null, updatedDueDateIso: null, updatedClassTag: null,
} as const;

// canned replies for routes
const CANNED_REPLIES: Record<string, string> = {
  schedule: "To schedule or manage your study blocks, visit the **Schedule** page. To connect or revoke Google Calendar access, head to the **Profile** page.",
  classes: "To add or remove a course, or upload a syllabus, visit the **Classes** page.",
  preferences: "You can update your study preferences (focus length, work hours, and more) from the **Preferences** page.",
};

// Context formatting for agents
function agentContextPrompt(p: { today: string; historyText: string; taggedEntitiesBlock: string; continueNote: string }): string {
  return `Today (ISO date): ${p.today}\n\n<conversation_history>\n${p.historyText}\n</conversation_history>\n\n<resolved_task_context>\n${p.taggedEntitiesBlock}\n</resolved_task_context>\n\n<resolved_course_context>\nCourse context is represented by tagged course IDs above (and by any tagged task that links to a course).\n</resolved_course_context>\n\n<turn_directive>\n${p.continueNote}\n</turn_directive>`;
}

// Task output formatting for chat workflow
function taskOutput(output: TaskAgentOutput, ctx: {
  message: string; hasCourseTag: boolean; taggedTaskId: string | null; taskAgentIntent: "create" | "rud" | null;
}): ChatWorkflowOutput {
  const { message, hasCourseTag, taggedTaskId, taskAgentIntent } = ctx;
  const newIntent: "create" | "rud" | null =
    output.intent !== "unknown" && !taskAgentIntent ? (output.intent as "create" | "rud") : taskAgentIntent;

  if (output.needsClassClarification && !hasCourseTag) {
    return { reply: "Which class is this for? Pick one below, or choose **Other** to see more options.", route: "tasks", status: "needs_class_mcq", mcqQueryText: String(message.trim() || output.classTag || output.updatedClassTag || "class course"), needsClassAfterTask: false, newActiveAgent: "task", clearActiveAgent: false, newTaskAgentIntent: newIntent, readyToRecord: false, ...NO_ACTION };
  }
  if (output.intent === "rud" && taggedTaskId === null && output.needsEntityClarification) {
    return { reply: "Which task would you like to work with? Pick one below, or choose **Other** to see more options.", route: "tasks", status: "needs_task_mcq", mcqQueryText: message.trim() || "task assignment", needsClassAfterTask: false, newActiveAgent: "task", clearActiveAgent: false, newTaskAgentIntent: newIntent, readyToRecord: false, ...NO_ACTION };
  }
  if (output.readyToExecute && output.actionType !== "none") {
    return { reply: output.message, route: "tasks", status: "task_action", mcqQueryText: null, needsClassAfterTask: false, actionType: output.actionType, title: output.title, description: output.description, taskType: output.taskType, dueDateIso: output.dueDateIso, classTag: output.classTag, deleteConfirmed: output.deleteConfirmed, updatedTitle: output.updatedTitle, updatedDescription: output.updatedDescription, updatedTaskType: output.updatedTaskType, updatedDueDateIso: output.updatedDueDateIso, updatedClassTag: output.updatedClassTag, newActiveAgent: null, clearActiveAgent: true, newTaskAgentIntent: null, readyToRecord: false };
  }
  return { reply: output.message, route: "tasks", status: "reply", mcqQueryText: null, needsClassAfterTask: false, newActiveAgent: "task", clearActiveAgent: false, newTaskAgentIntent: newIntent, readyToRecord: false, ...NO_ACTION };
}

// Feedback output formatting for chat workflow
function feedbackOutput(output: FeedbackAgentOutput, ctx: { message: string }): ChatWorkflowOutput {
  const { message } = ctx;
  if (output.needsTaskClarification) {
    return { reply: "Which assignment are you referring to? Pick one below or choose **Other**.", route: "feedback", status: "needs_task_mcq", mcqQueryText: message.trim() || "task assignment", needsClassAfterTask: false, newActiveAgent: "feedback", clearActiveAgent: false, newTaskAgentIntent: null, readyToRecord: false, ...NO_ACTION };
  }
  if (output.needsClassClarification) {
    return { reply: "Which class are you talking about? Pick one below or choose **Other**.", route: "feedback", status: "needs_class_mcq", mcqQueryText: message.trim() || "class course", needsClassAfterTask: false, newActiveAgent: "feedback", clearActiveAgent: false, newTaskAgentIntent: null, readyToRecord: false, ...NO_ACTION };
  }
  return { reply: output.message, route: "feedback", status: "reply", mcqQueryText: null, needsClassAfterTask: false, newActiveAgent: output.readyToRecord ? null : "feedback", clearActiveAgent: output.readyToRecord, newTaskAgentIntent: null, readyToRecord: output.readyToRecord, ...NO_ACTION };
}


// Router step

const routerStep = createStep({
  id: "router",
  inputSchema: chatContextSchema,
  outputSchema: routedContextSchema,
  execute: async ({ inputData }) => {
    const { message, activeAgent } = inputData;
    if (activeAgent) {
      const route = activeAgent === "task" ? "tasks" : activeAgent;
      return { ...inputData, route, needsDomainClarification: false, domainClarifyingQuestion: null };
    }
    const sv = await supervisorAgent.generate(message, { structuredOutput: { schema: supervisorAgentOutputSchema } });
    const { route, needsDomainClarification, domainClarifyingQuestion } = sv.object;
    return { ...inputData, route, needsDomainClarification, domainClarifyingQuestion };
  },
});

//task step 

const taskStep = createStep({
  id: "task_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const { message, historyText, taggedEntitiesBlock, hasCourseTag, taggedTaskId, today, taskAgentIntent } = inputData;
    const continueNote = message.trim()
      ? "Respond to the latest user message above."
      : "The user just selected an entity from the picker (no new text). Based on the conversation history and the now-resolved context, continue the conversation — e.g. proceed to the next missing field, confirm deletion, or summarise task details.";
    const result = await taskAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: taskAgentOutputSchema } },
    );
    return taskOutput(result.object, { message, hasCourseTag, taggedTaskId, taskAgentIntent });
  },
});

// Feedback step

const feedbackStep = createStep({
  id: "feedback_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const { message, historyText, taggedEntitiesBlock, today } = inputData;
    const continueNote = message.trim()
      ? "Respond to the latest user message above."
      : "The user just selected an entity. Continue based on what is now resolved.";
    const result = await feedbackAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: feedbackAgentOutputSchema } },
    );
    return feedbackOutput(result.object, { message });
  },
});

// ---------------------------------------------------------------------------
// Step 2c — Canned / domain-clarify / fallback handler
// ---------------------------------------------------------------------------

const cannedStep = createStep({
  id: "canned_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const { route, needsDomainClarification, domainClarifyingQuestion } = inputData;
    if (needsDomainClarification && domainClarifyingQuestion) {
      return { reply: domainClarifyingQuestion, route: null, status: "domain_clarify" as const, mcqQueryText: null, needsClassAfterTask: false, newActiveAgent: null, clearActiveAgent: false, newTaskAgentIntent: null, readyToRecord: false, ...NO_ACTION };
    }
    if (route && route in CANNED_REPLIES) {
      return { reply: CANNED_REPLIES[route], route, status: "canned" as const, mcqQueryText: null, needsClassAfterTask: false, newActiveAgent: null, clearActiveAgent: false, newTaskAgentIntent: null, readyToRecord: false, ...NO_ACTION };
    }
    return { reply: "I'm not sure which area that fits yet — try one more detail (tasks, schedule, classes, preferences, or feedback).", route: null, status: "reply" as const, mcqQueryText: null, needsClassAfterTask: false, newActiveAgent: null, clearActiveAgent: false, newTaskAgentIntent: null, readyToRecord: false, ...NO_ACTION };
  },
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const chatWorkflow = createWorkflow({
  id: "chat-workflow",
  inputSchema: chatContextSchema,
  outputSchema: chatWorkflowOutputSchema,
})
  .then(routerStep)
  .branch([
    [async ({ inputData }) => inputData.route === "tasks", taskStep],
    [async ({ inputData }) => inputData.route === "feedback", feedbackStep],
    [async () => true, cannedStep], // schedule, classes, domain-clarify, unknown
  ])
  .commit();
