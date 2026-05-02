import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { taskTypeValidator } from "./lib/taskValidators";
import { activeAgentValidator } from "./lib/chatValidators";

/** Per-category AI explanation for time estimates (tasks and subtasks). */
const reasoningTraceValidator = v.object({
  classes: v.string(),
  tasks: v.string(),
  chats: v.string(),
  profile: v.string(),
});

export default defineSchema({
  ...authTables,

  // Stores encrypted Google Calendar OAuth tokens and calendar preferences per user
  calendarConnections: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    selectedCalendarIds: v.optional(v.array(v.string())),
    scope: v.optional(v.string()),
    timemaxxCalendarId: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // Short-lived state tokens used to identify users during the OAuth callback
  calendarOAuthStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),

  // Users table
  users: defineTable({
    // Auth fields
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Custom onboarding fields
    onboardingComplete: v.optional(v.boolean()),
    focusBlockLength: v.optional(v.number()),
    major: v.optional(v.string()),
    year: v.optional(v.string()),
    courses: v.optional(
      v.array(
        v.object({
          title: v.string(),
          studyGoal: v.string(),
        })
      )
    ),

    workHoursGrid: v.optional(
      v.array(
        v.object({
          day: v.string(),
          blocked: v.array(v.number()),
        })
      )
    ),

    productivityTraits: v.optional(v.any()),

    transcriptSummary: v.optional(
      v.array(
        v.object({
          label: v.string(),
          text: v.string(),
        })
      )
    ),

    gcalColorMappingEnabled: v.optional(v.boolean()),

  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // UserCourses table — per-user course enrollment records
  userCourses: defineTable({
    userId: v.id("users"),
    courseCode: v.string(), //e.g. "EN.501.303 (SIS Code)"
    title: v.string(),
    description: v.optional(v.string()),
    prereqs: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
    credits: v.optional(v.number()),
    term: v.string(),
    grade: v.optional(v.string()),
    studyGoal: v.optional(v.string()),
    difficultyRating: v.optional(v.number()),
    color: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseCode"])
    .index("by_user_term", ["userId", "term"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 3072, filterFields: ["userId"] }),

  // Tasks table
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    timeEstimate: v.optional(v.number()),
    isManualEstimate: v.optional(v.boolean()),
    estimateFeedbackRating: v.optional(v.union(v.literal("up"), v.literal("down"))),
    correctedEstimateMinutes: v.optional(v.number()),
    estimateFeedbackSubmittedAt: v.optional(v.number()),
    dueDate: v.number(),
    createdAt: v.number(),
    courseId: v.optional(v.id("userCourses")),
    /** Free-text label for the course/class (optional; complements courseId) */
    classTag: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    reasoning: v.optional(reasoningTraceValidator),
    status: v.optional(v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))),
    assignmentWeight: v.optional(v.number()),
    recommendedStart: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_courseId", ["userId", "courseId"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 3072, filterFields: ["userId"] }),

  // Subtasks table — AI-generated or manually created subtasks linked to a parent task
  subtasks: defineTable({
    parentTaskId: v.id("tasks"),
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    color: v.string(),
    timeEstimate: v.optional(v.number()),
    suggestedCompletionAt: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    courseId: v.optional(v.id("userCourses")),
    classTag: v.optional(v.string()),
    estimateFeedbackRating: v.optional(v.union(v.literal("up"), v.literal("down"))),
    correctedEstimateMinutes: v.optional(v.number()),
    estimateFeedbackSubmittedAt: v.optional(v.number()),
    reasoning: v.optional(reasoningTraceValidator),
    order: v.number(),
    createdAt: v.number(),
    embedding: v.optional(v.array(v.float64())),
    status: v.optional(v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))),
  })
    .index("by_parentTaskId", ["parentTaskId"])
    .index("by_userId", ["userId"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 3072, filterFields: ["userId"] }),

  // StudyBlocks table — stores scheduled time chunks assigned to tasks or subtasks
  studyBlocks: defineTable({
    taskId: v.optional(v.id("tasks")),
    subtaskId: v.optional(v.id("subtasks")),
    userId: v.optional(v.id("users")),
    title: v.string(),
    startTime: v.optional(v.string()),
    studyBlockLength: v.number(),
    isConflicted: v.optional(v.boolean()),
    googleEventId: v.optional(v.string()),
    needsExport: v.optional(v.boolean()),
    isCompleted: v.boolean(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_subtaskId", ["subtaskId"])
    .index("by_userId", ["userId"])
    .index("by_userId_startTime", ["userId", "startTime"]),

  // Chat messages — stores chatbot conversation history per user
  chatMessages: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
    clarificationIntent: v.optional(
      v.union(
        v.literal("task_feedback"),
        v.literal("class_difficulty"),
        v.literal("none"),
      ),
    ),
    /** Copied from chatSessions at insert time when that session has resolved scope */
    taskId: v.optional(v.id("tasks")),
    courseId: v.optional(v.id("userCourses")),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_session", ["sessionId"])
    .index("by_taskId", ["taskId"])
    .index("by_courseId", ["courseId"]),

  /** Chat widget session — MCQ / subagent state (task & course scope live on chatMessages) */
  chatSessions: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    /** User message that started the active MCQ clarify flow — tagged when user picks task/class */
    entityClarifyTriggerUserMessageId: v.optional(v.id("chatMessages")),
    /** Last user utterance used for embedding search (MCQ / Other) */
    lastEntityQueryText: v.optional(v.string()),
    /** Which entity we are disambiguating in the active MCQ flow */
    activeEntityStep: v.optional(
      v.union(v.literal("task"), v.literal("class")),
    ),
    /** Supervisor said "both" — after task, prompt for class */
    needsClassAfterTask: v.optional(v.boolean()),
    clarificationAttemptCount: v.optional(v.number()),
    clarificationExhausted: v.optional(v.boolean()),
    awaitingEntityResolution: v.optional(v.boolean()),
    /** Set when the thread hits the per-session message cap (no new user messages). */
    chatInputLocked: v.optional(v.boolean()),
    /** Which specialist agent is handling this session */
    activeAgent: v.optional(
      activeAgentValidator,
    ),
    /** Intent determined by task agent: "create" skips entity MCQ, "rud" triggers it */
    taskAgentIntent: v.optional(v.union(v.literal("create"), v.literal("rud"))),
    /** Intent determined by course agent for multi-turn class conversations. */
    courseAgentIntent: v.optional(
      v.union(v.literal("add"), v.literal("drop"), v.literal("view"), v.literal("update")),
    ),
    /** Current scope for future chat message tagging. */
    activeTaskId: v.optional(v.id("tasks")),
    activeCourseId: v.optional(v.id("userCourses")),
    /** Block MCQ flow: tracks the schedule sub-intent and chosen block while awaiting a pick. */
    pendingScheduleAction: v.optional(v.literal("schedule_block")),
    activeBlockId: v.optional(v.id("studyBlocks")),
  }).index("by_userId_sessionId", ["userId", "sessionId"]),

  /**
   * Searchable transcript slices for RAG (time estimation, etc.).
   * Rebuilt from chatMessages with sliding-window overlap; embeddings added in Part 4.
   */
  chatChunks: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    text: v.string(),
    chunkIndex: v.number(),
    /** Earliest message timestamp covered by this chunk (ordering / reconstruction). */
    startCreatedAt: v.number(),
    linkedTaskIds: v.array(v.id("tasks")),
    linkedCourseIds: v.array(v.id("userCourses")),
    clarificationIntent: v.optional(
      v.union(
        v.literal("task_feedback"),
        v.literal("class_difficulty"),
        v.literal("none"),
      ),
    ),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
  })
    .index("by_userId_sessionId", ["userId", "sessionId"])
    .index("by_userId_sessionId_chunkIndex", ["userId", "sessionId", "chunkIndex"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["userId"],
    }),

  // Syllabi table — tracks uploaded syllabus files and their processing status
  syllabi: defineTable({
    userId: v.id("users"),
    fileContents: v.string(),
    courseId: v.optional(v.id("userCourses")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"]),

  /**
   * Observability log for every AI/LLM call (Gemini, Anthropic, Mastra workflows).
   * Captures prompt/response previews, latency, token usage, estimated cost, and
   * error details so we can diagnose bad outputs and track spend after the fact.
   */
  aiCallLogs: defineTable({
    /** User the call was made on behalf of (omitted for system-level batch jobs). */
    userId: v.optional(v.id("users")),
    /** Logical call site, e.g. "estimateTaskTime", "chat-workflow", "uploadSyllabus.parse". */
    callSite: v.string(),
    /** Provider: "gemini" | "anthropic" | "mastra". */
    provider: v.string(),
    /** Specific model version, e.g. "gemini-2.5-flash" or workflow id for Mastra. */
    model: v.optional(v.string()),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("timeout"),
    ),
    latencyMs: v.number(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    /** Estimated USD cost based on per-model pricing table. */
    estimatedCostUsd: v.optional(v.number()),
    /** Truncated prompt — capped to keep storage bounded. */
    promptPreview: v.optional(v.string()),
    /** Truncated response — capped to keep storage bounded. */
    responsePreview: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    /** Free-form context (taskId, subtaskId, sessionId, workflowId, etc.). */
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_callSite_createdAt", ["callSite", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
});