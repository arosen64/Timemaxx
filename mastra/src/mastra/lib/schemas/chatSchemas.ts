import { z } from "zod";

export const chatContextSchema = z.object({
  message: z.string(),
  historyText: z.string(),
  taggedEntitiesBlock: z.string(),
  hasCourseTag: z.boolean(),
  taggedTaskId: z.string().nullable(),
  taggedCourseId: z.string().nullable(),
  today: z.string(),
  activeAgent: z.enum(["task", "feedback", "preferences", "classes", "schedule"]).nullable(),
  taskAgentIntent: z.enum(["create", "rud"]).nullable(),
  courseAgentIntent: z.enum(["add", "drop", "view", "update"]).nullable(),
});

// routerStep passes all context through plus the routing decision
export const routedContextSchema = chatContextSchema.extend({
  route: z.string().nullable(),
  needsDomainClarification: z.boolean(),
  domainClarifyingQuestion: z.string().nullable(),
});

export const chatWorkflowOutputSchema = z.object({
  reply: z.string(),
  route: z.string().nullable(),
  status: z.enum(["reply", "domain_clarify", "needs_task_mcq", "needs_class_mcq", "task_action", "course_action", "schedule_action", "canned"]),
  mcqQueryText: z.string().nullable(),
  needsClassAfterTask: z.boolean(),
  actionType: z.enum([
    "create_task", 
    "update_task", 
    "delete_task", 
    "read_task", 
    "add_course", 
    "drop_course", 
    "update_course", 
    "view_courses", 
    "schedule_task",
    "schedule_block",
    "unschedule_task",
    "unschedule_block",
    "import_google_calendar",
    "none"
  ]).nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  taskType: z.string().nullable(),
  dueDateIso: z.string().nullable(),
  classTag: z.string().nullable(),
  deleteConfirmed: z.boolean(),
  updatedTitle: z.string().nullable(),
  updatedDescription: z.string().nullable(),
  updatedTaskType: z.string().nullable(),
  updatedDueDateIso: z.string().nullable(),
  updatedClassTag: z.string().nullable(),
  courseName: z.string().nullable(),
  sisQuery: z.string().nullable(),
  term: z.string().nullable(),
  school: z.string().nullable(),
  studyGoal: z.string().nullable(),
  grade: z.string().nullable(),
  difficultyRating: z.number().nullable(),
  newActiveAgent: z.enum(["task", "feedback", "preferences", "classes", "schedule"]).nullable(),
  clearActiveAgent: z.boolean(),
  newTaskAgentIntent: z.enum(["create", "rud"]).nullable(),
  newCourseAgentIntent: z.enum(["add", "drop", "view", "update"]).nullable(),
  readyToRecord: z.boolean(),
});

export type ChatWorkflowOutput = z.infer<typeof chatWorkflowOutputSchema>;
