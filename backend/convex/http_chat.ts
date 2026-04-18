import { Hono, type Context } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { HonoEnv } from "./lib/httpTypes";
import {
  collectUniqueTaggedIds,
  getLastUserMessage,
  shouldOfferTaskEntityMcq,
  walkLatestTaggedCourseId,
  walkLatestTaggedTaskId,
  type TaggedMessageView,
} from "./lib/messageTaggedScope";

const chatApp = new Hono<HonoEnv>();

/** Output from the supervisor-workflow "route" step. */
type WorkflowRouteOutput = {
  route: "tasks" | "schedule" | "preferences" | "feedback" | "classes" | null;
  needsDomainClarification: boolean;
  domainClarifyingQuestion: string | null;
  reasoning: string;
};

type ChatSessionSnapshot = {
  lastEntityQueryText?: string;
  activeEntityStep?: "task" | "class";
  needsClassAfterTask?: boolean;
  clarificationAttemptCount?: number;
  clarificationExhausted?: boolean;
  awaitingEntityResolution?: boolean;
  chatInputLocked?: boolean;
  activeAgent?: "task" | "feedback" | "preferences";
  taskAgentIntent?: "create" | "rud";
};

async function threadHasTaggedCourse(
  ctx: ActionCtx,
  userId: Id<"users">,
  historyAsc: readonly TaggedMessageView[],
): Promise<boolean> {
  if (walkLatestTaggedCourseId(historyAsc) !== undefined) return true;
  const tid = walkLatestTaggedTaskId(historyAsc);
  if (tid === undefined) return false;
  const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId: tid });
  return !!(task && task.userId === userId && task.courseId);
}

/** Rich block for Mastra: all tagged tasks/courses in the sliding window + “most recent” tag. */
async function buildTaggedEntitiesContextBlock(
  ctx: ActionCtx,
  userId: Id<"users">,
  historyAsc: readonly TaggedMessageView[],
): Promise<string> {
  const { taskIds, courseIds } = collectUniqueTaggedIds(historyAsc);
  const extraCourseIds = new Set<string>();
  const lines: string[] = [];

  if (taskIds.length === 0 && courseIds.length === 0) {
    return "No task or course IDs are tagged on messages in this window yet.";
  }

  lines.push("Entities referenced by message tags in this thread:");
  for (const tid of taskIds) {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId: tid });
    if (task && task.userId === userId) {
      lines.push(
        `- Task "${task.title}" (${task.taskType}, due ${new Date(task.dueDate).toISOString().slice(0, 10)}${task.classTag ? `, class: ${task.classTag}` : ""}) → taskId ${String(tid)}`,
      );
      if (task.courseId) extraCourseIds.add(String(task.courseId));
    }
  }

  const mergedCourse = new Set([...courseIds.map(String), ...extraCourseIds]);
  for (const cid of mergedCourse) {
    const courses = await ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
      courseIds: [cid as Id<"userCourses">],
    });
    const c2 = courses[0];
    if (c2 && c2.userId === userId) {
      lines.push(`- Course "${c2.title}" (${c2.courseCode}) → courseId ${String(cid)}`);
    }
  }

  const primaryTask = walkLatestTaggedTaskId(historyAsc);
  const primaryCourse = walkLatestTaggedCourseId(historyAsc);
  lines.push(
    `Most recent tag in transcript (newest message first among tagged rows): ${primaryTask ? `taskId=${String(primaryTask)}` : "no task tag"}, ${primaryCourse ? `courseId=${String(primaryCourse)}` : "no course tag"}.`,
  );
  lines.push(
    "Use these IDs for update/delete/read and for class on create when they match the user's latest request. Multiple tasks may appear — prefer the most recent tag unless the user clearly names a different assignment.",
  );

  return lines.join("\n");
}

type FeedbackAgentOutput = {
  message: string;
  intent: "task_feedback" | "class_feedback" | "unknown";
  needsTaskClarification: boolean;
  needsClassClarification: boolean;
  readyToRecord: boolean;
  effortRating: "easier" | "about_right" | "harder" | null;
  actualMinutes: number | null;
  whatWasHard: string | null;
  reasoning: string;
};

