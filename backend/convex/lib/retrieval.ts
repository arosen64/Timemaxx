import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { parseDeptPrefix, termSortKey } from "./classTagUtils";

type Ctx = GenericActionCtx<DataModel>;

/** Must match `schema` vector index dimensions for tasks / userCourses. */
const EMBEDDING_DIMS = 3072;
const RELEVANT_RESULT_CAP = 10;
/** Head room after excluding current task or own course from vector hits. */
const RELEVANT_VECTOR_SCAN_LIMIT = 32;

const CHAT_RETRIEVAL_CAP = 8;
const CHAT_VECTOR_SCAN_LIMIT = 40;

const CHAT_RETRIEVAL_INTENT =
  "Information relevant to estimating study time: scope, difficulty, prior experience, deadlines, and how long similar work took.";

function taskQueryEmbedding(task: Doc<"tasks">): number[] | null {
  const e = task.embedding;
  if (!Array.isArray(e) || e.length !== EMBEDDING_DIMS) return null;
  return e;
}

export interface RelevantChats {
  chunkIds: Id<"chatChunks">[];
  /** Same order as `chunkIds`; loaded once in `fetchRelevantChats` for callers to format without re-querying. */
  chunks: Doc<"chatChunks">[];
}

export interface RelevantContext {
  taskIds: Id<"tasks">[];
  classIds: Id<"userCourses">[];
  /** `chatChunks` IDs from vector search over embedded transcript slices. */
  chatChunkIds: Id<"chatChunks">[];
  /** Same order as `chatChunkIds`. */
  chatChunks: Doc<"chatChunks">[];
}

/**
 * Returns up to 10 course IDs relevant to the task.
 *
 * When the task has a 3072-dim `embedding`, uses vector search on `userCourses`
 * with the same query vector. The task's own course is excluded (already in
 * `courseInfo`). Without an embedding, falls back to department / recency
 * heuristics over all user courses.
 */
export async function fetchRelevantClasses(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Id<"userCourses">[]> {
  // Dynamic import avoids a static import cycle (api → … → this file → api).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { internal } = (await import("../_generated/api")) as unknown as { internal: any };
  const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId });
  if (!task || task.userId !== userId) return [];

  const queryVector = taskQueryEmbedding(task);
  if (queryVector) {
    const raw = await ctx.vectorSearch("userCourses", "by_embedding", {
      vector: queryVector,
      limit: RELEVANT_VECTOR_SCAN_LIMIT,
      filter: (q) => q.eq("userId", userId),
    });
    const ownCourse = task.courseId;
    const out: Id<"userCourses">[] = [];
    for (const row of raw) {
      if (ownCourse && row._id === ownCourse) continue;
      out.push(row._id);
      if (out.length >= RELEVANT_RESULT_CAP) break;
    }
    return out;
  }

  const courses = await ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, {
    userId,
  });
  const typedCourses = courses as Doc<"userCourses">[];

  // Heuristic: prefer courses in the same department as the task's course.
  if (task.courseId) {
    const taskCourse = typedCourses.find((c) => c._id === task.courseId);
    if (taskCourse) {
      const deptPrefix = parseDeptPrefix(taskCourse.courseCode);
      if (deptPrefix) {
        const deptCourses = typedCourses
          .filter((c) => c._id !== task.courseId && c.courseCode.startsWith(`${deptPrefix}.`))
          .sort((a, b) => termSortKey(b.term) - termSortKey(a.term));
        if (deptCourses.length > 0) {
          return deptCourses.slice(0, RELEVANT_RESULT_CAP).map((c) => c._id);
        }
      }
    }
  }

  // Fallback: most recent courses, excluding the task's own course.
  return typedCourses
    .filter((c) => c._id !== task.courseId)
    .slice(0, RELEVANT_RESULT_CAP)
    .map((c) => c._id);
}

/**
 * Returns up to 10 other task IDs for the user, excluding the current task.
 *
 * When the task has a valid `embedding`, uses vector search on `tasks`.
 * Otherwise falls back to most recently created tasks (same cap).
 */
export async function fetchRelevantTasks(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Id<"tasks">[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { internal } = (await import("../_generated/api")) as unknown as { internal: any };
  const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId });
  if (!task || task.userId !== userId) return [];

  const queryVector = taskQueryEmbedding(task);
  if (queryVector) {
    const raw = await ctx.vectorSearch("tasks", "by_embedding", {
      vector: queryVector,
      limit: RELEVANT_VECTOR_SCAN_LIMIT,
      filter: (q) => q.eq("userId", userId),
    });
    const out: Id<"tasks">[] = [];
    for (const row of raw) {
      if (row._id === taskId) continue;
      out.push(row._id);
      if (out.length >= RELEVANT_RESULT_CAP) break;
    }
    return out;
  }

  const tasks = await ctx.runQuery(internal.queries.tasks.getAllTasksInternal, { userId });
  return (tasks as Doc<"tasks">[])
    .filter((t) => t._id !== taskId)
    .slice(0, RELEVANT_RESULT_CAP)
    .map((t) => t._id);
}

