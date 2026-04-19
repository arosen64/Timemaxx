import type { Id } from "../_generated/dataModel";

/** Minimal chat row shape for scope helpers (history from Convex, oldest-first). */
export type TaggedMessageView = {
  _id: Id<"chatMessages">;
  role: "user" | "assistant";
  content: string;
  taskId?: Id<"tasks">;
  courseId?: Id<"userCourses">;
  createdAt: number;
};

export function getLastUserMessage(
  historyAsc: readonly TaggedMessageView[],
): TaggedMessageView | null {
  for (let i = historyAsc.length - 1; i >= 0; i--) {
    if (historyAsc[i].role === "user") return historyAsc[i];
  }
  return null;
}

/** Newest → oldest: first message that carries a taskId. */
export function walkLatestTaggedTaskId(
  historyAsc: readonly TaggedMessageView[],
): Id<"tasks"> | undefined {
  for (let i = historyAsc.length - 1; i >= 0; i--) {
    const t = historyAsc[i].taskId;
    if (t !== undefined) return t;
  }
  return undefined;
}

/** Newest → oldest: first message that carries a courseId. */
export function walkLatestTaggedCourseId(
  historyAsc: readonly TaggedMessageView[],
): Id<"userCourses"> | undefined {
  for (let i = historyAsc.length - 1; i >= 0; i--) {
    const c = historyAsc[i].courseId;
    if (c !== undefined) return c;
  }
  return undefined;
}

export function collectUniqueTaggedIds(historyAsc: readonly TaggedMessageView[]): {
  taskIds: Id<"tasks">[];
  courseIds: Id<"userCourses">[];
} {
  const taskSet = new Set<string>();
  const courseSet = new Set<string>();
  for (const m of historyAsc) {
    if (m.taskId) taskSet.add(String(m.taskId));
    if (m.courseId) courseSet.add(String(m.courseId));
  }
  return {
    taskIds: [...taskSet] as Id<"tasks">[],
    courseIds: [...courseSet] as Id<"userCourses">[],
  };
}

/**
 * Whether to show the task entity picker for RUD when the task agent asks for clarification.
 * Uses the latest user line when it matches `message`; otherwise falls back to “any task tag in window”.
 */
export function shouldOfferTaskEntityMcq(
  needsEntityClarification: boolean,
  historyAsc: readonly TaggedMessageView[],
  message: string,
): boolean {
  if (!needsEntityClarification) return false;
  const trimmed = message.trim();
  if (!trimmed) {
    return walkLatestTaggedTaskId(historyAsc) === undefined;
  }
  const lastUser = getLastUserMessage(historyAsc);
  if (lastUser && lastUser.content.trim() === trimmed) {
    return lastUser.taskId === undefined;
  }
  return walkLatestTaggedTaskId(historyAsc) === undefined;
}
