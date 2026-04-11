import { Hono, type Context } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { HonoEnv } from "./lib/httpTypes";

const chatApp = new Hono<HonoEnv>();

type EntityKind = "task" | "class" | "both" | "none";
type MessageTag = "task_feedback" | "class_difficulty" | "none";

type WorkflowRespondOutput = {
  status: "needs_domain_clarification" | "needs_entity_clarification" | "routed";
  clarifyingQuestion: string | null;
  entityKind: EntityKind;
  messageTag: MessageTag;
  tagConfidence: number;
  route: string | null;
  reasoning: string | null;
  query: string | null;
  cannedResponse: string | null;
};

type ChatSessionSnapshot = {
  resolvedTaskId?: Id<"tasks">;
  resolvedCourseId?: Id<"userCourses">;
  lastEntityQueryText?: string;
  activeEntityStep?: "task" | "class";
  needsClassAfterTask?: boolean;
  clarificationAttemptCount?: number;
  clarificationExhausted?: boolean;
  awaitingEntityResolution?: boolean;
  awaitingScopeConfirm?: boolean;
  chatInputLocked?: boolean;
  scopeBypassNextMessage?: boolean;
  pendingScopeUserMessageId?: Id<"chatMessages">;
  activeAgent?: "task";
  taskAgentIntent?: "create" | "rud";
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

const TASK_MENU_INTRO =
  "Which task would you like help with? Pick one below, or choose **Other** to see more options.";
const TASK_FEEDBACK_INTRO =
  "Which task are you giving feedback on? Pick one below, or choose **Other** to see more options.";
const CLASS_MENU_INTRO =
  "Which class would you like to ask about? Pick one below, or choose **Other** to see more options.";

const EXHAUSTED_MSG =
  "I still can't tell which task or class you mean after a few tries. " +
  "Try naming a course code or assignment title, or open it from your list — then ask again.";

const ENTITY_INTRO_TASK =
  "Which task do you mean? Pick one below, or choose **Other** to see more options.";

const ENTITY_INTRO_CLASS =
  "Which class do you mean? Pick one below, or choose **Other** to see more options.";

const ENTITY_NUDGE_TASK =
  "I didn’t get a clear choice yet — tap one of the tasks below, or **Other…**, so I know which one you mean.";

const ENTITY_NUDGE_CLASS =
  "I didn’t get a clear choice yet — tap one of the classes below, or **Other…**, so I know which one you mean.";

const SCOPE_DENY_FINAL_MSG =
  "You can’t have two different task or class topics in the same chat. Please **close** this chat (× on the widget), then open Maxx again for a fresh session.";

const SCOPE_USE_BUTTONS_MSG =
  "Please tap **Yes** or **No** below so I know whether you’re still on the same task or class.";

const SCOPE_YES_ACK_MSG =
  "Got it — I’ll keep this chat on that same task/class. Go ahead with your next message.";

const CHAT_INPUT_LOCKED_REPLY_MSG =
  "This chat was closed for new topics. Close the widget (×), then open Maxx again to start a fresh session.";

async function persistAndReturnScopeConfirmation(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  userId: Id<"users">,
  sessionId: string,
  meta?: {
    route: string | null;
    entityKind: EntityKind;
    messageTag: MessageTag;
    tagConfidence: number;
  },
  pendingUserMessageId?: Id<"chatMessages">,
) {
  const labels = await ctx.runQuery(internal.queries.chatSessions.getResolvedEntityLabelsInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatSessions.beginAwaitingScopeConfirmInternal, {
    userId,
    sessionId,
    ...(pendingUserMessageId !== undefined
      ? { pendingScopeUserMessageId: pendingUserMessageId }
      : {}),
  });
  /** Scope copy lives in the widget (Yes/No + labels); avoid duplicating as a chat bubble. */
  return c.json({
    text: "",
    status: "needs_scope_confirmation",
    scopeConfirmTaskLabel: labels.taskTitle,
    scopeConfirmClassLabel: labels.courseLabel,
    route: meta?.route ?? null,
    ...(meta
      ? {
          entityKind: meta.entityKind,
          messageTag: meta.messageTag,
          tagConfidence: meta.tagConfidence,
        }
      : {}),
  });
}

/** Task chosen; we are still picking the matching class in the planned “both” flow. */
function finishingClassAfterTaskLock(session: ChatSessionSnapshot | null): boolean {
  return !!(
    session?.resolvedTaskId &&
    !session.resolvedCourseId &&
    session.awaitingEntityResolution === true &&
    session.activeEntityStep === "class"
  );
}

/** User message would start another task/class disambiguation while this session is already scoped. */
function shouldBlockEntityScopeChange(
  output: WorkflowRespondOutput,
  session: ChatSessionSnapshot | null,
): boolean {
  if (!session) return false;
  const hasT = !!session.resolvedTaskId;
  const hasC = !!session.resolvedCourseId;
  const fc = finishingClassAfterTaskLock(session);

  if (hasT && hasC) {
    if (output.status === "needs_entity_clarification" && output.entityKind !== "none") {
      return true;
    }
    if (output.messageTag === "task_feedback" || output.messageTag === "class_difficulty") {
      return true;
    }
  }

  if (hasT && !fc) {
    if (output.messageTag === "task_feedback") return true;
    if (output.status === "needs_entity_clarification") {
      if (
        output.entityKind === "task" ||
        output.entityKind === "both" ||
        output.entityKind === "class"
      ) {
        return true;
      }
    }
  }

  /**
   * Class locked but no task yet (e.g. user picked a course from “class is too hard”).
   * Never scope-block here: the user still needs to **attach a task** (MCQ). The supervisor
   * often mis-tags follow-ups like “my essay not going well” as `needs_entity` + `class`,
   * which previously showed “same task and class?” with only the class — wrong UX.
   * Switching to another course is handled when they explicitly pick a different class (MCQ).
   */
  if (!hasT && hasC) {
    return false;
  }

  return false;
}

function resolveEntitySearchKind(
  output: WorkflowRespondOutput,
  session: ChatSessionSnapshot | null,
): { kind: "task" | "class"; needsClassAfterTask: boolean } | null {
  const hasTask = !!session?.resolvedTaskId;
  const hasCourse = !!session?.resolvedCourseId;

  /** "Both" flow: task resolved, still need a class */
  const forcedClass =
    session?.activeEntityStep === "class" && !!session?.resolvedTaskId && !hasCourse;

  if (forcedClass) {
    return { kind: "class", needsClassAfterTask: false };
  }

  if (output.status === "needs_entity_clarification") {
    if (output.entityKind === "task") {
      if (hasTask) return null;
      return { kind: "task", needsClassAfterTask: false };
    }
    if (output.entityKind === "class") {
      if (hasCourse) return null;
      return { kind: "class", needsClassAfterTask: false };
    }
    if (output.entityKind === "both") {
      if (!hasTask) return { kind: "task", needsClassAfterTask: true };
      if (!hasCourse) return { kind: "class", needsClassAfterTask: false };
      return null;
    }
  }

  if (output.messageTag === "task_feedback" && !hasTask) {
    return { kind: "task", needsClassAfterTask: false };
  }
  if (output.messageTag === "class_difficulty" && !hasCourse) {
    return { kind: "class", needsClassAfterTask: false };
  }

  return null;
}

/** Executes the Convex mutation indicated by the task agent output. */
async function executeTaskAction(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    session: ChatSessionSnapshot | null;
    output: TaskAgentOutput;
  },
): Promise<Response> {
  const { userId, sessionId, session, output } = params;
  const { actionType } = output;
  let aiText = output.message;

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
        ...(session?.resolvedCourseId ? { courseId: session.resolvedCourseId } : {}),
        ...(output.classTag ? { classTag: output.classTag } : {}),
      });
    } else if (actionType === "update_task") {
      if (!session?.resolvedTaskId) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.patchTaskFieldsInternal, {
        userId,
        taskId: session.resolvedTaskId,
        ...(output.updatedTitle ? { title: output.updatedTitle } : {}),
        ...(output.updatedDescription ? { description: output.updatedDescription } : {}),
        ...(output.updatedTaskType ? { taskType: output.updatedTaskType } : {}),
        ...(output.updatedDueDateIso ? { dueDate: parseDueDateIso(output.updatedDueDateIso) } : {}),
        ...(session?.resolvedCourseId ? { courseId: session.resolvedCourseId } : {}),
        ...(output.updatedClassTag !== undefined && output.updatedClassTag !== null
          ? { classTag: output.updatedClassTag }
          : {}),
      });
    } else if (actionType === "delete_task") {
      if (!session?.resolvedTaskId) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.deleteTaskInternal, {
        userId,
        taskId: session.resolvedTaskId,
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
  },
): Promise<Response> {
  const { userId, sessionId, message, session, client } = params;

  // Load chat history for context (last 20 messages)
  const rawHistory = await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId,
    sessionId,
    limit: 20,
  });
  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  // Get resolved task details if any
  let resolvedTaskContext = "No task is resolved yet.";
  if (session?.resolvedTaskId) {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
      taskId: session.resolvedTaskId,
    });
    if (task) {
      resolvedTaskContext = [
        `Resolved task: "${task.title}" (type: ${task.taskType}, due: ${new Date(task.dueDate).toISOString().slice(0, 10)}${task.classTag ? `, class: ${task.classTag}` : ""})`,
        `Task ID: ${String(session.resolvedTaskId)}`,
      ].join("\n");
    }
  }

  // Get resolved course details if any
  let resolvedCourseContext = "No course is resolved yet.";
  if (session?.resolvedCourseId) {
    const courses = await ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
      courseIds: [session.resolvedCourseId],
    });
    if (courses.length > 0) {
      const c2 = courses[0];
      resolvedCourseContext = `Resolved course: "${c2.title}" (code: ${c2.courseCode})\nCourse ID: ${String(session.resolvedCourseId)}`;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  // When message is empty the user just picked an entity from the MCQ — no new text.
  const continueNote = message.trim()
    ? "Respond to the latest user message above."
    : "The user just selected an entity from the picker (no new text). Based on the conversation history and the now-resolved context, continue the conversation — e.g. proceed to the next missing field, confirm deletion, or summarise task details.";
  const contextPrompt =
    `Today is ${today}.\n\nConversation history (oldest first):\n${historyText}\n\n${resolvedTaskContext}\n${resolvedCourseContext}\n${continueNote}`;

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

  // Class clarification needed (create or update) → show course MCQ
  if (output.needsClassClarification && !session?.resolvedCourseId) {
    const queryText = message.trim() || output.classTag || output.updatedClassTag || "class course";
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      { userId, queryText: String(queryText), excludeIds: [] },
    );
    const introText =
      candidates.length === 0
        ? "I couldn't find any courses in your profile. Add courses from the Classes page, then try again."
        : "Which class is this for? Pick one below, or choose **Other** to see more options.";
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
        lastEntityQueryText: String(queryText),
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
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

  // RUD + no task resolved → show entity MCQ
  if (output.intent === "rud" && output.needsEntityClarification && !session?.resolvedTaskId) {
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
    return executeTaskAction(ctx, c, { userId, sessionId, session, output });
  }

  // Still gathering info — relay agent's conversational message
  const aiText = output.message;
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
  });
  return c.json({ text: aiText, status: "routed", route: "tasks", entityKind: "none", messageTag: "none", tagConfidence: 0 });
}

