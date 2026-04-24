/** Shared course enums for Convex HTTP validation and Mastra prompts (single source of truth). */

export const STUDY_GOALS = ["Just pass", "Do well", "Ace it"] as const;
export type StudyGoal = (typeof STUDY_GOALS)[number];

export const GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
  "IP",
  "S",
  "U",
  "NG",
] as const;
export type Grade = (typeof GRADES)[number];

export const STUDY_GOAL_SET = new Set<string>(STUDY_GOALS);
export const GRADE_SET = new Set<string>(GRADES);
