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
  type TaggedMessageView,
  walkLatestTaggedCourseId,
  walkLatestTaggedTaskId,
} from "./lib/messageTaggedScope";

/** Mirrors the output schema of chatWorkflow in mastra/src/mastra/workflows/chatWorkflow.ts */
type ChatWorkflowOutput = {
  reply: string;
  route: string | null;
  status: "reply" | "domain_clarify" | "needs_task_mcq" | "needs_class_mcq" | "task_action" | "canned";
  mcqQueryText: string | null;
  needsClassAfterTask: boolean;
  actionType: "create_task" | "update_task" | "delete_task" | "read_task" | "none" | null;
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
  newActiveAgent: "task" | "feedback" | "preferences" | null;
  clearActiveAgent: boolean;
  newTaskAgentIntent: "create" | "rud" | null;
  readyToRecord: boolean;
};

const chatApp = new Hono<HonoEnv>();

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
const MENU_USER_LABELS: Record<string, string> = {
  tasks: "Help with tasks",
  classes: "Class questions",
  feedback: "Give feedback on a task",
  schedule: "Schedule something",
  preferences: "Change my preferences",
};

function parseDueDateIso(iso: string): number {
  if (!iso) return Date.now() + 86_400_000;
  const hasTime = iso.includes("T") && iso.length > 10;
  const normalized = hasTime ? iso : `${iso}T23:59:59`;
  const ms = new Date(normalized).getTime();
  return isNaN(ms) ? Date.now() + 86_400_000 : ms;
}

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
    const courses = await ctx.runQuery(
      internal.queries.userCourses.getUserCoursesByIdsInternal,
      { courseIds: [cid as Id<"userCourses">] },
    );
    const c2 = courses[0];
    if (c2 && c2.userId === userId) {
      lines.push(`- Course "${c2.title}" (${c2.courseCode}) → courseId ${String(cid)}`);
    }
  }

  const primaryTask = walkLatestTaggedTaskId(historyAsc);
  const primaryCourse = walkLatestTaggedCourseId(historyAsc);
  lines.push(
    `Most recent tag (newest first): ${primaryTask ? `taskId=${String(primaryTask)}` : "no task tag"}, ${primaryCourse ? `courseId=${String(primaryCourse)}` : "no course tag"}.`,
  );
  lines.push(
    "Use these IDs for update/delete/read and for class on create when they match the user's latest request.",
  );
  return lines.join("\n");
}

async function runChatWorkflow(
  client: InstanceType<typeof MastraClient>,
  inputData: {
    message: string;
    historyText: string;
    taggedEntitiesBlock: string;
    hasCourseTag: boolean;
    taggedTaskId: string | null;
    today: string;
    activeAgent: "task" | "feedback" | "preferences" | null;
    taskAgentIntent: "create" | "rud" | null;
  },
): Promise<ChatWorkflowOutput | "quota_exceeded" | null> {
  const wf = client.getWorkflow("chat-workflow");
  const run = await wf.startAsync({ inputData });

  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
        return "quota_exceeded";
      }
    }
  }

  const chatStep = run.steps?.["chat"];
  return (chatStep && "output" in chatStep ? chatStep.output : null) as ChatWorkflowOutput | null;
}

async function executeTaskAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    historyAsc: readonly TaggedMessageView[];
    output: ChatWorkflowOutput;
  },
): Promise<string> {
  const { userId, sessionId, historyAsc, output } = params;
  const taggedTaskId = walkLatestTaggedTaskId(historyAsc);
  const taggedCourseId = walkLatestTaggedCourseId(historyAsc);
  let aiText = output.reply;

  try {
    if (output.actionType === "create_task") {
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
    } else if (output.actionType === "update_task") {
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
    } else if (output.actionType === "delete_task") {
      if (taggedTaskId === undefined) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.deleteTaskInternal, {
        userId,
        taskId: taggedTaskId,
      });
    }
    // "read_task": no mutation needed
  } catch (err) {
    aiText = `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`;
  }

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
  return aiText;
}

async function applySessionStateChanges(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  output: ChatWorkflowOutput,
) {
  if (output.clearActiveAgent) {
    await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
      userId,
      sessionId,
    });
  } else if (output.newActiveAgent || output.newTaskAgentIntent) {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId,
      sessionId,
      ...(output.newActiveAgent ? { activeAgent: output.newActiveAgent } : {}),
      ...(output.newTaskAgentIntent ? { taskAgentIntent: output.newTaskAgentIntent } : {}),
    });
  }
}

