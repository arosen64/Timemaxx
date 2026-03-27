/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_estimateTaskTime from "../actions/estimateTaskTime.js";
import type * as actions_fetchCalendarEvents from "../actions/fetchCalendarEvents.js";
import type * as actions_initiateGoogleCalendarOAuth from "../actions/initiateGoogleCalendarOAuth.js";
import type * as actions_jhuCourses from "../actions/jhuCourses.js";
import type * as actions_parseTranscript from "../actions/parseTranscript.js";
import type * as actions_requestEstimateTaskTime from "../actions/requestEstimateTaskTime.js";
import type * as actions_uploadSyllabus from "../actions/uploadSyllabus.js";
import type * as auth from "../auth.js";
import type * as calendarOAuthCallback from "../calendarOAuthCallback.js";
import type * as http from "../http.js";
import type * as lib_calendarCrypto from "../lib/calendarCrypto.js";
import type * as lib_syllabusTypes from "../lib/syllabusTypes.js";
import type * as lib_taskValidators from "../lib/taskValidators.js";
import type * as mutations_calendar from "../mutations/calendar.js";
import type * as mutations_syllabi from "../mutations/syllabi.js";
import type * as mutations_tasks from "../mutations/tasks.js";
import type * as mutations_timeEstimate from "../mutations/timeEstimate.js";
import type * as mutations_userCourses from "../mutations/userCourses.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_calendar from "../queries/calendar.js";
import type * as queries_tasks from "../queries/tasks.js";
import type * as queries_userCourses from "../queries/userCourses.js";
import type * as queries_users from "../queries/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/estimateTaskTime": typeof actions_estimateTaskTime;
  "actions/fetchCalendarEvents": typeof actions_fetchCalendarEvents;
  "actions/initiateGoogleCalendarOAuth": typeof actions_initiateGoogleCalendarOAuth;
  "actions/jhuCourses": typeof actions_jhuCourses;
  "actions/parseTranscript": typeof actions_parseTranscript;
  "actions/requestEstimateTaskTime": typeof actions_requestEstimateTaskTime;
  "actions/uploadSyllabus": typeof actions_uploadSyllabus;
  auth: typeof auth;
  calendarOAuthCallback: typeof calendarOAuthCallback;
  http: typeof http;
  "lib/calendarCrypto": typeof lib_calendarCrypto;
  "lib/syllabusTypes": typeof lib_syllabusTypes;
  "lib/taskValidators": typeof lib_taskValidators;
  "mutations/calendar": typeof mutations_calendar;
  "mutations/syllabi": typeof mutations_syllabi;
  "mutations/tasks": typeof mutations_tasks;
  "mutations/timeEstimate": typeof mutations_timeEstimate;
  "mutations/userCourses": typeof mutations_userCourses;
  "mutations/users": typeof mutations_users;
  "queries/calendar": typeof queries_calendar;
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
