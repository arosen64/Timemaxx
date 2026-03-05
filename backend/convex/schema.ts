import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,  // Google auth tables with email/phone + verification fields

  // Override users table with auth fields + your custom fields
users: defineTable({
    // Auth fields
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // My custom fields
    preferredWorkHours: v.optional(v.array(
      v.object({
        startHour: v.number(),
        endHour: v.number(),
      })
    )),
    focusBlockLength: v.optional(v.number()), 
    onboardingComplete: v.optional(v.boolean()),
  })
    .index("email", ["email"])    // Index for looking up users by email (for auth)  
    .index("phone", ["phone"])    // Index for looking up users by phone (for auth)
    ,
  // Tasks table to store user tasks with time estimates
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: v.string(),
    timeEstimate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});