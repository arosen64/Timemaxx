import { Hono, type Context } from "hono";
import { MastraClient } from "@mastra/client-js";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { HonoEnv } from "./lib/httpTypes";
import { executeCourseAction } from "./lib/executeCourseAction";
import { executeScheduleAction } from "./lib/executeScheduleAction";
import type {
  ActiveAgent,
  ChatWorkflowOutput,
  CourseAgentIntent,
  SisResolvedPick,
  TaskAgentIntent,
} from "./lib/chatWorkflowHttpTypes";
import type { EntityCandidate } from "./lib/entityCandidates";
import {
  decodeSisCandidate,
  decodeSisContext,
  encodeSisCandidate,
  encodeSisContext,
  isSisCandidateEntityId,
} from "./lib/sisEntityTokens";

import {
  getLastUserMessage,
  shouldOfferCourseEntityMcq,
  shouldOfferTaskEntityMcq,
  type TaggedMessageView,
} from "./lib/messageTaggedScope";
import { threadHasTaggedCourse, buildTaggedEntitiesContextBlock } from "./lib/chatEntityContext";
import { handleEntityAction } from "./lib/chatEntityActions";

const chatApp = new Hono<HonoEnv>();

const CHAT_MESSAGE_LIMIT = 20;
const CHAT_LIMIT_MSG =
  "This chat has reached its message limit. Close the widget (×) and open Maxx again to start a fresh conversation.";
const EXHAUSTED_MSG =
  "I still can't tell which task or class you mean after a few tries. " +
  "Try naming a course code or assignment title, or open it from your list — then ask again.";
const CHAT_INPUT_LOCKED_REPLY_MSG =
  "This chat was closed for new topics. Close the widget (×), then open Maxx again to start a fresh session.";
const MENU_USER_LABELS: Record<string, string> = {
  tasks: "Help with tasks",
  classes: "Class questions",
  feedback: "Give feedback on a task",
  schedule: "Schedule something",
  preferences: "Change my preferences",
};

function formatTaskReadSummary(
  task: {
    title: string;
    description: string;
    taskType: string;
    dueDate: number;
    classTag?: string;
    timeEstimate?: number;
  },
  subtasks: Array<{ title: string; status?: string; timeEstimate?: number }>
): string {
  const due = new Date(task.dueDate).toLocaleString();
  const estimate =
    task.timeEstimate !== undefined
      ? `${Math.floor(task.timeEstimate / 60)}h ${task.timeEstimate % 60}m`
      : "AI estimate pending";
  const lines = [
    `Here are the details for **${task.title}**:`,
    `- **Type**: ${task.taskType}`,
    `- **Due**: ${due}`,
    `- **Class**: ${task.classTag ?? "Not set"}`,
    `- **Time estimate**: ${estimate}`,
    `- **Description**: ${task.description}`,
  ];

  if (subtasks.length > 0) {
    lines.push(`- **Subtasks** (${subtasks.length}):`);
    for (const [index, subtask] of subtasks.entries()) {
      const subEstimate =
        subtask.timeEstimate !== undefined
          ? `${Math.floor(subtask.timeEstimate / 60)}h ${subtask.timeEstimate % 60}m`
          : "estimate pending";
      lines.push(
        `  ${index + 1}. ${subtask.title} (${subtask.status ?? "not_started"}, ${subEstimate})`
      );
    }
  } else {
    lines.push("- **Subtasks**: none");
  }

  return lines.join("\n");
}

function getTimeZoneOffsetMs(timeZone: string, atMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(atMs));
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - atMs;
}

function parseAsUserLocalDateTimeMs(input: string, timeZone: string): number {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4] ?? "0");
  const minute = Number(m[5] ?? "0");
  const second = Number(m[6] ?? "0");

  // Iteratively solve "wall clock in timeZone" -> UTC instant, including DST.
  const targetUtcWall = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtcWall;
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(timeZone, guess);
    guess = targetUtcWall - offset;
  }
  return guess;
}

function parseDueDateIso(iso: string, timezone: string): number {
  if (!iso) return Date.now() + 86_400_000;
  const hasTime = iso.includes("T") && iso.length > 10;
  const normalized = hasTime ? iso : `${iso}T23:59:59`;
  const hasExplicitTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized);
  const ms = hasExplicitTz
    ? new Date(normalized).getTime()
    : parseAsUserLocalDateTimeMs(normalized, timezone);
  return isNaN(ms) ? Date.now() + 86_400_000 : ms;
}

