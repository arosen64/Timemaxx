import type { Context } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { HonoEnv } from "./httpTypes";
import { walkLatestTaggedTaskId, type TaggedMessageView } from "./messageTaggedScope";

const ENTITY_INTRO_TASK =
  "Which task do you mean? Pick one below, or choose **Other** to see more options.";
const ENTITY_INTRO_CLASS =
  "Which class do you mean? Pick one below, or choose **Other** to see more options.";

type HandleWorkflowTurn = (
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  client: InstanceType<typeof MastraClient>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    message: string;
    session: { activeAgent?: string; taskAgentIntent?: string } | null;
    triggerUserMessageId?: Id<"chatMessages">;
  }
) => Promise<Response>;

export async function handleEntityAction(
  ctx: ActionCtx,
  c: Context<HonoEnv>,
  client: InstanceType<typeof MastraClient>,
  params: {
    userId: Id<"users">;
    sessionId: string;
    session: {
      activeAgent?: string;
      taskAgentIntent?: string;
      lastEntityQueryText?: string;
    } | null;
    entity: {
      action: "pick_task" | "pick_course" | "other_tasks" | "other_courses";
      taskId?: string;
      courseId?: string;
      excludeTaskIds?: string[];
      excludeCourseIds?: string[];
    };
  },
  handleWorkflowTurn: HandleWorkflowTurn
): Promise<Response> {
  const { userId, sessionId, session, entity } = params;

  if (entity.action === "pick_task" && entity.taskId) {
    const taskId = entity.taskId as Id<"tasks">;
    const { needsClassNext } = await ctx.runMutation(
      internal.mutations.chatSessions.resolvePickedTaskInternal,
      { userId, sessionId, taskId }
    );
    await ctx.runMutation(
      internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal,
      { userId, sessionId, taskId, clearTriggerPointer: !needsClassNext }
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
        { userId, queryText: qText, excludeIds: [] }
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
      { userId, sessionId }
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

  if (entity.action === "pick_course" && entity.courseId) {
    const courseId = entity.courseId as Id<"userCourses">;

    await ctx.runMutation(internal.mutations.chatSessions.resolvePickedCourseInternal, {
      userId,
      sessionId,
      courseId,
    });
    await ctx.runMutation(
      internal.mutations.chatMessages.applyResolvedEntityToClarifyTriggerMessageInternal,
      { userId, sessionId, courseId, clearTriggerPointer: true }
    );

    const sessionAfterCourse = await ctx.runQuery(
      internal.queries.chatSessions.getChatSessionInternal,
      { userId, sessionId }
    );
    if (sessionAfterCourse?.activeAgent) {
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
      { userId, sessionId }
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

  if (entity.action === "other_tasks") {
    const qText = session?.lastEntityQueryText ?? "";
    if (!qText) return c.json({ error: "Missing entity query context" }, 400);
    const exclude = (entity.excludeTaskIds ?? []) as Id<"tasks">[];
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText: qText, excludeIds: exclude }
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

  // other_courses
  const qText = session?.lastEntityQueryText ?? "";
  if (!qText) return c.json({ error: "Missing entity query context" }, 400);
  const exclude = (entity.excludeCourseIds ?? []) as Id<"userCourses">[];
  const { candidates, hasMore } = await ctx.runAction(
    internal.actions.entityResolution.searchCourseCandidates,
    { userId, queryText: qText, excludeIds: exclude }
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
