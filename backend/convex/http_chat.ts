import { Hono, type Context } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { HonoEnv } from "./lib/httpTypes";

import {
  getLastUserMessage,
  shouldOfferTaskEntityMcq,
  type TaggedMessageView,
} from "./lib/messageTaggedScope";
import { threadHasTaggedCourse, buildTaggedEntitiesContextBlock } from "./lib/chatEntityContext";
import { handleEntityAction } from "./lib/chatEntityActions";

/** Mirrors the output schema of chatWorkflow in mastra/src/mastra/workflows/chatWorkflow.ts */
type ChatWorkflowOutput = {
  reply: string;
  route: string | null;
  status: "reply" | "domain_clarify" | "needs_task_mcq" | "needs_class_mcq" | "task_action" | "course_action" | "canned";
  mcqQueryText: string | null;
  needsClassAfterTask: boolean;
  actionType: "create_task" | "update_task" | "delete_task" | "read_task" | "add_course" | "drop_course" | "update_course" | "view_courses" | "none" | null;
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
  courseName: string | null;
  sisQuery: string | null;
  term: string | null;
  school: string | null;
  studyGoal: string | null;
  grade: string | null;
  difficultyRating: number | null;
  newActiveAgent: "task" | "feedback" | "preferences" | "classes" | null;
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
const CHAT_INPUT_LOCKED_REPLY_MSG =
  "This chat was closed for new topics. Close the widget (×), then open Maxx again to start a fresh session.";
const MENU_USER_LABELS: Record<string, string> = {
  tasks: "Help with tasks",
  classes: "Class questions",
  feedback: "Give feedback on a task",
  schedule: "Schedule something",
  preferences: "Change my preferences",
};
type EntityCandidate = { id: string; label: string; subtitle: string };

function parseDueDateIso(iso: string): number {
  if (!iso) return Date.now() + 86_400_000;
  const hasTime = iso.includes("T") && iso.length > 10;
  const normalized = hasTime ? iso : `${iso}T23:59:59`;
  const ms = new Date(normalized).getTime();
  return isNaN(ms) ? Date.now() + 86_400_000 : ms;
}

const STUDY_GOALS = new Set(["Just pass", "Do well", "Ace it"]);
const GRADES = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "IP", "S", "U", "NG"]);
const SIS_CONTEXT_PREFIX = "__sis_ctx__|";
const SIS_CANDIDATE_PREFIX = "__sis_pick__|";

function termToOrdinal(termName: string): number | null {
  const lower = termName.toLowerCase();
  const yearMatch = termName.match(/\d{4}/);
  if (!yearMatch) return null;
  const year = Number.parseInt(yearMatch[0], 10);
  const season =
    lower.includes("intersession") ? 0 :
    lower.includes("spring") ? 1 :
    lower.includes("summer") ? 2 :
    lower.includes("fall") ? 3 : null;
  if (season === null) return null;
  return year * 10 + season;
}

function currentTermOrdinal(date = new Date()): number {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const season =
    month < 1 || (month === 1 && day < 15) ? 0 :
    month < 6 ? 1 :
    month < 8 || (month === 8 && day < 15) ? 2 : 3;
  return year * 10 + season;
}

function isPastTerm(termName: string): boolean {
  const ordinal = termToOrdinal(termName);
  if (ordinal === null) return false;
  return ordinal < currentTermOrdinal();
}

function encodeSisContext(input: { term: string; school: string; query: string }): string {
  return `${SIS_CONTEXT_PREFIX}${input.term}||${input.school}||${input.query}`;
}

function decodeSisContext(s: string): { term: string; school: string; query: string } | null {
  if (!s.startsWith(SIS_CONTEXT_PREFIX)) return null;
  const body = s.slice(SIS_CONTEXT_PREFIX.length);
  const [term, school, query] = body.split("||");
  if (!term || !school || !query) return null;
  return { term, school, query };
}

function encodeSisCandidate(input: { offeringName: string; title: string; term: string; school: string }): string {
  return `${SIS_CANDIDATE_PREFIX}${input.offeringName}||${input.title}||${input.term}||${input.school}`;
}

function decodeSisCandidate(s: string): { offeringName: string; title: string; term: string; school: string } | null {
  if (!s.startsWith(SIS_CANDIDATE_PREFIX)) return null;
  const body = s.slice(SIS_CANDIDATE_PREFIX.length);
  const [offeringName, title, term, school] = body.split("||");
  if (!offeringName || !title || !term || !school) return null;
  return { offeringName, title, term, school };
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
    activeAgent: "task" | "feedback" | "preferences" | "classes" | null;
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

  // Only one branch step will have run — find whichever has output.
  const branchStepIds = ["task_handler", "feedback_handler", "course_handler", "canned_handler"];
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
    activeTaskId?: Id<"tasks">;
    activeCourseId?: Id<"userCourses">;
    output: ChatWorkflowOutput;
  },
): Promise<string> {
  const { userId, sessionId, activeTaskId, activeCourseId, output } = params;
  const taggedTaskId = activeTaskId;
  const taggedCourseId = activeCourseId;
  let aiText = output.reply;
  let clearedScopeAfterAction = false;

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

  await ctx.runMutation(internal.mutations.chatSessions.clearTaskAgentStateInternal, {
    userId,
    sessionId,
  });
  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    sessionId,
    role: "assistant",
    content: aiText,
    ...(taggedTaskId !== undefined && !clearedScopeAfterAction ? { taskId: taggedTaskId } : {}),
    ...(taggedCourseId !== undefined && !clearedScopeAfterAction ? { courseId: taggedCourseId } : {}),
  });
  return aiText;
}