async function runChatWorkflow(
  client: InstanceType<typeof MastraClient>,
  inputData: {
    message: string;
    historyText: string;
    taggedEntitiesBlock: string;
    hasCourseTag: boolean;
    taggedTaskId: string | null;
    taggedCourseId: string | null;
    today: string;
    activeAgent: "task" | "feedback" | "preferences" | "classes" | "schedule" | null;
    taskAgentIntent: "create" | "rud" | null;
    courseAgentIntent: "add" | "drop" | "view" | "update" | null;
  }
): Promise<ChatWorkflowOutput | "quota_exceeded" | null> {
  const wf = client.getWorkflow("chat-workflow");
  const run = await wf.startAsync({ inputData });

  for (const step of Object.values(run.steps ?? {})) {
    if (!("output" in step)) {
      const errMsg = (step as { error?: string }).error ?? "";
      if (
        errMsg.includes("quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        return "quota_exceeded";
      }
    }
  }

  // Only one branch step will have run — find whichever has output.
  const branchStepIds = [
    "task_handler",
    "feedback_handler",
    "course_handler",
    "schedule_handler",
    "canned_handler",
  ];
  for (const id of branchStepIds) {
    const step = run.steps?.[id];
    if (step && "output" in step) return step.output as ChatWorkflowOutput;
  }
  return null;
}

async function executeTaskAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    timezone: string;
    activeTaskId?: Id<"tasks">;
    activeCourseId?: Id<"userCourses">;
    output: ChatWorkflowOutput;
  }
): Promise<string> {
  const { userId, sessionId, timezone, activeTaskId, activeCourseId, output } = params;
  const taggedTaskId = activeTaskId;
  const taggedCourseId = activeCourseId;
  let aiText = output.reply;
  let clearedScopeAfterAction = false;
  const shouldGenerateSubtasks = output.generateSubtasks === true;

  try {
    if (output.actionType === "create_task") {
      if (!output.title || !output.dueDateIso || !output.taskType) {
        throw new Error("Missing required task fields.");
      }
      const createdTaskId = await ctx.runMutation(internal.mutations.tasks.createTaskInternal, {
        userId,
        title: output.title,
        description: output.description ?? output.title,
        taskType: output.taskType,
        dueDate: parseDueDateIso(output.dueDateIso, timezone),
        ...(taggedCourseId ? { courseId: taggedCourseId } : {}),
        ...(output.classTag ? { classTag: output.classTag } : {}),
      });
      if (shouldGenerateSubtasks) {
        const generated = await ctx.runAction(internal.actions.generateSubtasks.generateSubtasks, {
          taskId: createdTaskId,
        });
        if ("error" in generated) throw new Error(generated.error);
        await ctx.runMutation(internal.mutations.subtasks.createSubtasksFromGeneratedInternal, {
          userId,
          parentTaskId: createdTaskId,
          subtasks: generated.subtasks.map((s) => ({
            title: s.title,
            description: s.description,
            taskType: s.taskType,
            suggestedCompletionAt: new Date(s.suggestedCompletionAt).getTime(),
          })),
        });
      } else {
        await ctx.runAction(internal.ai.estimateTaskTime.estimateTaskTime, {
          taskId: createdTaskId,
        });
      }
    } else if (output.actionType === "update_task") {
      if (taggedTaskId === undefined) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.patchTaskFieldsInternal, {
        userId,
        taskId: taggedTaskId,
        ...(output.updatedTitle ? { title: output.updatedTitle } : {}),
        ...(output.updatedDescription ? { description: output.updatedDescription } : {}),
        ...(output.updatedTaskType ? { taskType: output.updatedTaskType } : {}),
        ...(output.updatedDueDateIso
          ? { dueDate: parseDueDateIso(output.updatedDueDateIso, timezone) }
          : {}),
        ...(taggedCourseId ? { courseId: taggedCourseId } : {}),
        ...(output.updatedClassTag !== undefined && output.updatedClassTag !== null
          ? { classTag: output.updatedClassTag }
          : {}),
      });
      const subtaskCount = await ctx.runQuery(
        internal.queries.subtasks.countSubtasksForTaskInternal,
        {
          parentTaskId: taggedTaskId,
        }
      );
      if (subtaskCount === 0) {
        if (shouldGenerateSubtasks) {
          const generated = await ctx.runAction(
            internal.actions.generateSubtasks.generateSubtasks,
            {
              taskId: taggedTaskId,
            }
          );
          if ("error" in generated) throw new Error(generated.error);
          await ctx.runMutation(internal.mutations.subtasks.createSubtasksFromGeneratedInternal, {
            userId,
            parentTaskId: taggedTaskId,
            subtasks: generated.subtasks.map((s) => ({
              title: s.title,
              description: s.description,
              taskType: s.taskType,
              suggestedCompletionAt: new Date(s.suggestedCompletionAt).getTime(),
            })),
          });
        } else {
          await ctx.runAction(internal.ai.estimateTaskTime.estimateTaskTime, {
            taskId: taggedTaskId,
          });
        }
      }
      await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
        userId,
        sessionId,
        clear: true,
      });
      clearedScopeAfterAction = true;
    } else if (output.actionType === "delete_task") {
      if (taggedTaskId === undefined) throw new Error("No task selected.");
      await ctx.runMutation(internal.mutations.tasks.deleteTaskInternal, {
        userId,
        taskId: taggedTaskId,
      });
      await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
        userId,
        sessionId,
        clear: true,
      });
      clearedScopeAfterAction = true;
    } else if (output.actionType === "read_task") {
      if (taggedTaskId !== undefined) {
        const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
          taskId: taggedTaskId,
        });
        if (!task || task.userId !== userId) throw new Error("Task not found.");
        const subtasks = await ctx.runQuery(internal.queries.subtasks.getSubtasksForTaskInternal, {
          parentTaskId: taggedTaskId,
        });
        aiText = formatTaskReadSummary(task, subtasks);
      }
      if (taggedTaskId !== undefined || taggedCourseId !== undefined) {
        await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
          userId,
          sessionId,
          clear: true,
        });
        clearedScopeAfterAction = true;
      }
    }
  } catch (err) {
    aiText = `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "Please try again."}`;
  }

  await ctx.runMutation(internal.mutations.chatSessions.clearAgentStateInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
    ...(taggedTaskId !== undefined && !clearedScopeAfterAction ? { taskId: taggedTaskId } : {}),
    ...(taggedCourseId !== undefined && !clearedScopeAfterAction
      ? { courseId: taggedCourseId }
      : {}),
  });
  return aiText;
}

