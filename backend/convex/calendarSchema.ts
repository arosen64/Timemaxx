import { defineTable } from "convex/server";
import { v } from "convex/values";

export const calendarTables = {
  // Stores encrypted Google Calendar OAuth tokens per user
  calendarTokens: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Short-lived state tokens used to identify users during the OAuth callback
  calendarOAuthStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),
};
