import { createWorkflow, createStep } from "@mastra/core/workflows";
import { supervisorAgent } from "../agents/supervisorAgent";
import { taskAgent } from "../agents/taskAgent";
import { feedbackAgent } from "../agents/feedbackAgent";
import { courseAgent } from "../agents/courseAgent";
import { scheduleAgent } from "../agents/scheduleAgent";

import { supervisorAgentOutputSchema } from "../lib/prompts/supervisorAgent.prompt";
import { taskAgentOutputSchema, type TaskAgentOutput } from "../lib/prompts/taskAgent.prompt";
import {
  feedbackAgentOutputSchema,
  type FeedbackAgentOutput,
} from "../lib/prompts/feedbackAgent.prompt";
import { courseAgentOutputSchema, type CourseAgentOutput } from "../lib/prompts/courseAgent.prompt";
import {
  scheduleAgentOutputSchema,
  type ScheduleAgentOutput,
} from "../lib/prompts/scheduleAgent.prompt";

import {
  chatContextSchema,
  routedContextSchema,
  chatWorkflowOutputSchema,
  ChatWorkflowOutput,
} from "../lib/schemas/chatSchemas";

// For task action clarifying
const NO_ACTION = {
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
  generateSubtasks: null,
  courseName: null,
  sisQuery: null,
  term: null,
  school: null,
  studyGoal: null,
  grade: null,
  difficultyRating: null,
} as const;

function courseFields(output: CourseAgentOutput) {
  return {
    courseName: output.courseName,
    sisQuery: output.sisQuery,
    term: output.term,
    school: output.school,
    studyGoal: output.studyGoal,
    grade: output.grade,
    difficultyRating: output.difficultyRating,
  } as const;
}

function courseReplyBase(
  newIntent: "add" | "drop" | "view" | "update" | null,
  intentSwitch: boolean
) {
  return {
    route: "classes" as const,
    needsClassAfterTask: false,
    newActiveAgent: "classes" as const,
    clearActiveAgent: intentSwitch,
    newTaskAgentIntent: null,
    newCourseAgentIntent: newIntent,
    readyToRecord: false,
  } as const;
}

function courseNeedsClassMcq(
  output: CourseAgentOutput,
  newIntent: "add" | "drop" | "view" | "update" | null,
  courseQueryText: string,
  intentSwitch: boolean
): ChatWorkflowOutput {
  return {
    reply:
      "Which class are you referring to? Pick one below, or choose **Other** to see more options.",
    status: "needs_class_mcq",
    mcqQueryText: courseQueryText,
    ...courseReplyBase(newIntent, intentSwitch),
    ...NO_ACTION,
    actionType: "none",
    ...courseFields(output),
  };
}

// canned replies for routes
const CANNED_REPLIES: Record<string, string> = {
  classes: "To add or remove a course, or upload a syllabus, visit the **Classes** page.",
  preferences:
    "You can update your study preferences (focus length, work hours, and more) from the **Preferences** page.",
};

// Context formatting for agents
function agentContextPrompt(p: {
  today: string;
  historyText: string;
  taggedEntitiesBlock: string;
  continueNote: string;
}): string {
  return `Today (ISO date): ${p.today}\n\n<conversation_history>\n${p.historyText}\n</conversation_history>\n\n<resolved_task_context>\n${p.taggedEntitiesBlock}\n</resolved_task_context>\n\n<resolved_course_context>\nCourse context is represented by tagged course IDs above (and by any tagged task that links to a course).\n</resolved_course_context>\n\n<turn_directive>\n${p.continueNote}\n</turn_directive>`;
}

