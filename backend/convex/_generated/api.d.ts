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
import type * as actions_requestEstimateTaskTime from "../actions/requestEstimateTaskTime.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as mutations_tasks from "../mutations/tasks.js";
import type * as mutations_timeEstimate from "../mutations/timeEstimate.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_tasks from "../queries/tasks.js";
import type * as queries_users from "../queries/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/estimateTaskTime": typeof actions_estimateTaskTime;
  "actions/requestEstimateTaskTime": typeof actions_requestEstimateTaskTime;
  auth: typeof auth;
  http: typeof http;
  "mutations/tasks": typeof mutations_tasks;
  "mutations/timeEstimate": typeof mutations_timeEstimate;
  "mutations/users": typeof mutations_users;
  "queries/tasks": typeof queries_tasks;
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
