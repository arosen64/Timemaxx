import { v } from "convex/values";

/**
 * Suggested built-in task types for UI selection.
 */
export const TASK_TYPES = [
  "Problem Set",
  "Essay",
  "Coding",
  "Exam Prep",
  "Thesis",
] as const;

/** TypeScript union type for taskType. */
export type TaskType = (typeof TASK_TYPES)[number];

/** Backend accepts any non-empty task type string to support legacy/custom data. */
export const taskTypeValidator = v.string();