type TaskAgentOutput = {
  message: string;
  intent: "create" | "rud" | "unknown";
  needsEntityClarification: boolean;
  needsClassClarification: boolean;
  readyToExecute: boolean;
  actionType: "create_task" | "update_task" | "delete_task" | "read_task" | "none";
  title: string | null;
  description: string | null;
  taskType: string | null;
  dueDateIso: string | null;
  classTag: string | null;
  deleteConfirmed: boolean;
  updatedTitle: string | null;
  updatedDescription: string | null;
  updatedTaskType: string | null;
  updatedDueDateIso: string | null;
  updatedClassTag: string | null;
  reasoning: string;
};

/** Parses an ISO date string from the task agent into a unix ms timestamp. */
function parseDueDateIso(iso: string): number {
  if (!iso) return Date.now() + 86_400_000;
  const hasTime = iso.includes("T") && iso.length > 10;
  const normalized = hasTime ? iso : `${iso}T23:59:59`;
  const ms = new Date(normalized).getTime();
  return isNaN(ms) ? Date.now() + 86_400_000 : ms;
}

const MENU_USER_LABELS: Record<string, string> = {
  tasks: "Help with tasks",
  classes: "Class questions",
  feedback: "Give feedback on a task",
  schedule: "Schedule something",
  preferences: "Change my preferences",
};

const MENU_CANNED: Record<string, string> = {
  schedule:
    "To schedule or manage your study blocks, visit the **Schedule** page. To connect or revoke Google Calendar access, head to the **Profile** page.",
  preferences:
    "You can update study preferences (focus length, work hours, and similar options) from the **Preferences** page.",
};

/** Shown when the task agent signals needsEntityClarification for RUD. */
const TASK_AGENT_RUD_INTRO =
  "Which task would you like to work with? Pick one below, or choose **Other** to see more options.";

/** Max messages per session before the chat is locked. ~15 turns is plenty for one task. */
const CHAT_MESSAGE_LIMIT = 20;

const CHAT_LIMIT_MSG =
  "This chat has reached its message limit. Close the widget (×) and open Maxx again to start a fresh conversation.";

const EXHAUSTED_MSG =
  "I still can't tell which task or class you mean after a few tries. " +
  "Try naming a course code or assignment title, or open it from your list — then ask again.";

const ENTITY_INTRO_TASK =
  "Which task do you mean? Pick one below, or choose **Other** to see more options.";

const ENTITY_INTRO_CLASS =
  "Which class do you mean? Pick one below, or choose **Other** to see more options.";


const CHAT_INPUT_LOCKED_REPLY_MSG =
  "This chat was closed for new topics. Close the widget (×), then open Maxx again to start a fresh session.";


