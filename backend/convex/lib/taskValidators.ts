import { v } from "convex/values";
import { TASK_TYPES, TASK_STATUSES, ESTIMATE_FEEDBACK_RATINGS } from "../../../shared/taskEnums";

/** Re-exported for backward compatibility with backend imports. */
export { TASK_TYPES };
export type { TaskType } from "../../../shared/taskEnums";

const [s0, s1, ...sRest] = TASK_STATUSES.map((s) => v.literal(s));
export const taskStatusValidator = v.union(s0, s1, ...sRest);

const [r0, r1, ...rRest] = ESTIMATE_FEEDBACK_RATINGS.map((r) => v.literal(r));
export const estimateFeedbackRatingValidator = v.union(r0, r1, ...rRest);

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
  estimateFeedbackRating: v.optional(estimateFeedbackRatingValidator),
  correctedEstimateMinutes: v.optional(v.number()),
  estimateFeedbackSubmittedAt: v.optional(v.number()),
  courseId: v.optional(v.id("userCourses")),
  classTag: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
  reasoning: v.optional(reasoningTraceValidator),
  status: taskStatusValidator,
  createdAt: v.number(),
};
