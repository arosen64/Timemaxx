import { Doc, Id } from "../_generated/dataModel";

/**
 * Shared base fields present on both tasks and subtasks.
 */
type TaskLikeBase = {
  userId: Id<"users">;
  title: string;
  description: string;
  taskType: string;
  timeEstimate?: number;
  /** The real assignment deadline. Tasks have this directly; subtasks inherit it from their parent. */
  dueDate: number;
  courseId?: Id<"userCourses">;
  createdAt: number;
};

/**
 * Discriminated union of a task and a subtask.
 *
 * Discriminant: `taskId`
 *   - absent  → task branch  (_id is Id<"tasks">)
 *   - present → subtask branch (_id is Id<"subtasks">)
 *
 * Usage:
 *   if (item.taskId) {
 *     // subtask: item._id is Id<"subtasks">
 *   } else {
 *     // task: item._id is Id<"tasks">
 *   }
 */
export type TaskLike =
  | (TaskLikeBase & {
      _id: Id<"tasks">;
      taskId?: never;
    })
  | (TaskLikeBase & {
      _id: Id<"subtasks">;
      /** The parent task's ID. Present on subtasks only. */
      taskId: Id<"tasks">;
      /** Suggested intermediate completion date before the real deadline. */
      suggestedCompletionAt?: number;
    });

/**
 * Adapts a task document to TaskLike.
 */
export function taskToTaskLike(doc: Doc<"tasks">): TaskLike {
  return {
    _id: doc._id,
    userId: doc.userId,
    title: doc.title,
    description: doc.description,
    taskType: doc.taskType,
    timeEstimate: doc.timeEstimate,
    dueDate: doc.dueDate,
    courseId: doc.courseId,
    createdAt: doc.createdAt,
  };
}

/**
 * Adapts a subtask document to TaskLike.
 * Requires the parent task to inherit dueDate and courseId.
 */
export function subtaskToTaskLike(doc: Doc<"subtasks">, parent: Doc<"tasks">): TaskLike {
  return {
    _id: doc._id,
    taskId: doc.parentTaskId,
    userId: doc.userId,
    title: doc.title,
    description: doc.description,
    taskType: doc.taskType,
    timeEstimate: doc.timeEstimate,
    dueDate: parent.dueDate,
    courseId: parent.courseId,
    suggestedCompletionAt: doc.suggestedCompletionAt,
    createdAt: doc.createdAt,
  };
}
