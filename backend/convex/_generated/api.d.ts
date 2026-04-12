/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_autoRescheduleConflicts from "../actions/autoRescheduleConflicts.js";
import type * as actions_entityResolution from "../actions/entityResolution.js";
import type * as actions_exportStudyBlocksToCalendar from "../actions/exportStudyBlocksToCalendar.js";
import type * as actions_fetchCalendarEvents from "../actions/fetchCalendarEvents.js";
import type * as actions_generateSubtasks from "../actions/generateSubtasks.js";
import type * as actions_getCalendarAvailability from "../actions/getCalendarAvailability.js";
import type * as actions_initiateGoogleCalendarOAuth from "../actions/initiateGoogleCalendarOAuth.js";
import type * as actions_jhuCourses from "../actions/jhuCourses.js";
import type * as actions_requestEstimateSubtaskTime from "../actions/requestEstimateSubtaskTime.js";
import type * as actions_requestGenerateSubtasks from "../actions/requestGenerateSubtasks.js";
import type * as actions_scheduleAllTasks from "../actions/scheduleAllTasks.js";
import type * as actions_scheduleBlock from "../actions/scheduleBlock.js";
import type * as actions_scheduleTask from "../actions/scheduleTask.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_estimateTaskTime from "../ai/estimateTaskTime.js";
import type * as ai_generateAcademicProfile from "../ai/generateAcademicProfile.js";
import type * as ai_parseTranscript from "../ai/parseTranscript.js";
import type * as ai_requestEstimateTaskTime from "../ai/requestEstimateTaskTime.js";
import type * as ai_uploadSyllabus from "../ai/uploadSyllabus.js";
import type * as auth from "../auth.js";
import type * as calendarOAuthCallback from "../calendarOAuthCallback.js";
import type * as dev_localRetrievalTest from "../dev/localRetrievalTest.js";
import type * as http from "../http.js";
import type * as http_chat from "../http_chat.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_calendarCrypto from "../lib/calendarCrypto.js";
import type * as lib_calendarFetch from "../lib/calendarFetch.js";
import type * as lib_chatChunking from "../lib/chatChunking.js";
import type * as lib_classTagUtils from "../lib/classTagUtils.js";
import type * as lib_courseColors from "../lib/courseColors.js";
import type * as lib_gcalHelpers from "../lib/gcalHelpers.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_geminiEmbedding from "../lib/geminiEmbedding.js";
import type * as lib_httpTypes from "../lib/httpTypes.js";
import type * as lib_retrieval from "../lib/retrieval.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_scheduleSlots from "../lib/scheduleSlots.js";
import type * as lib_syllabusTypes from "../lib/syllabusTypes.js";
import type * as lib_taskTypes from "../lib/taskTypes.js";
import type * as lib_taskValidators from "../lib/taskValidators.js";
import type * as mutations_calendar from "../mutations/calendar.js";
import type * as mutations_chatChunkEmbeddings from "../mutations/chatChunkEmbeddings.js";
import type * as mutations_chatChunks from "../mutations/chatChunks.js";
import type * as mutations_chatMessages from "../mutations/chatMessages.js";
import type * as mutations_chatSessions from "../mutations/chatSessions.js";
import type * as mutations_studyBlocks from "../mutations/studyBlocks.js";
import type * as mutations_subtasks from "../mutations/subtasks.js";
import type * as mutations_syllabi from "../mutations/syllabi.js";
import type * as mutations_tasks from "../mutations/tasks.js";
import type * as mutations_timeEstimate from "../mutations/timeEstimate.js";
import type * as mutations_userCourses from "../mutations/userCourses.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_calendar from "../queries/calendar.js";
import type * as queries_chatChunks from "../queries/chatChunks.js";
import type * as queries_chatMessages from "../queries/chatMessages.js";
import type * as queries_chatSessions from "../queries/chatSessions.js";
import type * as queries_studyBlocks from "../queries/studyBlocks.js";
import type * as queries_subtasks from "../queries/subtasks.js";
import type * as queries_tasks from "../queries/tasks.js";
import type * as queries_userCourses from "../queries/userCourses.js";
import type * as queries_users from "../queries/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/autoRescheduleConflicts": typeof actions_autoRescheduleConflicts;
  "actions/entityResolution": typeof actions_entityResolution;
  "actions/exportStudyBlocksToCalendar": typeof actions_exportStudyBlocksToCalendar;
  "actions/fetchCalendarEvents": typeof actions_fetchCalendarEvents;
  "actions/generateSubtasks": typeof actions_generateSubtasks;
  "actions/getCalendarAvailability": typeof actions_getCalendarAvailability;
  "actions/initiateGoogleCalendarOAuth": typeof actions_initiateGoogleCalendarOAuth;
  "actions/jhuCourses": typeof actions_jhuCourses;
  "actions/requestEstimateSubtaskTime": typeof actions_requestEstimateSubtaskTime;
  "actions/requestGenerateSubtasks": typeof actions_requestGenerateSubtasks;
  "actions/scheduleAllTasks": typeof actions_scheduleAllTasks;
  "actions/scheduleBlock": typeof actions_scheduleBlock;
  "actions/scheduleTask": typeof actions_scheduleTask;
  "ai/embeddings": typeof ai_embeddings;
  "ai/estimateTaskTime": typeof ai_estimateTaskTime;
  "ai/generateAcademicProfile": typeof ai_generateAcademicProfile;
  "ai/parseTranscript": typeof ai_parseTranscript;
  "ai/requestEstimateTaskTime": typeof ai_requestEstimateTaskTime;
  "ai/uploadSyllabus": typeof ai_uploadSyllabus;
  auth: typeof auth;
  calendarOAuthCallback: typeof calendarOAuthCallback;
  "dev/localRetrievalTest": typeof dev_localRetrievalTest;
  http: typeof http;
  http_chat: typeof http_chat;
  "lib/anthropic": typeof lib_anthropic;
  "lib/calendarCrypto": typeof lib_calendarCrypto;
  "lib/calendarFetch": typeof lib_calendarFetch;
  "lib/chatChunking": typeof lib_chatChunking;
  "lib/classTagUtils": typeof lib_classTagUtils;
  "lib/courseColors": typeof lib_courseColors;
  "lib/gcalHelpers": typeof lib_gcalHelpers;
  "lib/gemini": typeof lib_gemini;
  "lib/geminiEmbedding": typeof lib_geminiEmbedding;
  "lib/httpTypes": typeof lib_httpTypes;
  "lib/retrieval": typeof lib_retrieval;
  "lib/sanitize": typeof lib_sanitize;
  "lib/scheduleSlots": typeof lib_scheduleSlots;
  "lib/syllabusTypes": typeof lib_syllabusTypes;
  "lib/taskTypes": typeof lib_taskTypes;
  "lib/taskValidators": typeof lib_taskValidators;
  "mutations/calendar": typeof mutations_calendar;
  "mutations/chatChunkEmbeddings": typeof mutations_chatChunkEmbeddings;
  "mutations/chatChunks": typeof mutations_chatChunks;
  "mutations/chatMessages": typeof mutations_chatMessages;
  "mutations/chatSessions": typeof mutations_chatSessions;
  "mutations/studyBlocks": typeof mutations_studyBlocks;
  "mutations/subtasks": typeof mutations_subtasks;
  "mutations/syllabi": typeof mutations_syllabi;
  "mutations/tasks": typeof mutations_tasks;
  "mutations/timeEstimate": typeof mutations_timeEstimate;
  "mutations/userCourses": typeof mutations_userCourses;
  "mutations/users": typeof mutations_users;
  "queries/calendar": typeof queries_calendar;
  "queries/chatChunks": typeof queries_chatChunks;
  "queries/chatMessages": typeof queries_chatMessages;
  "queries/chatSessions": typeof queries_chatSessions;
  "queries/studyBlocks": typeof queries_studyBlocks;
  "queries/subtasks": typeof queries_subtasks;
  "queries/tasks": typeof queries_tasks;
  "queries/userCourses": typeof queries_userCourses;
  "queries/users": typeof queries_users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