/** Executes the Convex mutation indicated by the task agent output. */
async function executeTaskAction(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    historyAsc: readonly TaggedMessageView[];
    output: TaskAgentOutput;
  },
): Promise<Response> {
  const { userId, sessionId, historyAsc, output } = params;
  const { actionType } = output;
  let aiText = output.message;

  const taggedTaskId = walkLatestTaggedTaskId(historyAsc);
  const taggedCourseId = walkLatestTaggedCourseId(historyAsc);

  try {
    if (actionType === "create_task") {
      if (!output.title || !output.dueDateIso || !output.taskType) {
        throw new Error("Missing required task fields.");
      }
      await ctx.runMutation(internal.mutations.tasks.createTaskInternal, {
        userId,
        title: output.title,
        description: output.description ?? output.title,
        taskType: output.taskType,
        dueDate: parseDueDateIso(output.dueDateIso),
        ...(taggedCourseId ? { courseId: taggedCourseId } : {}),
        ...(output.classTag ? { classTag: output.classTag } : {}),
      });
    } else if (actionType === "update_task") {
      if (taggedTaskId === undefined) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.patchTaskFieldsInternal, {
        userId,
        taskId: taggedTaskId,
        ...(output.updatedTitle ? { title: output.updatedTitle } : {}),
        ...(output.updatedDescription ? { description: output.updatedDescription } : {}),
        ...(output.updatedTaskType ? { taskType: output.updatedTaskType } : {}),
        ...(output.updatedDueDateIso ? { dueDate: parseDueDateIso(output.updatedDueDateIso) } : {}),
        ...(taggedCourseId ? { courseId: taggedCourseId } : {}),
        ...(output.updatedClassTag !== undefined && output.updatedClassTag !== null
          ? { classTag: output.updatedClassTag }
          : {}),
      });
    } else if (actionType === "delete_task") {
      if (taggedTaskId === undefined) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.deleteTaskInternal, {
        userId,
        taskId: taggedTaskId,
      });
    }
    // "read_task": no mutation, agent message already has details
  } catch (err) {
    aiText = `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`;
  }

  // Clear task agent mode so the session can accept new topics
  await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
    ...(taggedTaskId !== undefined ? { taskId: taggedTaskId } : {}),
    ...(taggedCourseId !== undefined ? { courseId: taggedCourseId } : {}),
  });
  return c.json({ text: aiText, status: "routed", route: "tasks", entityKind: "none", messageTag: "none", tagConfidence: 0 });
}

/**
 * Routes a message to the task agent when activeAgent === "task".
 * Handles the full lifecycle: intent detection → entity MCQ (RUD only) → execute.
 */
async function handleTaskAgentMessage(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    session: ChatSessionSnapshot | null;
    client: InstanceType<typeof MastraClient>;
    /** User row that started this turn (for MCQ trigger tagging). */
    triggerUserMessageId?: Id<"chatMessages">;
  },
): Promise<Response> {
  const { userId, sessionId, message, session, client, triggerUserMessageId } = params;

  // Load chat history for context (last 20 messages)
  const rawHistory = (await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId,
    sessionId,
    limit: 20,
  })) as TaggedMessageView[];
  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const taggedBlock = await buildTaggedEntitiesContextBlock(ctx, userId, rawHistory);

  const today = new Date().toISOString().slice(0, 10);
  // When message is empty the user just picked an entity from the MCQ — no new text.
  const continueNote = message.trim()
    ? "Respond to the latest user message above."
    : "The user just selected an entity from the picker (no new text). Based on the conversation history and the now-resolved context, continue the conversation — e.g. proceed to the next missing field, confirm deletion, or summarise task details.";
  const contextPrompt =
    `Today is ${today}.\n\nConversation history (oldest first):\n${historyText}\n\n${taggedBlock}\n\n${continueNote}`;

  const taskWf = client.getWorkflow("task-workflow");
  const run = await taskWf.startAsync({ inputData: { contextPrompt } });

  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
        return c.json({ error: "quota_exceeded" }, 429);
      }
    }
  }

  const agentStep = run.steps?.["task-agent"];
  const output = (agentStep && "output" in agentStep ? agentStep.output : null) as TaskAgentOutput | null;

  if (!output) {
    return c.json({ error: "task_agent_unavailable" }, 502);
  }

  // Persist intent once determined
  if (output.intent !== "unknown" && !session?.taskAgentIntent) {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId,
      sessionId,
      taskAgentIntent: output.intent as "create" | "rud",
    });
  }

  const mcqTriggerId = triggerUserMessageId ?? getLastUserMessage(rawHistory)?._id;

  // Class clarification needed (create or update) → show course MCQ
  const hasCourseTag = await threadHasTaggedCourse(ctx, userId, rawHistory);
  if (output.needsClassClarification && !hasCourseTag) {
    const queryText = message.trim() || output.classTag || output.updatedClassTag || "class course";
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      { userId, queryText: String(queryText), excludeIds: [] },
    );
    const introText =
      candidates.length === 0
        ? "I couldn't find any courses in your profile. Add courses from the Classes page, then try again."
        : "Which class is this for? Pick one below, or choose **Other** to see more options.";
    const taskForIntro = walkLatestTaggedTaskId(rawHistory);
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: introText,
      ...(taskForIntro !== undefined ? { taskId: taskForIntro } : {}),
    });
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: String(queryText),
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "class",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: "tasks",
      entityKind: "class",
      messageTag: "none",
      tagConfidence: 0,
      needsClassAfterTask: false,
    });
  }

  // RUD + no task tag for this turn → show entity MCQ
  if (output.intent === "rud" && shouldOfferTaskEntityMcq(output.needsEntityClarification, rawHistory, message)) {
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText: message, excludeIds: [] },
    );
    const introText =
      candidates.length === 0
        ? "I couldn't find matching tasks. Try naming the assignment, or add tasks from the dashboard."
        : TASK_AGENT_RUD_INTRO;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: introText,
    });
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: message,
        activeEntityStep: "task",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "task",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: "tasks",
      entityKind: "task",
      messageTag: "none",
      tagConfidence: 0,
      needsClassAfterTask: false,
    });
  }

  // Ready to execute a Convex mutation
  if (output.readyToExecute && output.actionType !== "none") {
    return executeTaskAction(ctx, c, { userId, sessionId, historyAsc: rawHistory, output });
  }

  // Still gathering info — relay agent's conversational message
  const aiText = output.message;
  const tagTask = walkLatestTaggedTaskId(rawHistory);
  const tagCourse = walkLatestTaggedCourseId(rawHistory);
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
    ...(tagTask !== undefined ? { taskId: tagTask } : {}),
    ...(tagCourse !== undefined ? { courseId: tagCourse } : {}),
  });
  return c.json({ text: aiText, status: "routed", route: "tasks", entityKind: "none", messageTag: "none", tagConfidence: 0 });
}

