import { Hono } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
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
};

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

const ENTITY_SCOPE_LOCK_MSG =
  "This chat is already linked to a specific task and/or class. " +
  "To ask about a **different** assignment or course, close this chat and start a **new** one (tap × on the widget, then open Maxx again for a fresh session).";

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

  if (!hasT && hasC) {
    if (output.messageTag === "class_difficulty" || output.messageTag === "task_feedback") {
      return true;
    }
    if (
      output.status === "needs_entity_clarification" &&
      (output.entityKind === "class" ||
        output.entityKind === "task" ||
        output.entityKind === "both")
    ) {
      return true;
    }
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

chatApp.post("/api/chat", async (c) => {
  const { ctx, userId } = c.env;

  const body = await c.req.json<{
    message?: string;
    sessionId?: string;
    entity?: {
      action: "pick_task" | "pick_course" | "other_tasks" | "other_courses";
      taskId?: string;
      courseId?: string;
      excludeTaskIds?: string[];
      excludeCourseIds?: string[];
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
    if (session?.resolvedTaskId) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: ENTITY_SCOPE_LOCK_MSG,
      });
      return c.json({
        text: ENTITY_SCOPE_LOCK_MSG,
        status: "entity_scope_locked",
        route: null,
      });
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
    return c.json({
      text: intro,
      status: "entity_resolved",
      phase: "task",
      route: null,
    });
  }

  if (body.entity?.action === "pick_course" && body.entity.courseId) {
    const fin = finishingClassAfterTaskLock(session);
    if (session?.resolvedCourseId) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: ENTITY_SCOPE_LOCK_MSG,
      });
      return c.json({
        text: ENTITY_SCOPE_LOCK_MSG,
        status: "entity_scope_locked",
        route: null,
      });
    }
    if (session?.resolvedTaskId && !session.resolvedCourseId && !fin) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: ENTITY_SCOPE_LOCK_MSG,
      });
      return c.json({
        text: ENTITY_SCOPE_LOCK_MSG,
        status: "entity_scope_locked",
        route: null,
      });
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
    const hadTaskAlready = !!sessionAfterCourse?.resolvedTaskId;
    const text = hadTaskAlready
      ? "Thanks — I’ve got the task and the class you picked."
      : "Thanks — I’ve got the class.";
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

  // ── Normal chat message ─────────────────────────────────────────────────────
  const message = body.message?.trim();
  if (!message) {
    return c.json({ error: "Bad Request" }, 400);
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

  await ctx.runMutation(internal.mutations.chatMessages.patchUserMessageClarificationIntent, {
    userId,
    messageId: userMessageId,
    clarificationIntent: output.messageTag,
  });

  const sessionForEntity = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
    userId,
    sessionId,
  });

  if (shouldBlockEntityScopeChange(output, sessionForEntity)) {
    await ctx.runMutation(internal.mutations.chatSessions.clearEntityAwaitingInternal, {
      userId,
      sessionId,
    });
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: ENTITY_SCOPE_LOCK_MSG,
    });
    return c.json({
      text: ENTITY_SCOPE_LOCK_MSG,
      status: "entity_scope_locked",
      route: output.route,
      entityKind: output.entityKind,
      messageTag: output.messageTag,
      tagConfidence: output.tagConfidence,
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
});

export default chatApp;
