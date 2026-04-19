import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supervisorAgent } from "../agents/supervisorAgent";
import { taskAgent } from "../agents/taskAgent";
import { feedbackAgent } from "../agents/feedbackAgent";
import { preferencesAgent } from "../agents/preferencesAgent";
import { supervisorAgentOutputSchema } from "../lib/prompts/supervisorAgent.prompt";
import { taskAgentOutputSchema } from "../lib/prompts/taskAgent.prompt";
import { feedbackAgentOutputSchema } from "../lib/prompts/feedbackAgent.prompt";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const chatWorkflowInputSchema = z.object({
  message: z.string(),
  historyText: z.string(),
  taggedEntitiesBlock: z.string(),
  /** True when there's already a course tag (or a tagged task with a courseId) in history. */
  hasCourseTag: z.boolean(),
  /** ID of the latest tagged task in history — null if none exists yet. */
  taggedTaskId: z.string().nullable(),
  today: z.string(),
  activeAgent: z.enum(["task", "feedback", "preferences"]).nullable(),
  taskAgentIntent: z.enum(["create", "rud"]).nullable(),
});

export const chatWorkflowOutputSchema = z.object({
  reply: z.string(),
  route: z.string().nullable(),
  status: z.enum([
    "reply",
    "domain_clarify",
    "needs_task_mcq",
    "needs_class_mcq",
    "task_action",
    "canned",
  ]),
  mcqQueryText: z.string().nullable(),
  needsClassAfterTask: z.boolean(),
  // Task action fields (populated when status === "task_action")
  actionType: z
    .enum(["create_task", "update_task", "delete_task", "read_task", "none"])
    .nullable(),
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
  // Session state changes for Convex to apply
  newActiveAgent: z.enum(["task", "feedback", "preferences"]).nullable(),
  clearActiveAgent: z.boolean(),
  newTaskAgentIntent: z.enum(["create", "rud"]).nullable(),
  readyToRecord: z.boolean(),
});

export type ChatWorkflowOutput = z.infer<typeof chatWorkflowOutputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nullActionFields = {
  actionType: null,
  title: null,
  description: null,
  taskType: null,
  dueDateIso: null,
  classTag: null,
  deleteConfirmed: false,
  updatedTitle: null,
  updatedDescription: null,
  updatedTaskType: null,
  updatedDueDateIso: null,
  updatedClassTag: null,
} as const;

function buildAgentContextPrompt(params: {
  today: string;
  historyText: string;
  taggedEntitiesBlock: string;
  continueNote: string;
}): string {
  return `Today (ISO date): ${params.today}

<conversation_history>
${params.historyText}
</conversation_history>

<resolved_task_context>
${params.taggedEntitiesBlock}
</resolved_task_context>

<resolved_course_context>
Course context is represented by tagged course IDs above (and by any tagged task that links to a course).
</resolved_course_context>

<turn_directive>
${params.continueNote}
</turn_directive>`;
}

// ---------------------------------------------------------------------------
// Single step — supervisor routing + agent dispatch
// ---------------------------------------------------------------------------