/**
 * Handles feedback agent conversation — entity MCQ, follow-up questions, recording.
 * Mirrors the structure of handleTaskAgentMessage.
 */
async function handleFeedbackAgentMessage(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    client: InstanceType<typeof MastraClient>;
    triggerUserMessageId?: Id<"chatMessages">;
  },
): Promise<Response> {
  const { userId, sessionId, message, client, triggerUserMessageId } = params;

  const rawHistory = (await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId,
    sessionId,
    limit: 20,
  })) as TaggedMessageView[];
  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const taggedBlock = await buildTaggedEntitiesContextBlock(ctx, userId, rawHistory);

  const today = new Date().toISOString().slice(0, 10);
  const continueNote = message.trim()
    ? "Respond to the latest user message above."
    : "The user just selected an entity from the picker (no new text). Continue the conversation based on what is now resolved.";
  const contextPrompt =
    `Today is ${today}.\n\nConversation history (oldest first):\n${historyText}\n\n${taggedBlock}\n\n${continueNote}`;

  const mcqTriggerId = triggerUserMessageId ?? getLastUserMessage(rawHistory)?._id;

  const wf = client.getWorkflow("feedback-workflow");
  const run = await wf.startAsync({ inputData: { contextPrompt } });

  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
        return c.json({ error: "quota_exceeded" }, 429);
      }
    }
  }

  const agentStep = run.steps?.["feedback-agent"];
  const output = (agentStep && "output" in agentStep ? agentStep.output : null) as FeedbackAgentOutput | null;

  if (!output) return c.json({ error: "feedback_agent_unavailable" }, 502);

  // Task entity needed — always show MCQ when agent asks, even if a task was previously resolved
  if (output.needsTaskClarification) {
    const latestTask = walkLatestTaggedTaskId(rawHistory);
    const excludeTaskIds = latestTask !== undefined ? [latestTask] : [];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText: message || "task assignment", excludeIds: excludeTaskIds },
    );
    const introText =
      candidates.length === 0
        ? "I don’t see any tasks yet. Add tasks from your dashboard first, then ask again."
        : "Which assignment are you referring to? Pick one below, or choose **Other** to see more options.";
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId, sessionId, role: "assistant", content: introText,
    });
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId, sessionId, lastEntityQueryText: message || "task assignment",
        activeEntityStep: "task", needsClassAfterTask: false, awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "task",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: "feedback",
    });
  }

  // Class entity needed — always show MCQ when agent asks, even if a course was previously resolved
  if (output.needsClassClarification) {
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      { userId, queryText: message || "class course", excludeIds: [] },
    );
    const introText =
      candidates.length === 0
        ? "I don’t see any courses yet. Add classes from the Classes page first, then ask again."
        : "Which class are you talking about? Pick one below, or choose **Other** to see more options.";
    const taskForClassIntro = walkLatestTaggedTaskId(rawHistory);
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId, sessionId, role: "assistant", content: introText,
      ...(taskForClassIntro !== undefined ? { taskId: taskForClassIntro } : {}),
    });
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId, sessionId, lastEntityQueryText: message || "class course",
        activeEntityStep: "class", needsClassAfterTask: false, awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "class",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: "feedback",
    });
  }

  // Feedback complete — relay final message and clear agent
  if (output.readyToRecord) {
    await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
      userId, sessionId,
    });
  }

  const aiText = output.message;
  const tagTask = walkLatestTaggedTaskId(rawHistory);
  const tagCourse = walkLatestTaggedCourseId(rawHistory);
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId, sessionId, role: "assistant", content: aiText,
    ...(tagTask !== undefined ? { taskId: tagTask } : {}),
    ...(tagCourse !== undefined ? { courseId: tagCourse } : {}),
  });
  return c.json({ text: aiText, status: "routed", route: "feedback" });
}

