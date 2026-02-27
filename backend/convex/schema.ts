import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    googleId: v.string(),
    email: v.string(),
    preferredWorkHours: v.array(
      v.object({
      startHour: v.number(),
      endHour: v.number(),
    })),
    focusBlockLength: v.number(),
    onboardingComplete: v.boolean(),
  })
    .index("by_googleId", ["googleId"])
    .index("by_email", ["email"]),

  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    taskType: v.string(), 
    timeEstimate: v.number(), 
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});