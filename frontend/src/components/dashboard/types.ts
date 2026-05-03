import { Id } from "../../../../backend/convex/_generated/dataModel";
import { formatEstimatedTime } from "../../utils/timeUtils";
import {
  TASK_TYPES,
  type TaskStatus,
  type ReasoningTrace,
  type EstimateFeedbackRating,
} from "../../../../shared/taskEnums";

export type { TaskStatus, ReasoningTrace } from "../../../../shared/taskEnums";

export type SubtaskType = {
  _id: Id<"subtasks">;
  parentTaskId: Id<"tasks">;
  title: string;
  description: string;
  taskType: string;
  color: string;
  timeEstimate?: number;
  dueDate?: number;
  classTag?: string;
  courseId?: Id<"userCourses">;
  order: number;
  suggestedCompletionAt?: number;
  createdAt: number;
  reasoning?: ReasoningTrace;
  status?: TaskStatus;
};

export type TaskType = {
  _id: Id<"tasks">;
  title: string;
  description: string;
  taskType: string;
  timeEstimate?: number;
  isManualEstimate: boolean;
  estimateFeedbackRating?: EstimateFeedbackRating;
  correctedEstimateMinutes?: number;
  estimateFeedbackSubmittedAt?: number;
  dueDate: number;
  createdAt: number;
  classTag?: string;
  courseId?: Id<"userCourses">;
  reasoning?: ReasoningTrace;
  status?: TaskStatus;
  assignmentWeight?: number;
};

export type BuiltInTaskType = (typeof TASK_TYPES)[number];
export type SchemaTaskType = BuiltInTaskType;
/** UI-only sentinel for the "Other" choice in the task-type picker. */
export const CUSTOM_TASK_TYPE_OPTION = "Other";

/** Current-term class row for the class-tag combobox (matches Classes page course search). */
export type ClassTagCourseOption = {
  courseId: Id<"userCourses">;
  courseCode: string;
  title: string;
  /** Canonical stored task tag (dedupes catalog when title already includes OfferingName). */
  classTag: string;
};

export type EditForm = {
  title: string;
  description: string;
  taskType: string;
  dueDate: number;
  /** Set when a class tag is chosen; omit or undefined when untagged */
  courseId?: Id<"userCourses">;
  /** Empty string clears the tag on update; omit when not supported */
  classTag?: string;
  /** User-supplied time estimate in minutes; undefined means let AI estimate */
  timeEstimate?: number;
  /** True when user explicitly chose to reset to AI estimation */
  useAiEstimate?: boolean;
  /** Grade weight of this assignment (0–100). Undefined when blank. */
  assignmentWeight?: number;
  /** True when editing and user clears a previously-set grade weight. */
  clearAssignmentWeight?: boolean;
};

export const TASK_TYPE_OPTIONS: BuiltInTaskType[] = [...TASK_TYPES];

export function formatDateMMDDYYYY(ms: number) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDueDateTimeDisplay(ms: number) {
  const time = new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatDateMMDDYYYY(ms)} · ${time}`;
}

export function displayTitle(task: Pick<TaskType, "title" | "description">) {
  const t = task.title.trim();
  if (t.length > 0) return t;
  const d = task.description.trim();
  return d.length > 0 ? d : "Untitled task";
}

export function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  return formatEstimatedTime(minutes);
}

export type FeedbackDraft = {
  rating?: EstimateFeedbackRating;
  hours: string;
  minutes: string;
};

export function parseEstimationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const jsonMatch = raw.match(/(\{.+\})/s);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const inner = parsed?.error;
      if (inner?.code && inner?.message) {
        return `Error ${inner.code}: ${inner.message}`;
      }
    } catch {
      // not valid JSON — fall through
    }
  }
  return "Failed to estimate task time. Please try again.";
}
