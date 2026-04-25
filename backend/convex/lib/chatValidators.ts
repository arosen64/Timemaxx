import { v } from "convex/values";

/** Convex validator for the activeAgent field on chatSessions. */
export const activeAgentValidator = v.union(
  v.literal("task"),
  v.literal("feedback"),
  v.literal("preferences"),
  v.literal("classes"),
  v.literal("schedule"),
);

export type ActiveAgent = "task" | "feedback" | "preferences" | "classes" | "schedule";
