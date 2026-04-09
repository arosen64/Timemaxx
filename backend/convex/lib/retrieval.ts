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
 * Mock embedding retrieval — returns an empty chat list.
 * TODO: Replace with vector similarity search returning chatIds,
 *       then batch-fetch via getChatsByIdsInternal once a chats table exists.
 */
export async function fetchRelevantChats(
  _ctx: Ctx,
  _taskId: Id<"tasks">,
  _userId: Id<"users">
): Promise<RelevantChat[]> {
  return [];
}
