/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _workaround from "../_workaround.js";
import type * as actions_autoRescheduleConflicts from "../actions/autoRescheduleConflicts.js";
import type * as actions_fetchCalendarEvents from "../actions/fetchCalendarEvents.js";
import type * as actions_getCalendarAvailability from "../actions/getCalendarAvailability.js";
import type * as actions_initiateGoogleCalendarOAuth from "../actions/initiateGoogleCalendarOAuth.js";
import type * as actions_jhuCourses from "../actions/jhuCourses.js";
import type * as ai_estimateTaskTime from "../ai/estimateTaskTime.js";
import type * as ai_generateAcademicProfile from "../ai/generateAcademicProfile.js";
import type * as ai_parseTranscript from "../ai/parseTranscript.js";
import type * as ai_requestEstimateTaskTime from "../ai/requestEstimateTaskTime.js";
import type * as ai_uploadSyllabus from "../ai/uploadSyllabus.js";
import type * as auth from "../auth.js";
import type * as calendarOAuthCallback from "../calendarOAuthCallback.js";
import type * as chatAgent from "../chatAgent.js";
import type * as http from "../http.js";
import type * as lib_calendarCrypto from "../lib/calendarCrypto.js";
import type * as lib_classTagUtils from "../lib/classTagUtils.js";
import type * as lib_courseColors from "../lib/courseColors.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_syllabusTypes from "../lib/syllabusTypes.js";
import type * as lib_taskValidators from "../lib/taskValidators.js";
import type * as mutations_calendar from "../mutations/calendar.js";
import type * as mutations_chatMessages from "../mutations/chatMessages.js";
import type * as mutations_studyBlocks from "../mutations/studyBlocks.js";
import type * as mutations_subtasks from "../mutations/subtasks.js";
import type * as mutations_syllabi from "../mutations/syllabi.js";
import type * as mutations_tasks from "../mutations/tasks.js";
import type * as mutations_timeEstimate from "../mutations/timeEstimate.js";
import type * as mutations_userCourses from "../mutations/userCourses.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_calendar from "../queries/calendar.js";
import type * as queries_chatMessages from "../queries/chatMessages.js";
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
  _workaround: typeof _workaround;
  "actions/autoRescheduleConflicts": typeof actions_autoRescheduleConflicts;
  "actions/fetchCalendarEvents": typeof actions_fetchCalendarEvents;
  "actions/getCalendarAvailability": typeof actions_getCalendarAvailability;
  "actions/initiateGoogleCalendarOAuth": typeof actions_initiateGoogleCalendarOAuth;
  "actions/jhuCourses": typeof actions_jhuCourses;
  "ai/estimateTaskTime": typeof ai_estimateTaskTime;
  "ai/generateAcademicProfile": typeof ai_generateAcademicProfile;
  "ai/parseTranscript": typeof ai_parseTranscript;
  "ai/requestEstimateTaskTime": typeof ai_requestEstimateTaskTime;
  "ai/uploadSyllabus": typeof ai_uploadSyllabus;
  auth: typeof auth;
  calendarOAuthCallback: typeof calendarOAuthCallback;
  chatAgent: typeof chatAgent;
  http: typeof http;
  "lib/calendarCrypto": typeof lib_calendarCrypto;
  "lib/classTagUtils": typeof lib_classTagUtils;
  "lib/courseColors": typeof lib_courseColors;
  "lib/gemini": typeof lib_gemini;
  "lib/sanitize": typeof lib_sanitize;
  "lib/syllabusTypes": typeof lib_syllabusTypes;
  "lib/taskValidators": typeof lib_taskValidators;
  "mutations/calendar": typeof mutations_calendar;
  "mutations/chatMessages": typeof mutations_chatMessages;
  "mutations/studyBlocks": typeof mutations_studyBlocks;
  "mutations/subtasks": typeof mutations_subtasks;
  "mutations/syllabi": typeof mutations_syllabi;
  "mutations/tasks": typeof mutations_tasks;
  "mutations/timeEstimate": typeof mutations_timeEstimate;
  "mutations/userCourses": typeof mutations_userCourses;
  "mutations/users": typeof mutations_users;
  "queries/calendar": typeof queries_calendar;
  "queries/chatMessages": typeof queries_chatMessages;
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

