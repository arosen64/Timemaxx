import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Doc, Id } from "../_generated/dataModel";
import { parseDeptPrefix, termSortKey } from "./classTagUtils";

type Ctx = GenericActionCtx<DataModel>;

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
 * Heuristic retrieval — returns up to 10 course IDs relevant to the task.
 *
 * Prefers courses in the same department as the task's own course (sorted
 * most-recent-term first), falling back to the user's most recent courses.
 * The task's own course is excluded since it is already passed to the prompt
 * separately as courseInfo.
 * TODO: Replace with vector similarity search using the task embedding as the query.
 */
export async function fetchRelevantClasses(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Id<"userCourses">[]> {
  const [task, courses] = await Promise.all([
    ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId }),
    ctx.runQuery(internal.queries.userCourses.getUserCoursesInternal, { userId }),
  ]);

  const typedCourses = courses as Doc<"userCourses">[];

  // Heuristic: prefer courses in the same department as the task's course.
  if (task?.courseId) {
    const taskCourse = typedCourses.find((c) => c._id === task.courseId);
    if (taskCourse) {
      const deptPrefix = parseDeptPrefix(taskCourse.courseCode);
      if (deptPrefix) {
        const deptCourses = typedCourses
          .filter((c) => c._id !== task.courseId && c.courseCode.startsWith(`${deptPrefix}.`))
          .sort((a, b) => termSortKey(b.term) - termSortKey(a.term));
        if (deptCourses.length > 0) {
          return deptCourses.slice(0, 10).map((c) => c._id);
        }
      }
    }
  }

  // Fallback: most recent courses, excluding the task's own course.
  return typedCourses
    .filter((c) => c._id !== task?.courseId)
    .slice(0, 10)
    .map((c) => c._id);
}

/**
 * Heuristic retrieval — returns up to 10 prior task IDs for the user,
 * excluding the current task.
 * TODO: Replace with vector similarity search using the task embedding as the query.
 */
export async function fetchRelevantTasks(
  ctx: Ctx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Id<"tasks">[]> {
  const tasks = await ctx.runQuery(
    internal.queries.tasks.getAllTasksInternal,
    { userId }
  );
  return (tasks as Doc<"tasks">[])
    .filter((t) => t._id !== taskId)
    .slice(0, 10)
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