/**
 * Same string embedded for `chatChunks` RAG (debug / tooling may log a preview).
 * Returns null when there is no task-specific anchor text so we do not embed the fixed intent alone.
 */
export function buildChatRetrievalQueryText(task: Doc<"tasks">): string | null {
  const title = task.title?.trim() ?? "";
  const desc = (task.description ?? "").trim();
  if (title.length === 0 && desc.length === 0) return null;
  const body = desc.length > 0 ? `${title}\n\n${desc}` : title;
  return `${body}\n\n${CHAT_RETRIEVAL_INTENT}`.trim();
}

export function chunkHasMetadataOverlap(
  chunk: Doc<"chatChunks">,
  taskIdSet: Set<Id<"tasks">>,
  courseIdSet: Set<Id<"userCourses">>
): boolean {
  const taskHit = chunk.linkedTaskIds.some((id) => taskIdSet.has(id));
  const courseHit = chunk.linkedCourseIds.some((id) => courseIdSet.has(id));
  return taskHit || courseHit;
}

/**
 * Vector search over `chatChunks` for the user: embeds a query from the
 * current task plus a fixed intent phrase, then prefers chunks whose
 * `linkedTaskIds` / `linkedCourseIds` overlap related tasks, the current task,
 * related courses, or the task's course.
 *
 * Requires `GEMINI_API_KEY` and embedded chunks; otherwise returns empty ids/chunks.
 *
 * @param opts.queryEmbedding — If a 3072-length vector, used as the query
 *   vector and the Gemini embed step is skipped (for debug callers that already
 *   embedded the same text).
 */
export async function fetchRelevantChats(
  ctx: Ctx,
  userId: Id<"users">,
  currentTaskId: Id<"tasks">,
  relatedTaskIds: Id<"tasks">[],
  relatedClassIds: Id<"userCourses">[],
  opts?: { queryEmbedding?: number[] }
): Promise<RelevantChats> {
  const empty: RelevantChats = { chunkIds: [], chunks: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { internal } = (await import("../_generated/api")) as unknown as { internal: any };
  const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, {
    taskId: currentTaskId,
  });
  if (!task || task.userId !== userId) return empty;

  const retrievalText = buildChatRetrievalQueryText(task);
  if (retrievalText === null) return empty;

  const pre = opts?.queryEmbedding;
  let embedding: number[] | null = Array.isArray(pre) && pre.length === EMBEDDING_DIMS ? pre : null;
  if (!embedding) {
    embedding = (await ctx.runAction(internal.ai.embeddings.embedRetrievalQueryInternal, {
      text: retrievalText,
    })) as number[] | null;
  }
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
    return empty;
  }

  const raw = await ctx.vectorSearch("chatChunks", "by_embedding", {
    vector: embedding,
    limit: CHAT_VECTOR_SCAN_LIMIT,
    filter: (q) => q.eq("userId", userId),
  });
  if (raw.length === 0) return empty;

  const orderedIds = raw.map((row) => row._id as Id<"chatChunks">);
  const chunks = (await ctx.runQuery(internal.queries.chatChunks.getChatChunksByIdsInternal, {
    userId,
    chunkIds: orderedIds,
  })) as Doc<"chatChunks">[];

  const byId = new Map(chunks.map((c) => [c._id, c]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((c): c is Doc<"chatChunks"> => c !== undefined);

  const taskIdSet = new Set<Id<"tasks">>([currentTaskId, ...relatedTaskIds]);
  const courseIdSet = new Set<Id<"userCourses">>(relatedClassIds);
  if (task.courseId) {
    courseIdSet.add(task.courseId);
  }

  const withOverlap: Doc<"chatChunks">[] = [];
  const withoutOverlap: Doc<"chatChunks">[] = [];
  for (const c of ordered) {
    if (chunkHasMetadataOverlap(c, taskIdSet, courseIdSet)) {
      withOverlap.push(c);
    } else {
      withoutOverlap.push(c);
    }
  }

  const mergedDocs = [...withOverlap, ...withoutOverlap].slice(0, CHAT_RETRIEVAL_CAP);
  const chunkIds = mergedDocs.map((c) => c._id);
  return { chunkIds, chunks: mergedDocs };
}

/**
 * Orchestrates retrieval across all three context sources.
 *
 * Fetches relevant classes and tasks in parallel first, then passes their IDs
 * into fetchRelevantChats so the chat retrieval can filter by that metadata.
 * Returns IDs for tasks and courses, plus chat chunk IDs and the same chunks
 * as documents (one load) for prompt building.
 */
export async function fetchRelevantContext(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<RelevantContext> {
  const [taskIds, classIds] = await Promise.all([
    fetchRelevantTasks(ctx, taskId, userId),
    fetchRelevantClasses(ctx, taskId, userId),
  ]);
  const chats = await fetchRelevantChats(ctx, userId, taskId, taskIds, classIds);
  return { taskIds, classIds, chatChunkIds: chats.chunkIds, chatChunks: chats.chunks };
}
