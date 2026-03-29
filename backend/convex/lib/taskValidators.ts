import { v } from "convex/values";

/**
 * Built-in task types shown in UI and used for syllabus extraction.
 */
export const TASK_TYPES = [
  "Essay",
  "Problem Set",
  "Exam Prep",
  "Coding",
  "Reading",
  "Lab",
  "Presentation",
] as const;

/** TypeScript union type for built-in task types. */
export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Convex validator for persisted taskType values.
 * Accepts free-form strings so users can enter custom task types.
 */
export const taskTypeValidator = v.string();