// Task output formatting for chat workflow
function taskOutput(
  output: TaskAgentOutput,
  ctx: {
    message: string;
    hasCourseTag: boolean;
    taggedTaskId: string | null;
    taskAgentIntent: "create" | "rud" | null;
    intentSwitch: boolean;
  }
): ChatWorkflowOutput {
  const { message, hasCourseTag, taggedTaskId, taskAgentIntent, intentSwitch } = ctx;
  const newIntent: "create" | "rud" | null =
    output.intent !== "unknown" && !taskAgentIntent
      ? (output.intent as "create" | "rud")
      : taskAgentIntent;

  if (output.needsClassClarification && !hasCourseTag) {
    return {
      reply: "Which class is this for? Pick one below, or choose **Other** to see more options.",
      route: "tasks",
      status: "needs_class_mcq",
      mcqQueryText: String(
        message.trim() || output.classTag || output.updatedClassTag || "class course"
      ),
      needsClassAfterTask: false,
      newActiveAgent: "task",
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: newIntent,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
  }
  if (output.intent === "rud" && taggedTaskId === null && output.needsEntityClarification) {
    return {
      reply:
        "Which task would you like to work with? Pick one below, or choose **Other** to see more options.",
      route: "tasks",
      status: "needs_task_mcq",
      mcqQueryText: message.trim() || "task assignment",
      needsClassAfterTask: false,
      newActiveAgent: "task",
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: newIntent,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
  }
  if (output.readyToExecute && output.actionType !== "none") {
    return {
      reply: output.message,
      route: "tasks",
      status: "task_action",
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
      generateSubtasks: output.generateSubtasks,
      courseName: null,
      sisQuery: null,
      term: null,
      school: null,
      studyGoal: null,
      grade: null,
      difficultyRating: null,
      newActiveAgent: null,
      clearActiveAgent: true,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
    };
  }
  return {
    reply: output.message,
    route: "tasks",
    status: "reply",
    mcqQueryText: null,
    needsClassAfterTask: false,
    newActiveAgent: "task",
    clearActiveAgent: intentSwitch,
    newTaskAgentIntent: newIntent,
    newCourseAgentIntent: null,
    readyToRecord: false,
    ...NO_ACTION,
  };
}

// Feedback output formatting for chat workflow
function feedbackOutput(
  output: FeedbackAgentOutput,
  ctx: { message: string; intentSwitch: boolean }
): ChatWorkflowOutput {
  const { message, intentSwitch } = ctx;
  if (output.needsTaskClarification) {
    return {
      reply: "Which assignment are you referring to? Pick one below or choose **Other**.",
      route: "feedback",
      status: "needs_task_mcq",
      mcqQueryText: message.trim() || "task assignment",
      needsClassAfterTask: false,
      newActiveAgent: "feedback",
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
  }
  if (output.needsClassClarification) {
    return {
      reply: "Which class are you talking about? Pick one below or choose **Other**.",
      route: "feedback",
      status: "needs_class_mcq",
      mcqQueryText: message.trim() || "class course",
      needsClassAfterTask: false,
      newActiveAgent: "feedback",
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
  }
  return {
    reply: output.message,
    route: "feedback",
    status: "reply",
    mcqQueryText: null,
    needsClassAfterTask: false,
    newActiveAgent: output.readyToRecord ? null : "feedback",
    clearActiveAgent: output.readyToRecord || intentSwitch,
    newTaskAgentIntent: null,
    newCourseAgentIntent: null,
    readyToRecord: output.readyToRecord,
    ...NO_ACTION,
  };
}

// Course output formatting for chat workflow
function courseOutput(
  output: CourseAgentOutput,
  ctx: {
    message: string;
    taggedCourseId: string | null;
    courseAgentIntent: "add" | "drop" | "view" | "update" | null;
    intentSwitch: boolean;
  }
): ChatWorkflowOutput {
  const { message, taggedCourseId, courseAgentIntent, intentSwitch } = ctx;
  const newIntent: "add" | "drop" | "view" | "update" | null =
    output.intent !== "unknown" && !courseAgentIntent
      ? (output.intent as "add" | "drop" | "view" | "update")
      : courseAgentIntent;
  const effectiveIntent = output.intent === "unknown" ? newIntent : output.intent;
  const courseQueryText =
    (output.sisQuery ?? output.courseName ?? message.trim()) || "class course";
  // Enforce deterministic add-course field order in workflow (not prompt-dependent):
  // term -> school -> sisQuery -> class MCQ -> remaining options.
  if (effectiveIntent === "add") {
    if (!output.term) {
      return {
        reply: "Which term is this course for? (for example, Spring 2026)",
        status: "reply",
        mcqQueryText: null,
        ...courseReplyBase(newIntent, intentSwitch),
        ...NO_ACTION,
      };
    }
    if (!output.school) {
      return {
        reply:
          "Which school is this course in? (for example, Krieger School of Arts and Sciences or Whiting School of Engineering)",
        status: "reply",
        mcqQueryText: null,
        ...courseReplyBase(newIntent, intentSwitch),
        ...NO_ACTION,
      };
    }
    if (!output.sisQuery && !output.courseName) {
      return {
        reply:
          "What course should I search for in SIS? You can share a course code or title keyword.",
        status: "reply",
        mcqQueryText: null,
        ...courseReplyBase(newIntent, intentSwitch),
        ...NO_ACTION,
      };
    }
  }
  // Enforce deterministic RUD entity resolution in workflow:
  // - drop/update always require a resolved class
  // - view can list all classes without a resolved class, but single-class view requires one
  if ((effectiveIntent === "drop" || effectiveIntent === "update") && taggedCourseId === null) {
    return courseNeedsClassMcq(output, newIntent, courseQueryText, intentSwitch);
  }
  if (effectiveIntent === "view" && taggedCourseId === null) {
    const listingAllCourses =
      output.readyToExecute &&
      output.actionType === "view_courses" &&
      output.courseName === null &&
      output.sisQuery === null;
    if (!listingAllCourses) {
      return courseNeedsClassMcq(output, newIntent, courseQueryText, intentSwitch);
    }
  }
  if (output.needsClassClarification && (effectiveIntent === "add" || taggedCourseId === null)) {
    return courseNeedsClassMcq(output, newIntent, courseQueryText, intentSwitch);
  }
  if (output.readyToExecute && output.actionType !== "none") {
    return {
      reply: output.message,
      route: "classes",
      status: "course_action",
      mcqQueryText: null,
      needsClassAfterTask: false,
      ...NO_ACTION,
      actionType: output.actionType,
      ...courseFields(output),
      newActiveAgent: null,
      clearActiveAgent: true,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
    };
  }
  return {
    reply: output.message,
    route: "classes",
    status: "reply",
    mcqQueryText: null,
    needsClassAfterTask: false,
    newActiveAgent: "classes",
    clearActiveAgent: intentSwitch,
    newTaskAgentIntent: null,
    newCourseAgentIntent: newIntent,
    readyToRecord: false,
    ...NO_ACTION,
  };
}

// Schedule output formatting for chat workflow
function scheduleOutput(
  output: ScheduleAgentOutput,
  ctx: { message: string; intentSwitch: boolean }
): ChatWorkflowOutput {
  const { message, intentSwitch } = ctx;
  if (output.needsTaskClarification) {
    return {
      reply:
        "Which task would you like me to schedule? Pick one below, or choose **Other** to see more options.",
      route: "schedule",
      status: "needs_task_mcq",
      mcqQueryText: message.trim() || "task assignment",
      needsClassAfterTask: false,
      newActiveAgent: "schedule",
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
  }
  if (output.readyToExecute && output.actionType !== "none") {
    return {
      reply: output.message,
      route: "schedule",
      status: "schedule_action",
      mcqQueryText: null,
      needsClassAfterTask: false,
      ...NO_ACTION,
      actionType: output.actionType,
      newActiveAgent: null,
      clearActiveAgent: true,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
    };
  }
  return {
    reply: output.message,
    route: "schedule",
    status: "reply",
    mcqQueryText: null,
    needsClassAfterTask: false,
    newActiveAgent: "schedule",
    clearActiveAgent: intentSwitch,
    newTaskAgentIntent: null,
    newCourseAgentIntent: null,
    readyToRecord: false,
    ...NO_ACTION,
  };
}

// Router step

// Map an active sub-agent identifier to the supervisor route it corresponds to.
function activeAgentToRoute(
  agent: "task" | "feedback" | "preferences" | "classes" | "schedule"
): "tasks" | "feedback" | "preferences" | "classes" | "schedule" {
  return agent === "task" ? "tasks" : agent;
}

function buildSupervisorPrompt(p: {
  activeAgent: "task" | "feedback" | "preferences" | "classes" | "schedule" | null;
  historyText: string;
  message: string;
}): string {
  const agentTag = p.activeAgent ? activeAgentToRoute(p.activeAgent) : "none";
  return `<active_agent>${agentTag}</active_agent>\n<conversation_history>\n${p.historyText}\n</conversation_history>\n<user_message>\n${p.message}\n</user_message>`;
}

const routerStep = createStep({
  id: "router",
  inputSchema: chatContextSchema,
  outputSchema: routedContextSchema,
  execute: async ({ inputData }) => {
    const { message, activeAgent, historyText } = inputData;
    const trimmed = message.trim();

    // Empty message turns happen when the UI calls the workflow after the user
    // resolved an entity from a picker. There is no new user intent to classify
    // — route directly back to the active agent (or fall through to canned).
    if (!trimmed) {
      if (activeAgent) {
        return {
          ...inputData,
          route: activeAgentToRoute(activeAgent),
          needsDomainClarification: false,
          domainClarifyingQuestion: null,
          intentSwitch: false,
        };
      }
      return {
        ...inputData,
        route: null,
        needsDomainClarification: false,
        domainClarifyingQuestion: null,
        intentSwitch: false,
      };
    }

    // Always run supervisor with conversation context. When a sub-agent is
    // active, the supervisor decides whether the new message stays in the same
    // domain (continuation) or pivots to a different route (intent switch).
    const sv = await supervisorAgent.generate(
      buildSupervisorPrompt({ activeAgent, historyText, message: trimmed }),
      { structuredOutput: { schema: supervisorAgentOutputSchema } }
    );
    const { route, needsDomainClarification, domainClarifyingQuestion } = sv.object;

    if (!activeAgent) {
      return {
        ...inputData,
        route,
        needsDomainClarification,
        domainClarifyingQuestion,
        intentSwitch: false,
      };
    }

    const activeRoute = activeAgentToRoute(activeAgent);
    // Treat mid-flow domain clarifications as continuations of the active agent
    // — the canned step would otherwise tear down the in-progress flow without
    // routing us anywhere productive.
    if (needsDomainClarification || !route) {
      return {
        ...inputData,
        route: activeRoute,
        needsDomainClarification: false,
        domainClarifyingQuestion: null,
        intentSwitch: false,
      };
    }
    if (route === activeRoute) {
      return {
        ...inputData,
        route,
        needsDomainClarification: false,
        domainClarifyingQuestion: null,
        intentSwitch: false,
      };
    }

    // Intent switch: drop the previous agent's carried-over context so the new
    // sub-agent starts fresh and re-infers intent / fields from the new message.
    return {
      ...inputData,
      route,
      needsDomainClarification: false,
      domainClarifyingQuestion: null,
      intentSwitch: true,
      hasCourseTag: false,
      taggedTaskId: null,
      taggedCourseId: null,
      taskAgentIntent: null,
      courseAgentIntent: null,
    };
  },
});

// Build the per-turn directive for a sub-agent. When `intentSwitch` is true the
// user just pivoted from a different sub-agent's flow, so we explicitly tell
// the new sub-agent to treat the latest message as the start of a fresh
// conversation and to ignore any in-progress context from earlier turns.
function subAgentContinueNote(message: string, intentSwitch: boolean): string {
  if (intentSwitch) {
    return "The user has just switched topics from a different in-progress flow. Treat the latest user message above as the START of a NEW conversation in your domain — re-detect intent from scratch, do not assume any prior task/course/block from the history applies, and respond directly to what the user now wants to do.";
  }
  return message.trim()
    ? "Respond to the latest user message above."
    : "The user just selected an entity from the picker (no new text). Based on the conversation history and the now-resolved context, continue the conversation — e.g. proceed to the next missing field, confirm deletion, or summarise the resolved entity.";
}

//task step

const taskStep = createStep({
  id: "task_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const {
      message,
      historyText,
      taggedEntitiesBlock,
      hasCourseTag,
      taggedTaskId,
      today,
      taskAgentIntent,
      intentSwitch,
    } = inputData;
    const continueNote = subAgentContinueNote(message, intentSwitch);
    const result = await taskAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: taskAgentOutputSchema } }
    );
    return taskOutput(result.object, {
      message,
      hasCourseTag,
      taggedTaskId,
      taskAgentIntent,
      intentSwitch,
    });
  },
});

