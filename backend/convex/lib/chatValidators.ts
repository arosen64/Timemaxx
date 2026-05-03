import { v } from "convex/values";
import {
  ACTIVE_AGENTS,
  TASK_AGENT_INTENTS,
  COURSE_AGENT_INTENTS,
  CLARIFICATION_INTENTS,
} from "../../../shared/chatEnums";

export type {
  ActiveAgent,
  TaskAgentIntent,
  CourseAgentIntent,
  ClarificationIntent,
} from "../../../shared/chatEnums";

const [a0, a1, ...aRest] = ACTIVE_AGENTS.map((a) => v.literal(a));
/** Convex validator for the activeAgent field on chatSessions. */
export const activeAgentValidator = v.union(a0, a1, ...aRest);

const [t0, t1, ...tRest] = TASK_AGENT_INTENTS.map((t) => v.literal(t));
export const taskAgentIntentValidator = v.union(t0, t1, ...tRest);

const [c0, c1, ...cRest] = COURSE_AGENT_INTENTS.map((c) => v.literal(c));
export const courseAgentIntentValidator = v.union(c0, c1, ...cRest);

const [i0, i1, ...iRest] = CLARIFICATION_INTENTS.map((i) => v.literal(i));
/** Validator for chatMessages.clarificationIntent and chatChunks.clarificationIntent. */
export const clarificationIntentValidator = v.union(i0, i1, ...iRest);