/** Preferences agent stub — canned redirect to Preferences page. */
async function handlePreferencesAgentMessage(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    client: InstanceType<typeof MastraClient>;
  },
): Promise<Response> {
  const { userId, sessionId, message, client } = params;

  const rawHistory = await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId, sessionId, limit: 10,
  });
  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const contextPrompt =
    `Conversation history:\n${historyText}\n\nLatest user message: ${message}\nAcknowledge what they want to change and direct them to the Preferences page.`;

  const wf = client.getWorkflow("preferences-workflow");
  const run = await wf.startAsync({ inputData: { contextPrompt } });
  const agentStep = run.steps?.["preferences-agent"];
  const output = agentStep && "output" in agentStep
    ? (agentStep.output as { message: string })
    : null;

  const aiText = output?.message ??
    "To update your preferences (focus length, work hours, etc.), head to the **Preferences** page from the navigation menu.";

  await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
    userId, sessionId,
  });
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId, sessionId, role: "assistant", content: aiText,
  });
  return c.json({ text: aiText, status: "routed", route: "preferences" });
}

/**
 * Routes a supervisor output to the correct subagent or canned response.
 * The supervisor is a pure router — entity clarification lives in each subagent.
 */
async function continueAfterSupervisorOutput(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    userMessageId: Id<"chatMessages">;
    output: WorkflowRouteOutput;
  },
): Promise<Response> {
  const { userId, sessionId, message, output, userMessageId } = params;

  // Domain not recognised — ask clarifying question
  if (output.needsDomainClarification && output.domainClarifyingQuestion) {
    const aiText = output.domainClarifyingQuestion;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId, sessionId, role: "assistant", content: aiText,
    });
    return c.json({ text: aiText, status: "needs_domain_clarification", route: null });
  }

  const mastraUrl = process.env.MASTRA_URL;
  if (!mastraUrl) return c.json({ error: "MASTRA_URL not configured" }, 503);
  const subClient = new MastraClient({ baseUrl: mastraUrl });

  // Tasks → task agent (owns all entity clarification for tasks)
  if (output.route === "tasks") {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId, sessionId, activeAgent: "task",
    });
    const session = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
      userId, sessionId,
    });
    return handleTaskAgentMessage(ctx, c, {
      userId, sessionId, message,
      session: { ...session, activeAgent: "task" as const },
      client: subClient,
      triggerUserMessageId: userMessageId,
    });
  }

  // Feedback → feedback agent (owns entity clarification for task/class)
  if (output.route === "feedback") {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId, sessionId, activeAgent: "feedback",
    });
    return handleFeedbackAgentMessage(ctx, c, {
      userId, sessionId, message,
      client: subClient,
      triggerUserMessageId: userMessageId,
    });
  }

  // Preferences → preferences agent (stub)
  if (output.route === "preferences") {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId, sessionId, activeAgent: "preferences",
    });
    return handlePreferencesAgentMessage(ctx, c, {
      userId, sessionId, message, client: subClient,
    });
  }

  // Schedule / Classes / unknown → canned response
  const CANNED: Partial<Record<string, string>> = {
    schedule: "To schedule or manage your study blocks, visit the **Schedule** page. To connect Google Calendar, head to the **Profile** page.",
    classes: "To add or remove a course, or to upload a syllabus, visit the **Classes** page.",
  };
  const aiText = output.route
    ? (CANNED[output.route] ?? `Head to the **${output.route}** section for that.`)
    : "I’m not sure which area that fits yet — try one more detail (tasks, schedule, classes, preferences, or feedback).";

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId, sessionId, role: "assistant", content: aiText,
  });
  return c.json({ text: aiText, status: "routed", route: output.route ?? null });
}