// Feedback step

const feedbackStep = createStep({
  id: "feedback_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const { message, historyText, taggedEntitiesBlock, today, intentSwitch } = inputData;
    const continueNote = subAgentContinueNote(message, intentSwitch);
    const result = await feedbackAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: feedbackAgentOutputSchema } }
    );
    return feedbackOutput(result.object, { message, intentSwitch });
  },
});

// Course step
const courseStep = createStep({
  id: "course_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }): Promise<ChatWorkflowOutput> => {
    const {
      message,
      historyText,
      taggedEntitiesBlock,
      taggedCourseId,
      today,
      courseAgentIntent,
      intentSwitch,
    } = inputData;
    const continueNote = subAgentContinueNote(message, intentSwitch);
    const result = await courseAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: courseAgentOutputSchema } }
    );
    return courseOutput(result.object, {
      message,
      taggedCourseId,
      courseAgentIntent,
      intentSwitch,
    });
  },
});

// Schedule step
const scheduleStep = createStep({
  id: "schedule_handler",
  inputSchema: routedContextSchema,
  outputSchema: chatWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const { message, historyText, taggedEntitiesBlock, today, intentSwitch } = inputData;
    const continueNote = subAgentContinueNote(message, intentSwitch);
    const result = await scheduleAgent.generate(
      agentContextPrompt({ today, historyText, taggedEntitiesBlock, continueNote }),
      { structuredOutput: { schema: scheduleAgentOutputSchema } }
    );
    return scheduleOutput(result.object, { message, intentSwitch });
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
    const { route, needsDomainClarification, domainClarifyingQuestion, intentSwitch } = inputData;
    if (needsDomainClarification && domainClarifyingQuestion) {
      return {
        reply: domainClarifyingQuestion,
        route: null,
        status: "domain_clarify" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: null,
        clearActiveAgent: intentSwitch,
        newTaskAgentIntent: null,
        newCourseAgentIntent: null,
        readyToRecord: false,
        ...NO_ACTION,
      };
    }
    if (route && route in CANNED_REPLIES) {
      return {
        reply: CANNED_REPLIES[route],
        route,
        status: "canned" as const,
        mcqQueryText: null,
        needsClassAfterTask: false,
        newActiveAgent: null,
        clearActiveAgent: intentSwitch,
        newTaskAgentIntent: null,
        newCourseAgentIntent: null,
        readyToRecord: false,
        ...NO_ACTION,
      };
    }
    return {
      reply:
        "I'm not sure which area that fits yet — try one more detail (tasks, schedule, classes, preferences, or feedback).",
      route: null,
      status: "reply" as const,
      mcqQueryText: null,
      needsClassAfterTask: false,
      newActiveAgent: null,
      clearActiveAgent: intentSwitch,
      newTaskAgentIntent: null,
      newCourseAgentIntent: null,
      readyToRecord: false,
      ...NO_ACTION,
    };
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
    [async ({ inputData }) => inputData.route === "classes", courseStep],
    [async ({ inputData }) => inputData.route === "schedule", scheduleStep],
    [async () => true, cannedStep], // domain-clarify, unknown, preferences
  ])
  .commit();
