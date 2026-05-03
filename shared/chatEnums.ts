/**
 * Shared chat / agent-routing enums.
 *
 * These are the literal sets used by the chat workflow: which specialist
 * agent is currently active, and which sub-intent it has resolved to.
 * Frontend reads them to label the active agent in the chat UI; backend
 * stores them on chatSessions; Mastra returns them in workflow output.
 */

export const ACTIVE_AGENTS = [
  "task",
  "feedback",
  "preferences",
  "classes",
  "schedule",
] as const;
export type ActiveAgent = (typeof ACTIVE_AGENTS)[number];

export const TASK_AGENT_INTENTS = ["create", "rud"] as const;
export type TaskAgentIntent = (typeof TASK_AGENT_INTENTS)[number];

export const COURSE_AGENT_INTENTS = ["add", "drop", "view", "update"] as const;
export type CourseAgentIntent = (typeof COURSE_AGENT_INTENTS)[number];

/**
 * Per-message clarification intent tagged onto chatMessages and propagated
 * to chatChunks for retrieval. Mastra workflows produce these labels.
 */
export const CLARIFICATION_INTENTS = ["task_feedback", "class_difficulty", "none"] as const;
export type ClarificationIntent = (typeof CLARIFICATION_INTENTS)[number];