chatApp.post("/api/chat", async (c) => {
  const { ctx, userId } = c.env;

  const body = await c.req.json<{
    message?: string;
    sessionId?: string;
    entity?: {
      action: "pick_task" | "pick_course" | "other_tasks" | "other_courses" | "menu_pick";
      taskId?: string;
      courseId?: string;
      excludeTaskIds?: string[];
      excludeCourseIds?: string[];
      route?: string;
    };
  }>();

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return c.json({ error: "Bad Request" }, 400);
  }

  await ctx.runMutation(internal.mutations.chatSessions.getOrCreateChatSessionInternal, {
    userId,
    sessionId,
  });

  const session = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
    userId,
    sessionId,
  });

  const mastraUrl = process.env.MASTRA_URL;
  if (!mastraUrl) return c.json({ error: "MASTRA_URL not configured" }, 503);
  const client = new MastraClient({ baseUrl: mastraUrl });

  // ── Entity UI actions (MCQ / Other) — no supervisor call ────────────────────
  if (body.entity?.action === "pick_task" && body.entity.taskId) {
    const taskId = body.entity.taskId as Id<"tasks">;
    const { needsClassNext } = await ctx.runMutation(
      internal.mutations.chatSessions.resolvePickedTaskInternal,
      { userId, sessionId, taskId },
    );
    await ctx.runMutation(internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal, {
      userId,
      sessionId,
      taskId,
      clearTriggerPointer: !needsClassNext,
    });
    const intro = needsClassNext ? ENTITY_INTRO_CLASS : "Got it — I’ll use that task.";
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: intro,
    });
    if (needsClassNext) {
      const s2 = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
        userId,
        sessionId,
      });
      const qText = s2?.lastEntityQueryText ?? "";
      const { candidates, hasMore } = await ctx.runAction(
        internal.actions.entityResolution.searchCourseCandidates,
        {
          userId,
          queryText: qText,
          excludeIds: [],
        },
      );
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: qText,
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
      });
      return c.json({
        text: intro,
        status: "needs_entity_clarification",
        phase: "class",
        entityCandidates: candidates,
        entityHasMore: hasMore,
        route: null,
      });
    }
    // Subagent is active — auto-continue so the agent can act without the user needing to type again.
    const sessionAfterPick = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
      userId,
      sessionId,
    });
    if (sessionAfterPick?.activeAgent === "task") {
      return handleTaskAgentMessage(ctx, c, {
        userId, sessionId, message: "", session: sessionAfterPick, client,
      });
    }
    if (sessionAfterPick?.activeAgent === "feedback") {
      return handleFeedbackAgentMessage(ctx, c, {
        userId, sessionId, message: "", client,
      });
    }

    return c.json({
      text: intro,
      status: "entity_resolved",
      phase: "task",
      route: null,
    });
  }

  if (body.entity?.action === "pick_course" && body.entity.courseId) {
    const isTaskAgentActive = session?.activeAgent === "task";

    const courseId = body.entity.courseId as Id<"userCourses">;
    await ctx.runMutation(internal.mutations.chatSessions.resolvePickedCourseInternal, {
      userId,
      sessionId,
      courseId,
    });
    await ctx.runMutation(internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal, {
      userId,
      sessionId,
      courseId,
      clearTriggerPointer: true,
    });
    const sessionAfterCourse = await ctx.runQuery(
      internal.queries.chatSessions.getChatSessionInternal,
      { userId, sessionId },
    );

    // Task agent is active — auto-continue so agent can proceed with create/update
    if (isTaskAgentActive) {
      return handleTaskAgentMessage(ctx, c, {
        userId,
        sessionId,
        message: "",   // empty = MCQ auto-continue
        session: sessionAfterCourse,
        client,
      });
    }

    const recentForPick = (await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
      userId,
      sessionId,
      limit: 15,
    })) as TaggedMessageView[];
    const hadTaskAlready = walkLatestTaggedTaskId(recentForPick) !== undefined;
    const labels = await ctx.runQuery(
      internal.queries.chatSessions.getResolvedEntityLabelsInternal,
      { userId, sessionId },
    );
    let text: string;
    if (hadTaskAlready) {
      const taskPart = labels.taskTitle ? `**${labels.taskTitle}**` : "the task";
      const classPart = labels.courseLabel ? `**${labels.courseLabel}**` : "the class";
      text = `Thanks — I’ve got ${taskPart} and ${classPart}.`;
    } else {
      text = labels.courseLabel
        ? `Thanks — I’ve got **${labels.courseLabel}**.`
        : "Thanks — I’ve got the class.";
    }
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: text,
    });
    return c.json({
      text,
      status: "entity_resolved",
      phase: "class",
      route: null,
    });
  }

  if (body.entity?.action === "other_tasks") {
    const qText = session?.lastEntityQueryText ?? "";
    if (!qText) {
      return c.json({ error: "Missing entity query context" }, 400);
    }
    const exclude = (body.entity.excludeTaskIds ?? []) as Id<"tasks">[];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      {
        userId,
        queryText: qText,
        excludeIds: exclude,
      },
    );
    return c.json({
      text: ENTITY_INTRO_TASK,
      status: "needs_entity_clarification",
      phase: "task",
      entityCandidates: candidates,
      entityHasMore: hasMore,
      route: null,
    });
  }

  if (body.entity?.action === "other_courses") {
    const qText = session?.lastEntityQueryText ?? "";
    if (!qText) {
      return c.json({ error: "Missing entity query context" }, 400);
    }
    const exclude = (body.entity.excludeCourseIds ?? []) as Id<"userCourses">[];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      {
        userId,
        queryText: qText,
        excludeIds: exclude,
      },
    );
    return c.json({
      text: ENTITY_INTRO_CLASS,
      status: "needs_entity_clarification",
      phase: "class",
      entityCandidates: candidates,
      entityHasMore: hasMore,
      route: null,
    });
  }

  // ── Main menu pick — no supervisor call needed ──────────────────────────────
  if (body.entity?.action === "menu_pick" && body.entity.route) {
    const route = body.entity.route;
    const userLabel = MENU_USER_LABELS[route] ?? route;

    const menuUserMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "user",
      content: userLabel,
    });

    // Schedule and preferences: canned response only
    const canned = MENU_CANNED[route];
    if (canned) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: canned,
      });
      return c.json({
        text: canned,
        status: "routed",
        route,
        entityKind: "none",
        messageTag: "none",
        tagConfidence: 0,
      });
    }

    // Tasks: start task agent conversation (determines create vs RUD before any MCQ)
    if (route === "tasks") {
      await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
        userId,
        sessionId,
        activeAgent: "task",
      });
      const sessionAfterMenu = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
        userId,
        sessionId,
      });
      return handleTaskAgentMessage(ctx, c, {
        userId,
        sessionId,
        message: userLabel,
        session: sessionAfterMenu,
        client,
        triggerUserMessageId: menuUserMessageId,
      });
    }

    // Feedback → feedback agent (starts conversation, asks which task/class if needed)
    if (route === "feedback") {
      await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
        userId, sessionId, activeAgent: "feedback",
      });
      return handleFeedbackAgentMessage(ctx, c, {
        userId,
        sessionId,
        message: userLabel,
        client,
        triggerUserMessageId: menuUserMessageId,
      });
    }

    // Classes → canned redirect (classes agent TBD)
    if (route === "classes") {
      const aiText = "To add or remove a course, or upload a syllabus, visit the **Classes** page.";
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId, sessionId, role: "assistant", content: aiText,
      });
      return c.json({ text: aiText, status: "routed", route });
    }

    // Unknown route fallback
    return c.json({ error: "Unknown menu route" }, 400);
  }

  // ── Normal chat message ─────────────────────────────────────────────────────
  const message = body.message?.trim();
  if (!message) {
    return c.json({ error: "Bad Request" }, 400);
  }

  const sessionBeforeUserMsg = await ctx.runQuery(
    internal.queries.chatSessions.getChatSessionInternal,
    { userId, sessionId },
  );
  if (sessionBeforeUserMsg?.chatInputLocked === true) {
    return c.json({
      text: CHAT_INPUT_LOCKED_REPLY_MSG,
      status: "chat_input_locked",
      route: null,
    });
  }
  const userMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "user",
    content: message,
  });

  // Check message limit — fetch one extra to detect overflow without counting everything.
  const recentMsgs = await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId,
    sessionId,
    limit: CHAT_MESSAGE_LIMIT + 1,
  });
  if (recentMsgs.length > CHAT_MESSAGE_LIMIT) {
    await ctx.runMutation(internal.mutations.chatSessions.setChatInputLockedInternal, {
      userId,
      sessionId,
      locked: true,
    });
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: CHAT_LIMIT_MSG,
    });
    return c.json({ text: CHAT_LIMIT_MSG, status: "chat_input_locked", route: null });
  }

  const sessionNow = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
    userId,
    sessionId,
  });

  if (sessionNow?.awaitingEntityResolution && !sessionNow.clarificationExhausted) {
    const inc = await ctx.runMutation(
      internal.mutations.chatSessions.incrementClarificationFailureInternal,
      { userId, sessionId },
    );
    if (inc.exhausted) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: EXHAUSTED_MSG,
      });
      return c.json({
        text: EXHAUSTED_MSG,
        status: "clarification_exhausted",
        route: null,
      });
    }
  }

  // ── Subagent mode — bypass supervisor ─────────────────────────────────────
  if (sessionNow?.activeAgent === "task") {
    return handleTaskAgentMessage(ctx, c, {
      userId, sessionId, message, session: sessionNow, client, triggerUserMessageId: userMessageId,
    });
  }
  if (sessionNow?.activeAgent === "feedback") {
    return handleFeedbackAgentMessage(ctx, c, {
      userId, sessionId, message, client, triggerUserMessageId: userMessageId,
    });
  }
  if (sessionNow?.activeAgent === "preferences") {
    return handlePreferencesAgentMessage(ctx, c, {
      userId, sessionId, message, client,
    });
  }

  const workflow = client.getWorkflow("supervisor-workflow");
  const run = await workflow.startAsync({ inputData: { query: message } });

  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
        return c.json({ error: "quota_exceeded" }, 429);
      }
    }
  }

  const routeStep = run.steps?.["route"];
  const output = (routeStep && "output" in routeStep ? routeStep.output : null) as
    | WorkflowRouteOutput
    | null;

  if (!output) {
    return c.json({ error: "supervisor_unavailable" }, 502);
  }

  return continueAfterSupervisorOutput(ctx, c, {
    userId,
    sessionId,
    message,
    userMessageId,
    output,
  });
});

export default chatApp;