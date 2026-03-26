import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { taskTypeValidator } from "./lib/taskValidators";

export default defineSchema({
  ...authTables,

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
    difficultSubjects: v.optional(v.array(v.string())),
    enjoyedSubjects: v.optional(v.array(v.string())),
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
          available: v.array(v.number()),
          blocked: v.array(v.number()),
        })
      )
    ),

    productivityTraits: v.optional(v.any()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // UserCourses table — per-user course enrollment records
  userCourses: defineTable({
    userId: v.id("users"),
    courseCode: v.string(), //e.g. "EN.501.303 (SIS Code)"
    title: v.string(),
    credits: v.optional(v.number()),
    term: v.string(),
    grade: v.optional(v.string()),
    studyGoal: v.optional(v.string()),
    difficultyRating: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseCode"])
    .index("by_user_term", ["userId", "term"]),

  // Tasks table
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: taskTypeValidator,
    timeEstimate: v.optional(v.number()),
    estimateFeedbackRating: v.optional(v.union(v.literal("up"), v.literal("down"))),
    correctedEstimateMinutes: v.optional(v.number()),
    estimateFeedbackSubmittedAt: v.optional(v.number()),
    dueDate: v.number(),
    createdAt: v.number(),
    extractedFrom: v.optional(v.id("syllabi")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // Syllabi table — tracks uploaded syllabus files and their processing status
  syllabi: defineTable({
    userId: v.id("users"),
    fileName: v.string(),
    courseName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
});