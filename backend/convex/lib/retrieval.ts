import { internal } from "../_generated/api";
import { GenericActionCtx } from "convex/server";
import { DataModel, Id } from "../_generated/dataModel";

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
 * Mock embedding retrieval — returns the first 10 course IDs for the user.
 * TODO: Replace with vector similarity search using the task embedding as the query.
 */
export async function fetchRelevantClasses(
  ctx: Ctx,
  _taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Id<"userCourses">[]> {
  const courses = await ctx.runQuery(
    internal.queries.userCourses.getUserCoursesInternal,
    { userId }
  );
  return courses.slice(0, 10).map((c: { _id: Id<"userCourses"> }) => c._id);
}

/**
 * Mock embedding retrieval — returns the first 10 task IDs for the user,
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
  return (tasks as Array<{ _id: Id<"tasks"> }>)
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