async function continueAfterSupervisorOutput(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    userMessageId: Id<"chatMessages">;
    output: WorkflowRespondOutput;
  },
): Promise<Response> {
  const { userId, sessionId, message, userMessageId, output } = params;

  await ctx.runMutation(internal.mutations.chatMessages.patchUserMessageClarificationIntent, {
    userId,
    messageId: userMessageId,
    clarificationIntent: output.messageTag,
  });

  const sessionForEntity = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
    userId,
    sessionId,
  });

  const blockedInit = shouldBlockEntityScopeChange(output, sessionForEntity);
  const hadBypass = sessionForEntity?.scopeBypassNextMessage === true;
  if (hadBypass) {
    await ctx.runMutation(internal.mutations.chatSessions.consumeScopeBypassInternal, {
      userId,
      sessionId,
    });
  }
  const effectiveScopeBlock = blockedInit && !hadBypass;

  if (effectiveScopeBlock) {
    return persistAndReturnScopeConfirmation(ctx, c, userId, sessionId, {
      route: output.route,
      entityKind: output.entityKind,
      messageTag: output.messageTag,
      tagConfidence: output.tagConfidence,
    }, userMessageId);
  }

  // Tasks route: always hand off to the task agent — it owns entity clarification for tasks
  if (output.route === "tasks") {
    await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
      userId,
      sessionId,
    });
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId,
      sessionId,
      activeAgent: "task",
    });
    const mastraUrl = process.env.MASTRA_URL;
    if (!mastraUrl) return c.json({ error: "MASTRA_URL not configured" }, 503);
    const taskClient = new MastraClient({ baseUrl: mastraUrl });
    return handleTaskAgentMessage(ctx, c, {
      userId,
      sessionId,
      message,
      session: { ...sessionForEntity, activeAgent: "task" as const },
      client: taskClient,
    });
  }

  const skipEntityMcq = sessionForEntity?.clarificationExhausted === true;
  const searchPlan = skipEntityMcq ? null : resolveEntitySearchKind(output, sessionForEntity);

  const stillInEntityMcq =
    sessionForEntity?.awaitingEntityResolution === true &&
    !sessionForEntity?.clarificationExhausted;

  /** Do not let vague follow-ups (“not sure”) wipe an active task/class picker. */
  if (output.status === "needs_domain_clarification" && output.clarifyingQuestion) {
    if (!stillInEntityMcq) {
      await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
        userId,
        sessionId,
      });
      const aiText = output.clarifyingQuestion;
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: aiText,
      });
      return c.json({
        text: aiText,
        status: "needs_domain_clarification",
        route: null,
        entityKind: output.entityKind,
        messageTag: output.messageTag,
        tagConfidence: output.tagConfidence,
      });
    }
    // fall through: re-show MCQ using stored query (see block after searchPlan)
  }

  if (searchPlan && !skipEntityMcq) {
    const queryText =
      stillInEntityMcq && sessionForEntity?.lastEntityQueryText
        ? sessionForEntity.lastEntityQueryText
        : message;
    if (searchPlan.kind === "task") {
      const { candidates, hasMore } = await ctx.runAction(
        internal.actions.entityResolution.searchTaskCandidates,
        {
          userId,
          queryText,
          excludeIds: [],
        },
      );
      const aiText =
        candidates.length === 0
          ? "I couldn’t match that to your tasks yet. Try naming the assignment, or add tasks in your dashboard."
          : ENTITY_INTRO_TASK;
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: aiText,
      });
      if (candidates.length === 0) {
        await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
          userId,
          sessionId,
        });
        return c.json({
          text: aiText,
          status: "routed",
          route: output.route,
          entityKind: output.entityKind,
          messageTag: output.messageTag,
          tagConfidence: output.tagConfidence,
        });
      }
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: queryText,
        activeEntityStep: "task",
        needsClassAfterTask: searchPlan.needsClassAfterTask,
        awaitingEntityResolution: true,
      });
      return c.json({
        text: aiText,
        status: "needs_entity_clarification",
        phase: "task",
        entityCandidates: candidates,
        entityHasMore: hasMore,
        route: output.route,
        entityKind: output.entityKind,
        messageTag: output.messageTag,
        tagConfidence: output.tagConfidence,
        needsClassAfterTask: searchPlan.needsClassAfterTask,
      });
    }

    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      {
        userId,
        queryText,
        excludeIds: [],
      },
    );
    const aiText =
      candidates.length === 0
        ? "I couldn’t match that to your courses yet. Try a course code, or add classes first."
        : ENTITY_INTRO_CLASS;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: aiText,
    });
    if (candidates.length === 0) {
      await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
        userId,
        sessionId,
      });
      return c.json({
        text: aiText,
        status: "routed",
        route: output.route,
        entityKind: output.entityKind,
        messageTag: output.messageTag,
        tagConfidence: output.tagConfidence,
      });
    }
    await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
      userId,
      sessionId,
      lastEntityQueryText: queryText,
      activeEntityStep: "class",
      needsClassAfterTask: false,
      awaitingEntityResolution: true,
    });
    return c.json({
      text: aiText,
      status: "needs_entity_clarification",
      phase: "class",
      entityCandidates: candidates,
      entityHasMore: hasMore,
      route: output.route,
      entityKind: output.entityKind,
      messageTag: output.messageTag,
      tagConfidence: output.tagConfidence,
    });
  }

  /** Vague reply while MCQ visible: supervisor may return domain or canned route — keep picker. */
  if (stillInEntityMcq && !skipEntityMcq && searchPlan === null && sessionForEntity) {
    const step = sessionForEntity.activeEntityStep ?? "task";
    const qText = sessionForEntity.lastEntityQueryText?.trim() || message;
    if (step === "task") {
      const { candidates, hasMore } = await ctx.runAction(
        internal.actions.entityResolution.searchTaskCandidates,
        {
          userId,
          queryText: qText,
          excludeIds: [],
        },
      );
      const aiText =
        candidates.length === 0
          ? "I couldn’t match that to your tasks yet. Try naming the assignment, or add tasks in your dashboard."
          : ENTITY_NUDGE_TASK;
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: aiText,
      });
      if (candidates.length === 0) {
        await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
          userId,
          sessionId,
        });
        return c.json({
          text: aiText,
          status: "routed",
          route: output.route,
          entityKind: output.entityKind,
          messageTag: output.messageTag,
          tagConfidence: output.tagConfidence,
        });
      }
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: qText,
        activeEntityStep: "task",
        needsClassAfterTask: sessionForEntity.needsClassAfterTask ?? false,
        awaitingEntityResolution: true,
      });
      return c.json({
        text: aiText,
        status: "needs_entity_clarification",
        phase: "task",
        entityCandidates: candidates,
        entityHasMore: hasMore,
        route: output.route,
        entityKind: output.entityKind,
        messageTag: output.messageTag,
        tagConfidence: output.tagConfidence,
        needsClassAfterTask: sessionForEntity.needsClassAfterTask ?? false,
      });
    }

    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      {
        userId,
        queryText: qText,
        excludeIds: [],
      },
    );
    const aiText =
      candidates.length === 0
        ? "I couldn’t match that to your courses yet. Try a course code, or add classes first."
        : ENTITY_NUDGE_CLASS;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: aiText,
    });
    if (candidates.length === 0) {
      await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
        userId,
        sessionId,
      });
      return c.json({
        text: aiText,
        status: "routed",
        route: output.route,
        entityKind: output.entityKind,
        messageTag: output.messageTag,
        tagConfidence: output.tagConfidence,
      });
    }
    await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
      userId,
      sessionId,
      lastEntityQueryText: qText,
      activeEntityStep: "class",
      needsClassAfterTask: false,
      awaitingEntityResolution: true,
    });
    return c.json({
      text: aiText,
      status: "needs_entity_clarification",
      phase: "class",
      entityCandidates: candidates,
      entityHasMore: hasMore,
      route: output.route,
      entityKind: output.entityKind,
      messageTag: output.messageTag,
      tagConfidence: output.tagConfidence,
    });
  }

  if (output.cannedResponse) {
    await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
      userId,
      sessionId,
    });
    const aiText = output.cannedResponse;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: aiText,
    });
    return c.json({
      text: aiText,
      status: "routed",
      route: output.route,
      entityKind: output.entityKind,
      messageTag: output.messageTag,
      tagConfidence: output.tagConfidence,
    });
  }

  await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
    userId,
    sessionId,
  });

  const route = output.route ?? null;
  const routeLabel = route
    ? `Here’s the gist for **${route}** — use the matching area in the app for details.`
    : "I’m not sure which area that fits yet — try one more detail (tasks, schedule, classes, preferences, or feedback).";
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: routeLabel,
  });
  return c.json({
    text: routeLabel,
    status: "routed",
    route,
    entityKind: output.entityKind,
    messageTag: output.messageTag,
    tagConfidence: output.tagConfidence,
  });
}

