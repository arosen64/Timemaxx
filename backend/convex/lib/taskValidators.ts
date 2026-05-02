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

export const taskStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed")
);

export const reasoningTraceValidator = v.object({
  classes: v.string(),
  tasks: v.string(),
  chats: v.string(),
  profile: v.string(),
});

/** Fields present on both tasks and subtasks — spread into each table definition. */
export const sharedTaskFields = {
  userId: v.id("users"),
  title: v.string(),
  description: v.string(),
  taskType: v.string(),
  timeEstimate: v.optional(v.number()),
  estimateFeedbackRating: v.optional(v.union(v.literal("up"), v.literal("down"))),
  correctedEstimateMinutes: v.optional(v.number()),
  estimateFeedbackSubmittedAt: v.optional(v.number()),
  courseId: v.optional(v.id("userCourses")),
  classTag: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
  reasoning: v.optional(reasoningTraceValidator),
  status: taskStatusValidator,
  createdAt: v.number(),
};