const chatStep = createStep({
  id: "chat",
  inputSchema: chatWorkflowInputSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const {
      message,
      historyText,
      taggedEntitiesBlock,
      hasCourseTag,
      taggedTaskId,
      today,
      activeAgent,
      taskAgentIntent,
    } = inputData;

    // Step 1: Supervisor always runs — determines if we stay in the current subagent or switch
    const sv = await supervisorAgent.generate(message, {
      structuredOutput: { schema: supervisorAgentOutputSchema },
    });
    let { route, needsDomainClarification, domainClarifyingQuestion } = sv.object;

    // Stay in the active subagent only when the supervisor agrees with that domain.
    const activeAgentRoute = activeAgent === "task" ? "tasks" : activeAgent;
    const agentPivoted = activeAgent !== null && route !== activeAgentRoute;
    if (!agentPivoted && activeAgent) {
      // Supervisor agrees — keep current agent, no domain clarification noise.
      route = activeAgentRoute;
      needsDomainClarification = false;
      domainClarifyingQuestion = null;
    }
    // If agentPivoted: fall through with the supervisor's new route and clear the old agent.

    if (needsDomainClarification && domainClarifyingQuestion) {
      return {
        reply: domainClarifyingQuestion,
        route: null,
        status: "domain_clarify" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: null,
        clearActiveAgent: agentPivoted,
        newTaskAgentIntent: null,
        readyToRecord: false,
        ...nullActionFields,
      };
    }

    // Canned routes (schedule, classes) — no AI needed
    if (route === "schedule" || route === "classes") {
      const CANNED: Record<string, string> = {
        schedule:
          "To schedule or manage your study blocks, visit the **Schedule** page. To connect or revoke Google Calendar access, head to the **Profile** page.",
        classes:
          "To add or remove a course, or upload a syllabus, visit the **Classes** page.",
      };
      return {
        reply: CANNED[route],
        route,
        status: "canned" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: null,
        clearActiveAgent: agentPivoted,
        newTaskAgentIntent: null,
        readyToRecord: false,
        ...nullActionFields,
      };
    }

    // ── Task agent ────────────────────────────────────────────────────────────
    if (route === "tasks") {
      const continueNote = message.trim()
        ? "Respond to the latest user message above."
        : "The user just selected an entity from the picker (no new text). Based on the conversation history and the now-resolved context, continue the conversation — e.g. proceed to the next missing field, confirm deletion, or summarise task details.";

      const contextPrompt = buildAgentContextPrompt({
        today,
        historyText,
        taggedEntitiesBlock,
        continueNote,
      });

      const taskResult = await taskAgent.generate(contextPrompt, {
        structuredOutput: { schema: taskAgentOutputSchema },
      });
      const output = taskResult.object;

      const newIntent: "create" | "rud" | null =
        output.intent !== "unknown" && !taskAgentIntent
          ? (output.intent as "create" | "rud")
          : taskAgentIntent;

      // Class MCQ: agent asked for class and no course is tagged yet
      if (output.needsClassClarification && !hasCourseTag) {
        const queryText =
          message.trim() || output.classTag || output.updatedClassTag || "class course";
        return {
          reply:
            "Which class is this for? Pick one below, or choose **Other** to see more options.",
          route: "tasks",
          status: "needs_class_mcq" as const,
          mcqQueryText: String(queryText),
          needsClassAfterTask: false,
          newActiveAgent: "task" as const,
          clearActiveAgent: false,
          newTaskAgentIntent: newIntent,
          readyToRecord: false,
          ...nullActionFields,
        };
      }

      // Task MCQ: RUD intent, agent needs entity, and no task is tagged yet
      const shouldShowTaskMcq =
        output.intent === "rud" && taggedTaskId === null && output.needsEntityClarification;
      if (shouldShowTaskMcq) {
        return {
          reply:
            "Which task would you like to work with? Pick one below, or choose **Other** to see more options.",
          route: "tasks",
          status: "needs_task_mcq" as const,
          mcqQueryText: message.trim() || "task assignment",
          needsClassAfterTask: false,
          newActiveAgent: "task" as const,
          clearActiveAgent: false,
          newTaskAgentIntent: newIntent,
          readyToRecord: false,
          ...nullActionFields,
        };
      }

      // Action ready — Convex will execute the mutation
      if (output.readyToExecute && output.actionType !== "none") {
        return {
          reply: output.message,
          route: "tasks",
          status: "task_action" as const,
          mcqQueryText: null,
          needsClassAfterTask: false,
          actionType: output.actionType,
          title: output.title,
          description: output.description,
          taskType: output.taskType,
          dueDateIso: output.dueDateIso,
          classTag: output.classTag,
          deleteConfirmed: output.deleteConfirmed,
          updatedTitle: output.updatedTitle,
          updatedDescription: output.updatedDescription,
          updatedTaskType: output.updatedTaskType,
          updatedDueDateIso: output.updatedDueDateIso,
          updatedClassTag: output.updatedClassTag,
          newActiveAgent: null,
          clearActiveAgent: true,
          newTaskAgentIntent: null,
          readyToRecord: false,
        };
      }

      // Conversational reply
      return {
        reply: output.message,
        route: "tasks",
        status: "reply" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: "task" as const,
        clearActiveAgent: false,
        newTaskAgentIntent: newIntent,
        readyToRecord: false,
        ...nullActionFields,
      };
    }

    // ── Feedback agent ────────────────────────────────────────────────────────
    if (route === "feedback") {
      const continueNote = message.trim()
        ? "Respond to the latest user message above."
        : "The user just selected an entity. Continue based on what is now resolved.";

      const contextPrompt = buildAgentContextPrompt({
        today,
        historyText,
        taggedEntitiesBlock,
        continueNote,
      });

      const fbResult = await feedbackAgent.generate(contextPrompt, {
        structuredOutput: { schema: feedbackAgentOutputSchema },
      });
      const output = fbResult.object;

      if (output.needsTaskClarification) {
        return {
          reply:
            "Which assignment are you referring to? Pick one below or choose **Other**.",
          route: "feedback",
          status: "needs_task_mcq" as const,
          mcqQueryText: message.trim() || "task assignment",
          needsClassAfterTask: false,
          newActiveAgent: "feedback" as const,
          clearActiveAgent: false,
          newTaskAgentIntent: null,
          readyToRecord: false,
          ...nullActionFields,
        };
      }

      if (output.needsClassClarification) {
        return {
          reply:
            "Which class are you talking about? Pick one below or choose **Other**.",
          route: "feedback",
          status: "needs_class_mcq" as const,
          mcqQueryText: message.trim() || "class course",
          needsClassAfterTask: false,
          newActiveAgent: "feedback" as const,
          clearActiveAgent: false,
          newTaskAgentIntent: null,
          readyToRecord: false,
          ...nullActionFields,
        };
      }

      return {
        reply: output.message,
        route: "feedback",
        status: "reply" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: output.readyToRecord ? null : ("feedback" as const),
        clearActiveAgent: output.readyToRecord,
        newTaskAgentIntent: null,
        readyToRecord: output.readyToRecord,
        ...nullActionFields,
      };
    }

    // ── Preferences agent ─────────────────────────────────────────────────────
    if (route === "preferences") {
      const contextPrompt = `<conversation_history>\n${historyText}\n</conversation_history>\n\n<latest_user_message>\n${message}\n</latest_user_message>\n\n<turn_directive>\nAcknowledge what they want to change and direct them to the Preferences page.\n</turn_directive>`;

      const prefResult = await preferencesAgent.generate(contextPrompt, {
        structuredOutput: {
          schema: z.object({ message: z.string(), reasoning: z.string() }),
        },
      });
      return {
        reply: prefResult.object.message,
        route: "preferences",
        status: "reply" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: null,
        clearActiveAgent: true,
        newTaskAgentIntent: null,
        readyToRecord: false,
        ...nullActionFields,
      };
    }

    // Unknown fallback
    return {
      reply:
        "I'm not sure which area that fits yet — try one more detail (tasks, schedule, classes, preferences, or feedback).",
      route: null,
      status: "reply" as const,
      mcqQueryText: null,
      needsClassAfterTask: false,
      newActiveAgent: null,
      clearActiveAgent: agentPivoted,
      newTaskAgentIntent: null,
      readyToRecord: false,
      ...nullActionFields,
    };
  },
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const chatWorkflow = createWorkflow({
  id: "chat-workflow",
  inputSchema: chatWorkflowInputSchema,
  outputSchema: chatWorkflowOutputSchema,
})
  .then(chatStep)
  .commit();