async function applySessionStateChanges(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  output: ChatWorkflowOutput,
  previousActiveAgent: ActiveAgent | null
) {
  const feedbackAgentDone =
    previousActiveAgent === "feedback" &&
    (output.readyToRecord || output.newActiveAgent !== "feedback");

  // Two independent steps so the supervisor's mid-flow intent-switch case can
  // clear the previous sub-agent's state AND install the new sub-agent's state
  // in the same turn. (For action-completion turns `newActiveAgent` is null so
  // the second step is a no-op, preserving existing behaviour.)
  if (output.clearActiveAgent || feedbackAgentDone) {
    await ctx.runMutation(internal.mutations.chatSessions.clearAgentStateInternal, {
      userId,
      sessionId,
    });
  }
  if (output.newActiveAgent || output.newTaskAgentIntent || output.newCourseAgentIntent) {
    await ctx.runMutation(internal.mutations.chatSessions.setTaskAgentStateInternal, {
      userId,
      sessionId,
      ...(output.newActiveAgent ? { activeAgent: output.newActiveAgent } : {}),
      ...(output.newTaskAgentIntent ? { taskAgentIntent: output.newTaskAgentIntent } : {}),
      ...(output.newCourseAgentIntent ? { courseAgentIntent: output.newCourseAgentIntent } : {}),
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
    timezone: string;
    session: {
      activeAgent?: string | null;
      taskAgentIntent?: string | null;
      courseAgentIntent?: string | null;
      activeTaskId?: Id<"tasks">;
      activeCourseId?: Id<"userCourses">;
      activeBlockId?: Id<"studyBlocks">;
      lastEntityQueryText?: string;
      resolvedSisPick?: SisResolvedPick;
    } | null;
    triggerUserMessageId?: Id<"chatMessages">;
  }
): Promise<Response> {
  const { userId, sessionId, message, timezone, session, triggerUserMessageId } = params;
  const sessionActiveTaskId = session?.activeTaskId;
  const sessionActiveCourseId = session?.activeCourseId;
  const sessionActiveBlockId = session?.activeBlockId;

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
  const rawTaggedTaskId = session?.activeTaskId;
  const taggedTaskId = shouldOfferTaskEntityMcq(true, rawHistory, message)
    ? null
    : rawTaggedTaskId !== undefined
      ? String(rawTaggedTaskId)
      : null;
  const rawTaggedCourseId = session?.activeCourseId;
  const taggedCourseId = shouldOfferCourseEntityMcq(true, rawHistory, message)
    ? null
    : rawTaggedCourseId !== undefined
      ? String(rawTaggedCourseId)
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const activeAgent: ActiveAgent = (session?.activeAgent as ActiveAgent) ?? null;
  const taskAgentIntent: TaskAgentIntent = (session?.taskAgentIntent as TaskAgentIntent) ?? null;
  const courseAgentIntent: CourseAgentIntent =
    (session?.courseAgentIntent as CourseAgentIntent) ?? null;

  const result = await runChatWorkflow(client, {
    message,
    historyText,
    taggedEntitiesBlock,
    hasCourseTag,
    taggedTaskId,
    taggedCourseId,
    today,
    activeAgent,
    taskAgentIntent,
    courseAgentIntent,
  });

  if (result === "quota_exceeded") return c.json({ error: "quota_exceeded" }, 429);
  if (!result) return c.json({ error: "chat_workflow_unavailable" }, 502);

  const output = result;
  const mcqTriggerId = triggerUserMessageId ?? getLastUserMessage(rawHistory)?._id;

  if (output.status === "task_action") {
    const aiText = await executeTaskAction(ctx, {
      userId,
      sessionId,
      timezone,
      activeTaskId: sessionActiveTaskId,
      activeCourseId: sessionActiveCourseId,
      output,
    });
    return c.json({
      text: aiText,
      status: "routed",
      route: "tasks",
      entityKind: "none",
      messageTag: "none",
      tagConfidence: 0,
    });
  }

  if (output.status === "course_action") {
    const aiText = await executeCourseAction(ctx, {
      userId,
      sessionId,
      activeCourseId: sessionActiveCourseId,
      output,
      resolvedSisPick: session?.resolvedSisPick,
    });
    return c.json({
      text: aiText,
      status: "routed",
      route: "classes",
      entityKind: "none",
      messageTag: "none",
      tagConfidence: 0,
    });
  }

  if (output.status === "schedule_action") {
    const scheduleResult = await executeScheduleAction(ctx, {
      userId,
      sessionId,
      activeTaskId: sessionActiveTaskId,
      activeBlockId: sessionActiveBlockId,
      timezone,
      output,
    });
    if ("needsBlockMcq" in scheduleResult) {
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: scheduleResult.aiText,
      });
      await ctx.runMutation(internal.mutations.chatSessions.setBlockPromptStateInternal, {
        userId,
        sessionId,
        pendingScheduleAction: "schedule_block",
      });
      return c.json({
        text: scheduleResult.aiText,
        status: "needs_entity_clarification",
        phase: "block",
        entityCandidates: scheduleResult.blockCandidates,
        entityHasMore: false,
        route: "schedule",
        entityKind: "block",
        messageTag: "none",
        tagConfidence: 0,
      });
    }
    return c.json({
      text: scheduleResult.aiText,
      status: "routed",
      route: "schedule",
      entityKind: "none",
      messageTag: "none",
      tagConfidence: 0,
    });
  }

  if (output.status === "needs_task_mcq") {
    const queryText = output.mcqQueryText ?? (message.trim() || "task assignment");
    const { candidates, hasMore } = await ctx.runAction(
      internal.actions.entityResolution.searchTaskCandidates,
      { userId, queryText, excludeIds: [] }
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
    // Apply agent-state changes (which may clear prior session state on intent
    // switch) BEFORE setting the entity-prompt state, so the new MCQ state
    // isn't wiped out by the clear.
    await applySessionStateChanges(ctx, userId, sessionId, output, activeAgent);
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
    const sessionSisContext = decodeSisContext(session?.lastEntityQueryText ?? "");
    const shouldUseSisMcq =
      output.route === "classes" &&
      ((output.term !== null &&
        output.school !== null &&
        (output.sisQuery !== null || output.courseName !== null)) ||
        sessionSisContext !== null);
    let candidates: EntityCandidate[];
    let hasMore: boolean;
    if (shouldUseSisMcq) {
      const sisTerm = output.term ?? sessionSisContext?.term ?? null;
      const sisSchool = output.school ?? sessionSisContext?.school ?? null;
      const sisQuery = (
        output.sisQuery ??
        output.courseName ??
        sessionSisContext?.query ??
        queryText
      ).trim();
      if (!sisTerm || !sisSchool) {
        candidates = [];
        hasMore = false;
      } else {
        const rows = (await ctx.runAction(api.actions.jhuCourses.getCoursesByTerm, {
          term: sisTerm,
          school: sisSchool,
          courseTitle: sisQuery,
        })) as Array<{ OfferingName?: string; Title?: string }>;
        const filtered = rows.filter((r) => r.OfferingName && r.Title).slice(0, 5);
        candidates = filtered.map((r) => ({
          id: encodeSisCandidate({
            offeringName: String(r.OfferingName),
            title: String(r.Title),
            term: sisTerm,
            school: sisSchool,
          }),
          label: String(r.OfferingName),
          subtitle: String(r.Title),
        }));
        hasMore = rows.length > candidates.length;
      }
    } else {
      const vectorMatches = await ctx.runAction(
        internal.actions.entityResolution.searchCourseCandidates,
        { userId, queryText, excludeIds: [] }
      );
      candidates = vectorMatches.candidates as EntityCandidate[];
      hasMore = vectorMatches.hasMore;
    }
    const taskForIntro = sessionActiveTaskId;
    const introText =
      candidates.length === 0
        ? shouldUseSisMcq
          ? "I couldn't find SIS matches for that term/school/query. Try a different keyword or course code."
          : "I couldn't find any courses in your profile. Add courses from the Classes page, then try again."
        : output.reply;
    await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
      userId,
      sessionId,
      role: "assistant",
      content: introText,
      ...(taskForIntro !== undefined ? { taskId: taskForIntro } : {}),
    });
    // See needs_task_mcq above: clear-then-set ordering matters when intent
    // switching, so apply session state changes BEFORE the entity prompt state.
    await applySessionStateChanges(ctx, userId, sessionId, output, activeAgent);
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: shouldUseSisMcq
          ? encodeSisContext({
              term: output.term ?? sessionSisContext?.term ?? "",
              school: output.school ?? sessionSisContext?.school ?? "",
              query: (
                output.sisQuery ??
                output.courseName ??
                sessionSisContext?.query ??
                queryText
              ).trim(),
            })
          : queryText,
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
      route: output.route,
      entityKind: "class",
      messageTag: "none",
      tagConfidence: 0,
      needsClassAfterTask: false,
    });
  }

  // reply / domain_clarify / canned
  const tagTask = sessionActiveTaskId;
  const tagCourse = sessionActiveCourseId;
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: output.reply,
    ...(tagTask !== undefined ? { taskId: tagTask } : {}),
    ...(tagCourse !== undefined ? { courseId: tagCourse } : {}),
  });
  await applySessionStateChanges(ctx, userId, sessionId, output, activeAgent);
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
    timezone?: string;
    entity?: {
      action:
        | "pick_task"
        | "pick_course"
        | "other_tasks"
        | "other_courses"
        | "menu_pick"
        | "pick_block";
      taskId?: string;
      courseId?: string;
      blockId?: string;
      excludeTaskIds?: string[];
      excludeCourseIds?: string[];
      route?: string;
    };
  }>();
  const timezone = body.timezone?.trim() || "UTC";

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
  if (!mastraUrl) {
    console.error("MASTRA_URL not configured");
    return c.json({ error: "Service unavailable" }, 503);
  }
  const client = new MastraClient({ baseUrl: mastraUrl });

  // ── Entity UI actions ──────────────────────────────────────────────────────

  if (body.entity?.action === "pick_block" && body.entity.blockId) {
    const blockId = body.entity.blockId as Id<"studyBlocks">;
    await ctx.runMutation(internal.mutations.chatSessions.resolvePickedBlockInternal, {
      userId,
      sessionId,
      blockId,
    });
    const sessionAfterBlock = await ctx.runQuery(
      internal.queries.chatSessions.getChatSessionInternal,
      { userId, sessionId }
    );
    // The empty `message` below relies on `activeAgent === "schedule"` to route this turn
    // directly to the schedule agent and bypass the supervisor (which would otherwise crash
    // on `messages: at least one message is required`). If the schedule agent state was
    // cleared between the picker being shown and the user picking, fail loudly with a
    // recoverable message instead of crashing the workflow.
    if (sessionAfterBlock?.activeAgent !== "schedule") {
      const recoverMsg =
        "I lost track of which task we were scheduling. Please ask me again to schedule a block.";
      await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "assistant",
        content: recoverMsg,
      });
      await ctx.runMutation(internal.mutations.chatSessions.clearAgentStateInternal, {
        userId,
        sessionId,
      });
      return c.json({ text: recoverMsg, status: "routed", route: "schedule", entityKind: "none" });
    }
    return handleWorkflowTurn(ctx, c, client, {
      userId,
      sessionId,
      message: "",
      timezone,
      session: sessionAfterBlock,
    });
  }

  if (
    body.entity?.action === "pick_task" ||
    body.entity?.action === "pick_course" ||
    body.entity?.action === "other_tasks" ||
    body.entity?.action === "other_courses"
  ) {
    if (
      body.entity.action === "pick_course" &&
      typeof body.entity.courseId === "string" &&
      isSisCandidateEntityId(body.entity.courseId)
    ) {
      const sis = decodeSisCandidate(body.entity.courseId);
      if (!sis) return c.json({ error: "Invalid SIS selection" }, 400);
      const synthetic = `I choose ${sis.offeringName}: ${sis.title} for ${sis.term} at ${sis.school}.`;
      const syntheticUserMessageId = await ctx.runMutation(
        internal.mutations.chatMessages.saveMessage,
        {
          userId,
          sessionId,
          role: "user",
          content: synthetic,
        }
      );
      const sessionAfterSynthetic = await ctx.runQuery(
        internal.queries.chatSessions.getChatSessionInternal,
        {
          userId,
          sessionId,
        }
      );
      return handleWorkflowTurn(ctx, c, client, {
        userId,
        sessionId,
        message: synthetic,
        timezone,
        session: {
          ...sessionAfterSynthetic,
          resolvedSisPick: sis as SisResolvedPick,
        },
        triggerUserMessageId: syntheticUserMessageId,
      });
    }

    if (body.entity.action === "other_courses") {
      const sisCtx = decodeSisContext(session?.lastEntityQueryText ?? "");
      if (sisCtx) {
        const excludeTokens = (body.entity.excludeCourseIds ?? []) as string[];
        const excludeOffering = new Set(
          excludeTokens
            .map((id) => decodeSisCandidate(id))
            .filter((v): v is NonNullable<typeof v> => v !== null)
            .map((v) => v.offeringName)
        );
        const rows = (await ctx.runAction(api.actions.jhuCourses.getCoursesByTerm, {
          term: sisCtx.term,
          school: sisCtx.school,
          courseTitle: sisCtx.query,
        })) as Array<{ OfferingName?: string; Title?: string }>;
        const filtered = rows
          .filter((r) => r.OfferingName && r.Title)
          .filter((r) => !excludeOffering.has(String(r.OfferingName)))
          .slice(0, 5);
        const candidates = filtered.map((r) => ({
          id: encodeSisCandidate({
            offeringName: String(r.OfferingName),
            title: String(r.Title),
            term: sisCtx.term,
            school: sisCtx.school,
          }),
          label: String(r.OfferingName),
          subtitle: String(r.Title),
        }));
        return c.json({
          text: "Which class are you referring to? Pick one below, or choose **Other** to see more options.",
          status: "needs_entity_clarification",
          phase: "class",
          entityCandidates: candidates,
          entityHasMore: rows.length > excludeOffering.size + candidates.length,
          route: "classes",
        });
      }
    }

    return handleEntityAction(
      ctx,
      c,
      client,
      {
        userId,
        sessionId,
        session,
        entity: body.entity as Parameters<typeof handleEntityAction>[3]["entity"],
      },
      (ctx2, c2, client2, turnParams) =>
        handleWorkflowTurn(ctx2, c2, client2, { ...turnParams, timezone })
    );
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
      timezone,
      session,
      triggerUserMessageId: menuUserMessageId,
    });
  }

  // ── Normal message ─────────────────────────────────────────────────────────
  const message = body.message?.trim();
  if (!message) return c.json({ error: "Bad Request" }, 400);

  const sessionBeforeMsg = await ctx.runQuery(
    internal.queries.chatSessions.getChatSessionInternal,
    { userId, sessionId }
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
      { userId, sessionId }
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
    timezone,
    session: sessionNow,
    triggerUserMessageId: userMessageId,
  });
});

export default chatApp;