chatApp.post("/api/chat", async (c) => {
  const { ctx, userId } = c.env;

  const body = await c.req.json<{
    message?: string;
    sessionId?: string;
    entity?: {
      action:
        | "pick_task"
        | "pick_course"
        | "other_tasks"
        | "other_courses"
        | "scope_confirm_yes"
        | "scope_confirm_no"
        | "menu_pick";
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
  if (body.entity?.action === "scope_confirm_yes") {
    if (session?.awaitingScopeConfirm !== true) {
      return c.json({ error: "No pending scope confirmation" }, 400);
    }
    const pendingId = session.pendingScopeUserMessageId;
    const replay =
      pendingId !== undefined
        ? await ctx.runQuery(internal.queries.chatMessages.getUserMessageForScopeReplayInternal, {
            userId,
            sessionId,
            messageId: pendingId,
          })
        : null;

    await ctx.runMutation(internal.mutations.chatSessions.resolveScopeConfirmYesInternal, {
      userId,
      sessionId,
    });

    if (replay && pendingId !== undefined) {
      const workflow = client.getWorkflow("supervisor-workflow");
      const run = await workflow.startAsync({ inputData: { query: replay.content } });

      for (const step of Object.values(run.steps ?? {})) {
        if (!("output" in step)) {
          const errMsg = (step as { error?: string }).error ?? "";
          if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
            return c.json({ error: "quota_exceeded" }, 429);
          }
        }
      }

      const respondStep = run.steps?.["respond"];
      const output = (respondStep && "output" in respondStep ? respondStep.output : null) as
        | WorkflowRespondOutput
        | null;

      if (!output) {
        return c.json({ error: "supervisor_unavailable" }, 502);
      }

      return continueAfterSupervisorOutput(ctx, c, {
        userId,
        sessionId,
        message: replay.content,
        userMessageId: pendingId,
        output,
      });
    }

    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: SCOPE_YES_ACK_MSG,
    });
    return c.json({
      text: SCOPE_YES_ACK_MSG,
      status: "scope_confirm_yes",
      route: null,
    });
  }

  if (body.entity?.action === "scope_confirm_no") {
    if (session?.awaitingScopeConfirm !== true) {
      return c.json({ error: "No pending scope confirmation" }, 400);
    }
    await ctx.runMutation(internal.mutations.chatSessions.resolveScopeConfirmNoInternal, {
      userId,
      sessionId,
    });
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: SCOPE_DENY_FINAL_MSG,
    });
    return c.json({
      text: SCOPE_DENY_FINAL_MSG,
      status: "chat_input_locked",
      route: null,
    });
  }

  if (body.entity?.action === "pick_task" && body.entity.taskId) {
    if (session?.resolvedTaskId) {
      return persistAndReturnScopeConfirmation(ctx, c, userId, sessionId);
    }
    const taskId = body.entity.taskId as Id<"tasks">;
    const { needsClassNext } = await ctx.runMutation(
      internal.mutations.chatSessions.resolvePickedTaskInternal,
      { userId, sessionId, taskId },
    );
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
    // Task agent is active — auto-continue the conversation so the agent can act
    // on the original intent (delete / update / read) without the user needing to type again.
    const sessionAfterPick = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
      userId,
      sessionId,
    });
    if (sessionAfterPick?.activeAgent === "task") {
      return handleTaskAgentMessage(ctx, c, {
        userId,
        sessionId,
        message: "",          // empty = MCQ auto-continue, not a new user message
        session: sessionAfterPick,
        client,
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
    const fin = finishingClassAfterTaskLock(session);
    const isTaskAgentActive = session?.activeAgent === "task";

    if (session?.resolvedCourseId) {
      return persistAndReturnScopeConfirmation(ctx, c, userId, sessionId);
    }
    // Guard: task resolved + no course + not in "both" flow + not task agent class clarification
    if (session?.resolvedTaskId && !session.resolvedCourseId && !fin && !isTaskAgentActive) {
      return persistAndReturnScopeConfirmation(ctx, c, userId, sessionId);
    }
    const courseId = body.entity.courseId as Id<"userCourses">;
    await ctx.runMutation(internal.mutations.chatSessions.resolvePickedCourseInternal, {
      userId,
      sessionId,
      courseId,
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

    const hadTaskAlready = !!sessionAfterCourse?.resolvedTaskId;
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

    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
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
      return handleTaskAgentMessage(ctx, c, {
        userId,
        sessionId,
        message: userLabel,
        session,
        client,
      });
    }

    // Feedback: entity MCQ for task (feedback always needs a specific task)
    if (route === "feedback") {
      const queryText = "task feedback estimate effort";
      const { candidates, hasMore } = await ctx.runAction(
        internal.actions.entityResolution.searchTaskCandidates,
        { userId, queryText, excludeIds: [] },
      );
      const aiText =
        candidates.length === 0
          ? "I don't see any tasks yet. Add tasks from your dashboard first, then ask again."
          : TASK_FEEDBACK_INTRO;
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: aiText,
      });
      if (candidates.length === 0) {
        return c.json({ text: aiText, status: "routed", route, entityKind: "none", messageTag: "none", tagConfidence: 0 });
      }
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: queryText,
        activeEntityStep: "task",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
      });
      return c.json({
        text: aiText,
        status: "needs_entity_clarification",
        phase: "task",
        entityCandidates: candidates,
        entityHasMore: hasMore,
        route,
        entityKind: "task",
        messageTag: "task_feedback",
        tagConfidence: 1,
        needsClassAfterTask: false,
      });
    }

    // Classes: entity MCQ for class
    if (route === "classes") {
      const queryText = "course class subject";
      const { candidates, hasMore } = await ctx.runAction(
        internal.actions.entityResolution.searchCourseCandidates,
        { userId, queryText, excludeIds: [] },
      );
      const aiText =
        candidates.length === 0
          ? "I don't see any classes yet. Add courses from the Classes page first, then ask again."
          : CLASS_MENU_INTRO;
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: aiText,
      });
      if (candidates.length === 0) {
        return c.json({ text: aiText, status: "routed", route, entityKind: "none", messageTag: "none", tagConfidence: 0 });
      }
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: queryText,
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
      });
      return c.json({
        text: aiText,
        status: "needs_entity_clarification",
        phase: "class",
        entityCandidates: candidates,
        entityHasMore: hasMore,
        route,
        entityKind: "class",
        messageTag: "none",
        tagConfidence: 1,
      });
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
  if (sessionBeforeUserMsg?.awaitingScopeConfirm === true) {
    return c.json({
      text: SCOPE_USE_BUTTONS_MSG,
      status: "awaiting_scope_reply",
      route: null,
    });
  }

  const userMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "user",
    content: message,
  });

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

  // ── Task agent mode — bypass supervisor ────────────────────────────────────
  if (sessionNow?.activeAgent === "task") {
    return handleTaskAgentMessage(ctx, c, {
      userId,
      sessionId,
      message,
      session: sessionNow,
      client,
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

  const respondStep = run.steps?.["respond"];
  const output = (respondStep && "output" in respondStep ? respondStep.output : null) as
    | WorkflowRespondOutput
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
