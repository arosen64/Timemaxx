import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  randoms: defineTable({
    value: v.string(),
    createdAt: v.number(),
  }),
});