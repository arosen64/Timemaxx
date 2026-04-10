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
import type * as actions_exportStudyBlocksToCalendar from "../actions/exportStudyBlocksToCalendar.js";
import type * as actions_fetchCalendarEvents from "../actions/fetchCalendarEvents.js";
import type * as actions_getCalendarAvailability from "../actions/getCalendarAvailability.js";
import type * as actions_initiateGoogleCalendarOAuth from "../actions/initiateGoogleCalendarOAuth.js";
import type * as actions_jhuCourses from "../actions/jhuCourses.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_estimateTaskTime from "../ai/estimateTaskTime.js";
import type * as ai_generateAcademicProfile from "../ai/generateAcademicProfile.js";
import type * as ai_parseTranscript from "../ai/parseTranscript.js";
import type * as ai_requestEstimateTaskTime from "../ai/requestEstimateTaskTime.js";
import type * as ai_uploadSyllabus from "../ai/uploadSyllabus.js";
import type * as auth from "../auth.js";
import type * as calendarOAuthCallback from "../calendarOAuthCallback.js";
import type * as http from "../http.js";
import type * as lib_calendarCrypto from "../lib/calendarCrypto.js";
import type * as lib_classTagUtils from "../lib/classTagUtils.js";
import type * as lib_courseColors from "../lib/courseColors.js";
import type * as lib_gcalHelpers from "../lib/gcalHelpers.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_syllabusTypes from "../lib/syllabusTypes.js";
import type * as lib_taskValidators from "../lib/taskValidators.js";
import type * as mutations_calendar from "../mutations/calendar.js";
import type * as mutations_studyBlocks from "../mutations/studyBlocks.js";
import type * as mutations_subtasks from "../mutations/subtasks.js";
import type * as mutations_syllabi from "../mutations/syllabi.js";
import type * as mutations_tasks from "../mutations/tasks.js";
import type * as mutations_timeEstimate from "../mutations/timeEstimate.js";
import type * as mutations_userCourses from "../mutations/userCourses.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_calendar from "../queries/calendar.js";
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
  "actions/exportStudyBlocksToCalendar": typeof actions_exportStudyBlocksToCalendar;
  "actions/fetchCalendarEvents": typeof actions_fetchCalendarEvents;
  "actions/getCalendarAvailability": typeof actions_getCalendarAvailability;
  "actions/initiateGoogleCalendarOAuth": typeof actions_initiateGoogleCalendarOAuth;
  "actions/jhuCourses": typeof actions_jhuCourses;
  "ai/embeddings": typeof ai_embeddings;
  "ai/estimateTaskTime": typeof ai_estimateTaskTime;
  "ai/generateAcademicProfile": typeof ai_generateAcademicProfile;
  "ai/parseTranscript": typeof ai_parseTranscript;
  "ai/requestEstimateTaskTime": typeof ai_requestEstimateTaskTime;
  "ai/uploadSyllabus": typeof ai_uploadSyllabus;
  auth: typeof auth;
  calendarOAuthCallback: typeof calendarOAuthCallback;
  http: typeof http;
  "lib/calendarCrypto": typeof lib_calendarCrypto;
  "lib/classTagUtils": typeof lib_classTagUtils;
  "lib/courseColors": typeof lib_courseColors;
  "lib/gcalHelpers": typeof lib_gcalHelpers;
  "lib/gemini": typeof lib_gemini;
  "lib/sanitize": typeof lib_sanitize;
  "lib/syllabusTypes": typeof lib_syllabusTypes;
  "lib/taskValidators": typeof lib_taskValidators;
  "mutations/calendar": typeof mutations_calendar;
  "mutations/studyBlocks": typeof mutations_studyBlocks;
  "mutations/subtasks": typeof mutations_subtasks;
  "mutations/syllabi": typeof mutations_syllabi;
  "mutations/tasks": typeof mutations_tasks;
  "mutations/timeEstimate": typeof mutations_timeEstimate;
  "mutations/userCourses": typeof mutations_userCourses;
  "mutations/users": typeof mutations_users;
  "queries/calendar": typeof queries_calendar;
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