export declare const components: {
  mastra: {
    storage: {
      messages: {
        deleteThread: FunctionReference<
          "mutation",
          "internal",
          { threadId: string },
          null
        >;
        getMessagesPage: FunctionReference<
          "query",
          "internal",
          {
            selectBy?: {
              include?: Array<{
                id: string;
                withNextMessages?: number;
                withPreviousMessages?: number;
              }>;
              last?: number | false;
              vectorSearchString?: string;
            };
            threadId: string;
          },
          Array<{
            content:
              | string
              | Array<
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "text";
                    }
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      image: string | ArrayBuffer;
                      mimeType?: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "image";
                    }
                  | {
                      data: string | ArrayBuffer;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      mimeType: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "file";
                    }
                >
              | string
              | Array<
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "text";
                    }
                  | {
                      data: string | ArrayBuffer;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      mimeType: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "file";
                    }
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "reasoning";
                    }
                  | {
                      data: string;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "redacted-reasoning";
                    }
                  | {
                      args: any;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-call";
                    }
                >
              | Array<{
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  experimental_providerMetadata?: Record<
                    string,
                    Record<string, any>
                  >;
                  isError?: boolean;
                  providerOptions?: Record<string, Record<string, any>>;
                  result: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
            createdAt: number;
            id: string;
            role: "system" | "user" | "assistant" | "tool";
            threadId: string;
            type: "text" | "tool-call" | "tool-result";
          }>
        >;
        getThreadById: FunctionReference<
          "query",
          "internal",
          { threadId: string },
          {
            createdAt: number;
            id: string;
            metadata?: Record<string, any>;
            resourceId: string;
            title?: string;
            updatedAt: number;
          } | null
        >;
        getThreadsByResourceId: FunctionReference<
          "query",
          "internal",
          { cursor?: string | null; resourceId: string },
          {
            continueCursor: string;
            isDone: boolean;
            threads: Array<{
              createdAt: number;
              id: string;
              metadata?: Record<string, any>;
              resourceId: string;
              title?: string;
              updatedAt: number;
            }>;
          }
        >;
        saveMessages: FunctionReference<
          "mutation",
          "internal",
          {
            messages: Array<{
              content:
                | string
                | Array<
                    | {
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        providerOptions?: Record<string, Record<string, any>>;
                        text: string;
                        type: "text";
                      }
                    | {
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        image: string | ArrayBuffer;
                        mimeType?: string;
                        providerOptions?: Record<string, Record<string, any>>;
                        type: "image";
                      }
                    | {
                        data: string | ArrayBuffer;
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        mimeType: string;
                        providerOptions?: Record<string, Record<string, any>>;
                        type: "file";
                      }
                  >
                | string
                | Array<
                    | {
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        providerOptions?: Record<string, Record<string, any>>;
                        text: string;
                        type: "text";
                      }
                    | {
                        data: string | ArrayBuffer;
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        mimeType: string;
                        providerOptions?: Record<string, Record<string, any>>;
                        type: "file";
                      }
                    | {
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        providerOptions?: Record<string, Record<string, any>>;
                        text: string;
                        type: "reasoning";
                      }
                    | {
                        data: string;
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        providerOptions?: Record<string, Record<string, any>>;
                        type: "redacted-reasoning";
                      }
                    | {
                        args: any;
                        experimental_providerMetadata?: Record<
                          string,
                          Record<string, any>
                        >;
                        providerOptions?: Record<string, Record<string, any>>;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-call";
                      }
                  >
                | Array<{
                    experimental_content?: Array<
                      | { text: string; type: "text" }
                      | { data: string; mimeType?: string; type: "image" }
                    >;
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    isError?: boolean;
                    providerOptions?: Record<string, Record<string, any>>;
                    result: any;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-result";
                  }>;
              createdAt: number;
              id: string;
              role: "system" | "user" | "assistant" | "tool";
              threadId: string;
              type: "text" | "tool-call" | "tool-result";
            }>;
          },
          null
        >;
        saveThread: FunctionReference<
          "mutation",
          "internal",
          {
            thread: {
              createdAt: number;
              id: string;
              metadata?: Record<string, any>;
              resourceId: string;
              title?: string;
              updatedAt: number;
            };
          },
          null
        >;
        updateThread: FunctionReference<
          "mutation",
          "internal",
          { metadata?: Record<string, any>; threadId: string; title?: string },
          {
            createdAt: number;
            id: string;
            metadata?: Record<string, any>;
            resourceId: string;
            title?: string;
            updatedAt: number;
          }
        >;
      };
      storage: {
        batchInsert: FunctionReference<
          "mutation",
          "internal",
          { records: Array<any>; tableName: string },
          null
        >;
        clearTable: FunctionReference<
          "action",
          "internal",
          { tableName: string },
          null
        >;
        getEvalsByAgentName: FunctionReference<
          "query",
          "internal",
          { agentName: string; type?: "test" | "live" },
          Array<{
            agentName: string;
            createdAt: number;
            globalRunId: string;
            input: string;
            instructions: string;
            metricName: string;
            output: string;
            result: any;
            runId: string;
            testInfo?: any;
          }>
        >;
        getTracesPage: FunctionReference<
          "query",
          "internal",
          {
            attributes?: Record<string, string>;
            cursor: string | null;
            name?: string;
            numItems: number;
            scope?: string;
          },
          {
            continuCursor: string;
            isDone: boolean;
            page: Array<{
              attributes?: any;
              createdAt: number;
              endTime: bigint;
              events?: any;
              id: string;
              kind: number | bigint;
              links?: any;
              name: string;
              other?: string;
              parentSpanId?: string | null;
              scope: string;
              startTime: bigint;
              status?: any;
              traceId: string;
            }>;
          }
        >;
        insert: FunctionReference<
          "mutation",
          "internal",
          { document: any; tableName: string },
          null
        >;
        load: FunctionReference<
          "query",
          "internal",
          { keys: any; tableName: string },
          any | null
        >;
        loadSnapshot: FunctionReference<
          "query",
          "internal",
          { runId: string; workflowName: string },
          {
            createdAt: number;
            runId: string;
            snapshot: string;
            updatedAt: number;
            workflowName: string;
          } | null
        >;
      };
    };
    vector: {
      vector: {
        createIndex: FunctionReference<
          "mutation",
          "internal",
          {
            dimensions:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1536
              | 2048
              | 3072
              | 4096;
            indexName: string;
          },
          null
        >;
        deleteIndex: FunctionReference<
          "action",
          "internal",
          { indexName: string },
          null
        >;
        describeIndex: FunctionReference<
          "query",
          "internal",
          { indexName: string },
          {
            count: number;
            dimension: 128 | 256 | 512 | 768 | 1024 | 1536 | 2048 | 3072 | 4096;
            metric: "cosine";
          }
        >;
        listIndexes: FunctionReference<"query", "internal", {}, Array<string>>;
        search: FunctionReference<
          "action",
          "internal",
          {
            filter?: Record<string, any>;
            includeVector?: boolean;
            indexName: string;
            queryVector: Array<number>;
            topK: number;
          },
          Array<{
            id: string;
            metadata?: Record<string, any>;
            score: number;
            vector?: Array<number>;
          }>
        >;
        upsert: FunctionReference<
          "mutation",
          "internal",
          {
            ids?: Array<string>;
            indexName: string;
            metadata?: Array<Record<string, any>>;
            vectors: Array<Array<number>>;
          },
          Array<string>
        >;
      };
    };
    workflow: {
      index: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            workflow: { fnHandle: string; fnName: string };
            workpoolLogLevel:
              | "DEBUG"
              | "TRACE"
              | "INFO"
              | "REPORT"
              | "WARN"
              | "ERROR";
          },
          string
        >;
        resume: FunctionReference<
          "mutation",
          "internal",
          { resumeData?: any; stepId: string; workflowId: string },
          null
        >;
        start: FunctionReference<
          "mutation",
          "internal",
          { triggerData?: any; workflowId: string },
          null
        >;
        status: FunctionReference<
          "query",
          "internal",
          { workflowId: string },
          null | {
            activeBranches?: Array<{
              target:
                | { branch: string; id: string; index: number; kind: "default" }
                | {
                    branch: string;
                    event: string;
                    id: string;
                    index: number;
                    kind: "subscriber";
                  };
              workId: string;
            }>;
            status: "created" | "pending" | "started" | "finished";
            stepStates?: Array<{
              _creationTime: number;
              _id: string;
              id: string;
              order: number;
              orderAtStart: number;
              state:
                | { status: "waiting" }
                | { status: "suspended"; suspendPayload?: any }
                | { status: "skipped" }
                | { output?: any; status: "success" }
                | { error: string; status: "failed" };
              workflowId: string;
            }>;
          }
        >;
      };
    };
  };
};
