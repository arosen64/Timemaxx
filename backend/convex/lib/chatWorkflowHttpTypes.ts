/** Mirrors the output schema of chatWorkflow in mastra/src/mastra/workflows/chatWorkflow.ts */

export type ChatWorkflowOutput = {
  reply: string;
  route: string | null;
  status: 
    | "reply" 
    | "domain_clarify" 
    | "needs_task_mcq" 
    | "needs_class_mcq" 
    | "task_action" 
    | "course_action" 
    | "schedule_action" 
    | "canned";
  mcqQueryText: string | null;
  needsClassAfterTask: boolean;
  actionType:
    | "create_task"
    | "update_task"
    | "delete_task"
    | "read_task"
    | "add_course"
    | "drop_course"
    | "update_course"
    | "view_courses"
    | "schedule_task"
    | "schedule_block"
    | "unschedule_task"
    | "unschedule_block"
    | "import_google_calendar"
    | "none"
    | null;
  title: string | null;
  description: string | null;
  taskType: string | null;
  dueDateIso: string | null;
  classTag: string | null;
  deleteConfirmed: boolean;
  updatedTitle: string | null;
  updatedDescription: string | null;
  updatedTaskType: string | null;
  updatedDueDateIso: string | null;
  updatedClassTag: string | null;
  courseName: string | null;
  sisQuery: string | null;
  term: string | null;
  school: string | null;
  studyGoal: string | null;
  grade: string | null;
  difficultyRating: number | null;
  newActiveAgent: "task" | "feedback" | "preferences" | "classes" | "schedule" | null;
  clearActiveAgent: boolean;
  newTaskAgentIntent: "create" | "rud" | null;
  newCourseAgentIntent: "add" | "drop" | "view" | "update" | null;
  readyToRecord: boolean;
};

export type SisResolvedPick = {
  offeringName: string;
  title: string;
  term: string;
  school: string;
};

export type ActiveAgent = ChatWorkflowOutput["newActiveAgent"];
export type TaskAgentIntent = ChatWorkflowOutput["newTaskAgentIntent"];
export type CourseAgentIntent = ChatWorkflowOutput["newCourseAgentIntent"];
