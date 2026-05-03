/** Shared task enums and types (single source of truth for frontend, backend, and Mastra). */

export const TASK_TYPES = [
  "Essay",
  "Problem Set",
  "Exam Prep",
  "Coding",
  "Reading",
  "Lab",
  "Presentation",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ESTIMATE_FEEDBACK_RATINGS = ["up", "down"] as const;
export type EstimateFeedbackRating = (typeof ESTIMATE_FEEDBACK_RATINGS)[number];

/** Per-category AI explanation for a task time estimate. */
export type ReasoningTrace = {
  classes: string;
  tasks: string;
  chats: string;
  profile: string;
};