/** Build context, call chatWorkflow, execute output. */
async function handleWorkflowTurn(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  client: InstanceType<typeof MastraClient>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    session: { activeAgent?: string; taskAgentIntent?: string } | null;
    triggerUserMessageId?: Id<"chatMessages">;
  },
): Promise<Response> {
  const { userId, sessionId, message, session, triggerUserMessageId } = params;

  const rawHistory = (await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
    userId,
    sessionId,
    limit: 20,
  })) as TaggedMessageView[];

  const historyText = rawHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const taggedEntitiesBlock = await buildTaggedEntitiesContextBlock(ctx, userId, rawHistory);
  const hasCourseTag = await threadHasTaggedCourse(ctx, userId, rawHistory);

  // Pass null when shouldOfferTaskEntityMcq says we should show the picker
  // (meaning: the current user turn has no task tag yet)
  const rawTaggedTaskId = walkLatestTaggedTaskId(rawHistory);
  const taggedTaskId = shouldOfferTaskEntityMcq(true, rawHistory, message)
    ? null
    : rawTaggedTaskId !== undefined
      ? String(rawTaggedTaskId)
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const activeAgent = (session?.activeAgent as "task" | "feedback" | "preferences" | null) ?? null;
  const taskAgentIntent = (session?.taskAgentIntent as "create" | "rud" | null) ?? null;

  const result = await runChatWorkflow(client, {
    message,
    historyText,
    taggedEntitiesBlock,
    hasCourseTag,
    taggedTaskId,
    today,
    activeAgent,
    taskAgentIntent,
  });

  if (result === "quota_exceeded") return c.json({ error: "quota_exceeded" }, 429);
  if (!result) return c.json({ error: "chat_workflow_unavailable" }, 502);

  const output = result;
  const mcqTriggerId = triggerUserMessageId ?? getLastUserMessage(rawHistory)?._id;

  if (output.status === "task_action") {
    const aiText = await executeTaskAction(ctx, { userId, sessionId, historyAsc: rawHistory, output });
    return c.json({
      text: aiText,
      status: "routed",
      route: "tasks",
      entityKind: "none",
      messageTag: "none",
      tagConfidence: 0,
    });
  }

  if (output.status === "needs_task_mcq") {
    const queryText = output.mcqQueryText ?? (message.trim() || "task assignment");
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText, excludeIds: [] },
    );
    const introText =
      candidates.length === 0
        ? "I couldn't find matching tasks. Try naming the assignment, or add tasks from the dashboard."
        : output.reply;
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
        lastEntityQueryText: queryText,
        activeEntityStep: "task",
        needsClassAfterTask: output.needsClassAfterTask,
        awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    await applySessionStateChanges(ctx, userId, sessionId, output);
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "task",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: output.route,
      entityKind: "task",
      messageTag: "none",
      tagConfidence: 0,
    });
  }

  if (output.status === "needs_class_mcq") {
    const queryText = output.mcqQueryText ?? (message.trim() || "class course");
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      { userId, queryText, excludeIds: [] },
    );
    const taskForIntro = walkLatestTaggedTaskId(rawHistory);
    const introText =
      candidates.length === 0
        ? "I couldn't find any courses in your profile. Add courses from the Classes page, then try again."
        : output.reply;
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
        lastEntityQueryText: queryText,
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    await applySessionStateChanges(ctx, userId, sessionId, output);
    return c.json({
      text: introText,
      status: candidates.length > 0 ? "needs_entity_clarification" : "routed",
      phase: "class",
      ...(candidates.length > 0 ? { entityCandidates: candidates, entityHasMore: hasMore } : {}),
      route: output.route,
      entityKind: "class",
      messageTag: "none",
      tagConfidence: 0,
      needsClassAfterTask: false,
    });
  }

  // reply / domain_clarify / canned
  const tagTask = walkLatestTaggedTaskId(rawHistory);
  const tagCourse = walkLatestTaggedCourseId(rawHistory);
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: output.reply,
    ...(tagTask !== undefined ? { taskId: tagTask } : {}),
    ...(tagCourse !== undefined ? { courseId: tagCourse } : {}),
  });
  await applySessionStateChanges(ctx, userId, sessionId, output);
  return c.json({
    text: output.reply,
    status: output.status === "domain_clarify" ? "needs_domain_clarification" : "routed",
    route: output.route ?? null,
    entityKind: "none",
    messageTag: "none",
    tagConfidence: 0,
  });
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

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
  if (!sessionId) return c.json({ error: "Bad Request" }, 400);

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

  // ── Entity UI actions ──────────────────────────────────────────────────────

  if (body.entity?.action === "pick_task" && body.entity.taskId) {
    const taskId = body.entity.taskId as Id<"tasks">;
    const { needsClassNext } = await ctx.runMutation(
      internal.mutations.chatSessions.resolvePickedTaskInternal,
      { userId, sessionId, taskId },
    );
    await ctx.runMutation(
      internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal,
      { userId, sessionId, taskId, clearTriggerPointer: !needsClassNext },
    );
    const intro = needsClassNext ? ENTITY_INTRO_CLASS : "Got it — I'll use that task.";
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
        { userId, queryText: qText, excludeIds: [] },
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

    const sessionAfterPick = await ctx.runQuery(
      internal.queries.chatSessions.getChatSessionInternal,
      { userId, sessionId },
    );
    if (sessionAfterPick?.activeAgent) {
      return handleWorkflowTurn(ctx, c, client, {
        userId,
        sessionId,
        message: "",
        session: sessionAfterPick,
      });
    }
    return c.json({ text: intro, status: "entity_resolved", phase: "task", route: null });
  }

  if (body.entity?.action === "pick_course" && body.entity.courseId) {
    const isTaskAgentActive = session?.activeAgent === "task";
    const courseId = body.entity.courseId as Id<"userCourses">;

    await ctx.runMutation(internal.mutations.chatSessions.resolvePickedCourseInternal, {
      userId,
      sessionId,
      courseId,
    });
    await ctx.runMutation(
      internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal,
      { userId, sessionId, courseId, clearTriggerPointer: true },
    );

    if (isTaskAgentActive) {
      const sessionAfterCourse = await ctx.runQuery(
        internal.queries.chatSessions.getChatSessionInternal,
        { userId, sessionId },
      );
      return handleWorkflowTurn(ctx, c, client, {
        userId,
        sessionId,
        message: "",
        session: sessionAfterCourse,
      });
    }

    const recent = (await ctx.runQuery(internal.queries.chatMessages.getChatHistoryInternal, {
      userId,
      sessionId,
      limit: 15,
    })) as TaggedMessageView[];
    const hadTask = walkLatestTaggedTaskId(recent) !== undefined;
    const labels = await ctx.runQuery(
      internal.queries.chatSessions.getResolvedEntityLabelsInternal,
      { userId, sessionId },
    );
    let text: string;
    if (hadTask) {
      const tp = labels.taskTitle ? `**${labels.taskTitle}**` : "the task";
      const cp = labels.courseLabel ? `**${labels.courseLabel}**` : "the class";
      text = `Thanks — I've got ${tp} and ${cp}.`;
    } else {
      text = labels.courseLabel
        ? `Thanks — I've got **${labels.courseLabel}**.`
        : "Thanks — I've got the class.";
    }
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: text,
    });
    return c.json({ text, status: "entity_resolved", phase: "class", route: null });
  }

  if (body.entity?.action === "other_tasks") {
    const qText = session?.lastEntityQueryText ?? "";
    if (!qText) return c.json({ error: "Missing entity query context" }, 400);
    const exclude = (body.entity.excludeTaskIds ?? []) as Id<"tasks">[];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText: qText, excludeIds: exclude },
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
    if (!qText) return c.json({ error: "Missing entity query context" }, 400);
    const exclude = (body.entity.excludeCourseIds ?? []) as Id<"userCourses">[];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchCourseCandidates,
      { userId, queryText: qText, excludeIds: exclude },
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

  // ── Menu pick ──────────────────────────────────────────────────────────────
  if (body.entity?.action === "menu_pick" && body.entity.route) {
    const route = body.entity.route;
    const userLabel = MENU_USER_LABELS[route] ?? route;
    const menuUserMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "user",
      content: userLabel,
    });
    return handleWorkflowTurn(ctx, c, client, {
      userId,
      sessionId,
      message: userLabel,
      session,
      triggerUserMessageId: menuUserMessageId,
    });
  }

  // ── Normal message ─────────────────────────────────────────────────────────
  const message = body.message?.trim();
  if (!message) return c.json({ error: "Bad Request" }, 400);

  const sessionBeforeMsg = await ctx.runQuery(
    internal.queries.chatSessions.getChatSessionInternal,
    { userId, sessionId },
  );
  if (sessionBeforeMsg?.chatInputLocked === true) {
    return c.json({ text: CHAT_INPUT_LOCKED_REPLY_MSG, status: "chat_input_locked", route: null });
  }

  const userMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "user",
    content: message,
  });

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
      return c.json({ text: EXHAUSTED_MSG, status: "clarification_exhausted", route: null });
    }
  }

  return handleWorkflowTurn(ctx, c, client, {
    userId,
    sessionId,
    message,
    session: sessionNow,
    triggerUserMessageId: userMessageId,
  });
});

export default chatApp;
