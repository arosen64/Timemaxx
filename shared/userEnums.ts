/** Shared user-profile enums (single source of truth for frontend and backend). */

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"] as const;
export type Year = (typeof YEARS)[number];