async function executeCourseAction(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    sessionId: string;
    activeCourseId?: Id<"userCourses">;
    output: ChatWorkflowOutput;
  },
): Promise<string> {
  const { userId, sessionId, activeCourseId, output } = params;
  let aiText = output.reply;
  let clearedScopeAfterAction = false;

  try {
    if (output.actionType === "add_course") {
      if (!output.sisQuery || !output.term || !output.school) {
        throw new Error("Missing required course fields (query, term, or school).");
      }
      const sisResults = await ctx.runAction(api.actions.jhuCourses.getCoursesByTerm, {
        term: output.term,
        school: output.school,
        courseTitle: output.sisQuery,
      }) as Array<{ OfferingName?: string; Title?: string; Credits?: string }>;
      if (!Array.isArray(sisResults) || sisResults.length === 0) {
        throw new Error("I could not find a matching SIS course. Please provide a more specific code or title.");
      }
      const normalizedQuery = output.sisQuery.trim().toLowerCase();
      const exact = sisResults.find((c) =>
        `${c.OfferingName ?? ""} ${c.Title ?? ""}`.toLowerCase().includes(normalizedQuery),
      ) ?? sisResults[0];
      const offeringName = exact.OfferingName;
      const titleText = exact.Title;
      if (!offeringName || !titleText) {
        throw new Error("SIS result is missing course code/title.");
      }
      const isPast = isPastTerm(output.term);
      if (isPast) {
        if (!output.grade || !GRADES.has(output.grade)) {
          throw new Error("For past terms, grade must be one of the app's allowed grade options.");
        }
        if (output.difficultyRating === null || output.difficultyRating < 1 || output.difficultyRating > 5) {
          throw new Error("For past terms, difficulty rating must be between 1 and 5.");
        }
      } else if (!output.studyGoal || !STUDY_GOALS.has(output.studyGoal)) {
        throw new Error("For current/future terms, study goal must be one of: Just pass, Do well, Ace it.");
      }

      let description: string | undefined;
      let prereqs: string[] | undefined;
      try {
        const details = await ctx.runAction(api.actions.jhuCourses.getCourseDetails, {
          offeringName,
          term: output.term,
        }) as { description?: string; prereqs?: string[] } | null;
        if (details) {
          description = typeof details.description === "string" ? details.description : undefined;
          prereqs = Array.isArray(details.prereqs) ? details.prereqs : undefined;
        }
      } catch {
        // Best effort only: keep add flow resilient.
      }

      const fullTitle = `${offeringName}: ${titleText}`;
      const credits = exact.Credits ? Number.parseFloat(exact.Credits) : undefined;
      await ctx.runMutation(api.mutations.userCourses.addUserCourse, {
        courseCode: offeringName,
        title: fullTitle,
        description,
        prereqs,
        credits,
        term: output.term,
        studyGoal: !isPast ? output.studyGoal ?? undefined : undefined,
        grade: isPast ? output.grade ?? undefined : undefined,
        difficultyRating: isPast ? output.difficultyRating ?? undefined : undefined,
      });
    } else if (output.actionType === "drop_course") {
      if (activeCourseId === undefined) throw new Error("No class selected.");
      await ctx.runMutation(api.mutations.userCourses.deleteUserCourse, {
        userCourseId: activeCourseId,
      });
      await ctx.runMutation(internal.mutations.chatSessions.setMessageScopeInternal, {
        userId,
        sessionId,
        clear: true,
      });
      clearedScopeAfterAction = true;
    } else if (output.actionType === "update_course") {
      if (activeCourseId === undefined) throw new Error("No class selected.");
      const patch: {
        userCourseId: Id<"userCourses">;
        studyGoal?: string;
        grade?: string;
        difficultyRating?: number;
      } = { userCourseId: activeCourseId };

      if (output.studyGoal !== null) {
        if (!STUDY_GOALS.has(output.studyGoal)) {
          throw new Error("Study goal must be one of: Just pass, Do well, Ace it.");
        }
        patch.studyGoal = output.studyGoal;
      }
      if (output.grade !== null) {
        if (!GRADES.has(output.grade)) {
          throw new Error("Grade must match one of the app's allowed grade options.");
        }
        patch.grade = output.grade;
      }
      if (output.difficultyRating !== null) {
        if (output.difficultyRating < 1 || output.difficultyRating > 5) {
          throw new Error("Difficulty rating must be between 1 and 5.");
        }
        patch.difficultyRating = output.difficultyRating;
      }

      if (
        patch.studyGoal === undefined &&
        patch.grade === undefined &&
        patch.difficultyRating === undefined
      ) {
        throw new Error("No supported course updates were provided.");
      }

      await ctx.runMutation(api.mutations.userCourses.updateUserCourse, patch);
    } else if (output.actionType === "view_courses") {
      // Read-only course view: keep assistant reply only.
    }
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
    ...(activeCourseId !== undefined && !clearedScopeAfterAction ? { courseId: activeCourseId } : {}),
  });
  return aiText;
}

