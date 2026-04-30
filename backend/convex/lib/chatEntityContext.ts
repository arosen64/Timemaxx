import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  collectUniqueTaggedIds,
  walkLatestTaggedCourseId,
  walkLatestTaggedTaskId,
  type TaggedMessageView,
} from "./messageTaggedScope";

export async function threadHasTaggedCourse(
  ctx: ActionCtx,
  userId: Id<"users">,
  historyAsc: readonly TaggedMessageView[]
): Promise<boolean> {
  if (walkLatestTaggedCourseId(historyAsc) !== undefined) return true;
  const tid = walkLatestTaggedTaskId(historyAsc);
  if (tid === undefined) return false;
  const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId: tid });
  return !!(task && task.userId === userId && task.courseId);
}

export async function buildTaggedEntitiesContextBlock(
  ctx: ActionCtx,
  userId: Id<"users">,
  historyAsc: readonly TaggedMessageView[]
): Promise<string> {
  const { taskIds, courseIds } = collectUniqueTaggedIds(historyAsc);
  const extraCourseIds = new Set<string>();
  const lines: string[] = [];

  if (taskIds.length === 0 && courseIds.length === 0) {
    return "No task or course IDs are tagged on messages in this window yet.";
  }

  lines.push("Entities referenced by message tags in this thread:");
  for (const tid of taskIds) {
    const task = await ctx.runQuery(internal.queries.tasks.getTaskInternal, { taskId: tid });
    if (task && task.userId === userId) {
      const subtasks = await ctx.runQuery(internal.queries.subtasks.countSubtasksForTaskInternal, {
        parentTaskId: tid,
      });
      lines.push(
        `- Task "${task.title}" (${task.taskType}, due ${new Date(task.dueDate).toISOString().slice(0, 10)}${task.classTag ? `, class: ${task.classTag}` : ""}, subtasks: ${subtasks}) → taskId ${String(tid)}`
      );
      if (subtasks > 0) {
        const subtaskRows = await ctx.runQuery(
          internal.queries.subtasks.getSubtasksForTaskInternal,
          {
            parentTaskId: tid,
          }
        );
        for (const [index, subtask] of subtaskRows.entries()) {
          const estimate =
            subtask.timeEstimate !== undefined
              ? `${Math.floor(subtask.timeEstimate / 60)}h ${subtask.timeEstimate % 60}m`
              : "estimate pending";
          lines.push(
            `  - Subtask ${index + 1}: "${subtask.title}" (status: ${subtask.status ?? "not_started"}, estimate: ${estimate})`
          );
        }
      }
      if (task.courseId) extraCourseIds.add(String(task.courseId));
    }
  }

  const mergedCourse = new Set([...courseIds.map(String), ...extraCourseIds]);
  for (const cid of mergedCourse) {
    const courses = await ctx.runQuery(internal.queries.userCourses.getUserCoursesByIdsInternal, {
      courseIds: [cid as Id<"userCourses">],
    });
    const c2 = courses[0];
    if (c2 && c2.userId === userId) {
      lines.push(`- Course "${c2.title}" (${c2.courseCode}) → courseId ${String(cid)}`);
    }
  }

  const primaryTask = walkLatestTaggedTaskId(historyAsc);
  const primaryCourse = walkLatestTaggedCourseId(historyAsc);
  lines.push(
    `Most recent tag (newest first): ${primaryTask ? `taskId=${String(primaryTask)}` : "no task tag"}, ${primaryCourse ? `courseId=${String(primaryCourse)}` : "no course tag"}.`
  );
  lines.push(
    "Use these IDs for update/delete/read and for class on create when they match the user's latest request."
  );
  return lines.join("\n");
}
