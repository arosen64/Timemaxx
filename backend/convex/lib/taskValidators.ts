import { v } from "convex/values";

/**
 * Single source of truth for all valid task types.
 * Used to build the Convex validator, the TypeScript type, and runtime checks.
 */
export const TASK_TYPES = [
  "Problem Set",
  "Essay",
  "Coding",
  "Exam Prep",
] as const;

/** TypeScript union type for taskType. */
export type TaskType = (typeof TASK_TYPES)[number];

/** Convex validator for the taskType field, shared across schema, mutations, and actions. */
const taskTypeLiterals = TASK_TYPES.map((t) => v.literal(t));
export const taskTypeValidator = v.union(...taskTypeLiterals);