async function applySessionStateChanges(
  ctx: ActionCtx,
  userId: Id<"users">,
  sessionId: string,
  output: ChatWorkflowOutput,
  previousActiveAgent: "task" | "feedback" | "preferences" | "classes" | null,
) {
  const feedbackAgentDone =
    previousActiveAgent === "feedback" &&
    (output.readyToRecord || output.newActiveAgent !== "feedback");
  if (output.clearActiveAgent || feedbackAgentDone) {
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
    session: {
      activeAgent?: string;
      taskAgentIntent?: string;
      activeTaskId?: Id<"tasks">;
      activeCourseId?: Id<"userCourses">;
      lastEntityQueryText?: string;
    } | null;
    triggerUserMessageId?: Id<"chatMessages">;
  },
): Promise<Response> {
  const { userId, sessionId, message, session, triggerUserMessageId } = params;
  const sessionActiveTaskId = session?.activeTaskId;
  const sessionActiveCourseId = session?.activeCourseId;

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

  const today = new Date().toISOString().slice(0, 10);
  const activeAgent = (session?.activeAgent as "task" | "feedback" | "preferences" | "classes" | null) ?? null;
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
    const aiText = await executeTaskAction(ctx, {
      userId,
      sessionId,
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
    await applySessionStateChanges(ctx, userId, sessionId, output, activeAgent);
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
      (
        (
          output.term !== null &&
          output.school !== null &&
          (output.sisQuery !== null || output.courseName !== null)
        ) ||
        sessionSisContext !== null
      );
    let candidates: EntityCandidate[] = [];
    let hasMore = false;
    if (shouldUseSisMcq) {
      const sisTerm = output.term ?? sessionSisContext?.term ?? null;
      const sisSchool = output.school ?? sessionSisContext?.school ?? null;
      const sisQuery = (output.sisQuery ?? output.courseName ?? sessionSisContext?.query ?? queryText).trim();
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
        { userId, queryText, excludeIds: [] },
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
    if (candidates.length > 0) {
      await ctx.runMutation(internal.mutations.chatSessions.setEntityPromptStateInternal, {
        userId,
        sessionId,
        lastEntityQueryText: shouldUseSisMcq
          ? encodeSisContext({
              term: output.term ?? sessionSisContext?.term ?? "",
              school: output.school ?? sessionSisContext?.school ?? "",
              query: (output.sisQuery ?? output.courseName ?? sessionSisContext?.query ?? queryText).trim(),
            })
          : queryText,
        activeEntityStep: "class",
        needsClassAfterTask: false,
        awaitingEntityResolution: true,
        ...(mcqTriggerId !== undefined ? { clarifyTriggerUserMessageId: mcqTriggerId } : {}),
      });
    }
    await applySessionStateChanges(ctx, userId, sessionId, output, activeAgent);
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

  if (
    body.entity?.action === "pick_task" ||
    body.entity?.action === "pick_course" ||
    body.entity?.action === "other_tasks" ||
    body.entity?.action === "other_courses"
  ) {
    if (
      body.entity.action === "pick_course" &&
      typeof body.entity.courseId === "string" &&
      body.entity.courseId.startsWith(SIS_CANDIDATE_PREFIX)
    ) {
      const sis = decodeSisCandidate(body.entity.courseId);
      if (!sis) return c.json({ error: "Invalid SIS selection" }, 400);
      const synthetic = `I choose ${sis.offeringName}: ${sis.title} for ${sis.term} at ${sis.school}.`;
      const syntheticUserMessageId = await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
        userId,
        sessionId,
        role: "user",
        content: synthetic,
      });
      const sessionAfterSynthetic = await ctx.runQuery(internal.queries.chatSessions.getChatSessionInternal, {
        userId,
        sessionId,
      });
      return handleWorkflowTurn(ctx, c, client, {
        userId,
        sessionId,
        message: synthetic,
        session: sessionAfterSynthetic,
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
            .map((v) => v.offeringName),
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
      ctx, c, client,
      { userId, sessionId, session, entity: body.entity as Parameters<typeof handleEntityAction>[3]["entity"] },
      handleWorkflowTurn,
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
