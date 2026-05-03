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
import type * as actions_generateSubtasks from "../actions/generateSubtasks.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_estimateSubtasksBatch from "../ai/estimateSubtasksBatch.js";
import type * as ai_estimateTaskTime from "../ai/estimateTaskTime.js";
import type * as ai_generateAcademicProfile from "../ai/generateAcademicProfile.js";
import type * as ai_parseTranscript from "../ai/parseTranscript.js";
import type * as ai_requestEstimateTaskTime from "../ai/requestEstimateTaskTime.js";
import type * as ai_uploadSyllabus from "../ai/uploadSyllabus.js";
import type * as auth from "../auth.js";
import type * as calendarOAuthCallback from "../calendarOAuthCallback.js";
import type * as dev_localRetrievalTest from "../dev/localRetrievalTest.js";
import type * as functions_exportStudyBlocksToCalendar from "../functions/exportStudyBlocksToCalendar.js";
import type * as functions_fetchCalendarEvents from "../functions/fetchCalendarEvents.js";
import type * as functions_getCalendarAvailability from "../functions/getCalendarAvailability.js";
import type * as functions_initiateGoogleCalendarOAuth from "../functions/initiateGoogleCalendarOAuth.js";
import type * as functions_jhuCourses from "../functions/jhuCourses.js";
import type * as functions_requestEstimateSubtaskTime from "../functions/requestEstimateSubtaskTime.js";
import type * as functions_requestGenerateSubtasks from "../functions/requestGenerateSubtasks.js";
import type * as functions_scheduleAllBlocks from "../functions/scheduleAllBlocks.js";
import type * as functions_scheduleBlock from "../functions/scheduleBlock.js";
import type * as functions_scheduleSubtask from "../functions/scheduleSubtask.js";
import type * as http from "../http.js";
import type * as http_chat from "../http_chat.js";
import type * as lib_aiObservability from "../lib/aiObservability.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_calendarCrypto from "../lib/calendarCrypto.js";
import type * as lib_calendarFetch from "../lib/calendarFetch.js";
import type * as lib_chatChunking from "../lib/chatChunking.js";
import type * as lib_chatEntityActions from "../lib/chatEntityActions.js";
import type * as lib_chatEntityContext from "../lib/chatEntityContext.js";
import type * as lib_chatValidators from "../lib/chatValidators.js";
import type * as lib_chatWorkflowHttpTypes from "../lib/chatWorkflowHttpTypes.js";
import type * as lib_classTagUtils from "../lib/classTagUtils.js";
import type * as lib_courseColors from "../lib/courseColors.js";
import type * as lib_entityCandidates from "../lib/entityCandidates.js";
import type * as lib_executeCourseAction from "../lib/executeCourseAction.js";
import type * as lib_executeScheduleAction from "../lib/executeScheduleAction.js";
import type * as lib_gcalHelpers from "../lib/gcalHelpers.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_geminiEmbedding from "../lib/geminiEmbedding.js";
import type * as lib_httpTypes from "../lib/httpTypes.js";
import type * as lib_mastraClient from "../lib/mastraClient.js";
import type * as lib_messageTaggedScope from "../lib/messageTaggedScope.js";
import type * as lib_retrieval from "../lib/retrieval.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_scheduleSlots from "../lib/scheduleSlots.js";
import type * as lib_scoreSlots from "../lib/scoreSlots.js";
import type * as lib_sisEntityTokens from "../lib/sisEntityTokens.js";
import type * as lib_syllabusTypes from "../lib/syllabusTypes.js";
import type * as lib_taskTypes from "../lib/taskTypes.js";
import type * as lib_taskValidators from "../lib/taskValidators.js";
import type * as lib_terms from "../lib/terms.js";
import type * as lib_userValidators from "../lib/userValidators.js";
import type * as lib_withTimeout from "../lib/withTimeout.js";
import type * as mutations_aiCallLogs from "../mutations/aiCallLogs.js";
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
import type * as queries_aiCallLogs from "../queries/aiCallLogs.js";
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
  "actions/generateSubtasks": typeof actions_generateSubtasks;
  "ai/embeddings": typeof ai_embeddings;
  "ai/estimateSubtasksBatch": typeof ai_estimateSubtasksBatch;
  "ai/estimateTaskTime": typeof ai_estimateTaskTime;
  "ai/generateAcademicProfile": typeof ai_generateAcademicProfile;
  "ai/parseTranscript": typeof ai_parseTranscript;
  "ai/requestEstimateTaskTime": typeof ai_requestEstimateTaskTime;
  "ai/uploadSyllabus": typeof ai_uploadSyllabus;
  auth: typeof auth;
  calendarOAuthCallback: typeof calendarOAuthCallback;
  "dev/localRetrievalTest": typeof dev_localRetrievalTest;
  "functions/exportStudyBlocksToCalendar": typeof functions_exportStudyBlocksToCalendar;
  "functions/fetchCalendarEvents": typeof functions_fetchCalendarEvents;
  "functions/getCalendarAvailability": typeof functions_getCalendarAvailability;
  "functions/initiateGoogleCalendarOAuth": typeof functions_initiateGoogleCalendarOAuth;
  "functions/jhuCourses": typeof functions_jhuCourses;
  "functions/requestEstimateSubtaskTime": typeof functions_requestEstimateSubtaskTime;
  "functions/requestGenerateSubtasks": typeof functions_requestGenerateSubtasks;
  "functions/scheduleAllBlocks": typeof functions_scheduleAllBlocks;
  "functions/scheduleBlock": typeof functions_scheduleBlock;
  "functions/scheduleSubtask": typeof functions_scheduleSubtask;
  http: typeof http;
  http_chat: typeof http_chat;
  "lib/aiObservability": typeof lib_aiObservability;
  "lib/anthropic": typeof lib_anthropic;
  "lib/calendarCrypto": typeof lib_calendarCrypto;
  "lib/calendarFetch": typeof lib_calendarFetch;
  "lib/chatChunking": typeof lib_chatChunking;
  "lib/chatEntityActions": typeof lib_chatEntityActions;
  "lib/chatEntityContext": typeof lib_chatEntityContext;
  "lib/chatValidators": typeof lib_chatValidators;
  "lib/chatWorkflowHttpTypes": typeof lib_chatWorkflowHttpTypes;
  "lib/classTagUtils": typeof lib_classTagUtils;
  "lib/courseColors": typeof lib_courseColors;
  "lib/entityCandidates": typeof lib_entityCandidates;
  "lib/executeCourseAction": typeof lib_executeCourseAction;
  "lib/executeScheduleAction": typeof lib_executeScheduleAction;
  "lib/gcalHelpers": typeof lib_gcalHelpers;
  "lib/gemini": typeof lib_gemini;
  "lib/geminiEmbedding": typeof lib_geminiEmbedding;
  "lib/httpTypes": typeof lib_httpTypes;
  "lib/mastraClient": typeof lib_mastraClient;
  "lib/messageTaggedScope": typeof lib_messageTaggedScope;
  "lib/retrieval": typeof lib_retrieval;
  "lib/sanitize": typeof lib_sanitize;
  "lib/scheduleSlots": typeof lib_scheduleSlots;
  "lib/scoreSlots": typeof lib_scoreSlots;
  "lib/sisEntityTokens": typeof lib_sisEntityTokens;
  "lib/syllabusTypes": typeof lib_syllabusTypes;
  "lib/taskTypes": typeof lib_taskTypes;
  "lib/taskValidators": typeof lib_taskValidators;
  "lib/terms": typeof lib_terms;
  "lib/userValidators": typeof lib_userValidators;
  "lib/withTimeout": typeof lib_withTimeout;
  "mutations/aiCallLogs": typeof mutations_aiCallLogs;
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
  "queries/aiCallLogs": typeof queries_aiCallLogs;
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
