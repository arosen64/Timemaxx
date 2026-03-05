import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

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

  // Tasks table
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: v.union(
      v.literal("Problem Set"),
      v.literal("Essay"),
      v.literal("Coding"),
      v.literal("Exam Prep")
    ),
    

    timeEstimate: v.optional(v.number()),
    // Now optional (minutes)

    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});