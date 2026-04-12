import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { parseDeptPrefix, termSortKey } from "./classTagUtils";

type Ctx = GenericActionCtx<DataModel>;

/** Must match `schema` vector index dimensions for tasks / userCourses. */
const EMBEDDING_DIMS = 3072;
const RELEVANT_RESULT_CAP = 10;
/** Head room after excluding current task or own course from vector hits. */
const RELEVANT_VECTOR_SCAN_LIMIT = 32;

function taskQueryEmbedding(task: Doc<"tasks">): number[] | null {
  const e = task.embedding;
  if (!Array.isArray(e) || e.length !== EMBEDDING_DIMS) return null;
  return e;
}

export interface RelevantChat {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp?: number;
}

export interface RelevantContext {
  taskIds: Id<"tasks">[];
  classIds: Id<"userCourses">[];
  /** Chat IDs to retrieve. TODO: type as Id<"chats">[] once the chats table exists. */
  chatIds: string[];
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

  const courses = await ctx.runQuery(
    internal.queries.userCourses.getUserCoursesInternal,
    { userId },
  );
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

  const tasks = await ctx.runQuery(
    internal.queries.tasks.getAllTasksInternal,
    { userId },
  );
  return (tasks as Doc<"tasks">[])
    .filter((t) => t._id !== taskId)
    .slice(0, RELEVANT_RESULT_CAP)
    .map((t) => t._id);
}

/**
 * Mock embedding retrieval — returns an empty list of chat IDs.
 * Accepts task and class IDs so future implementations can filter chat
 * embeddings by the metadata associated with those tasks and classes.
 * TODO: Replace with vector similarity search returning chatIds filtered by
 *       taskIds/classIds metadata, once a chats table exists.
 */
export async function fetchRelevantChats(
  _ctx: Ctx,
  _taskIds: Id<"tasks">[],
  _classIds: Id<"userCourses">[]
): Promise<string[]> {
  return [];
}

/**
 * Orchestrates retrieval across all three context sources.
 *
 * Fetches relevant classes and tasks in parallel first, then passes their IDs
 * into fetchRelevantChats so the chat retrieval can filter by that metadata.
 * Returns a single object with IDs for each source.
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
  const chatIds = await fetchRelevantChats(ctx, taskIds, classIds);
  return { taskIds, classIds, chatIds };
}
