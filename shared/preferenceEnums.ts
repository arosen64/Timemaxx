/**
 * Shared productivity-trait preference enums.
 *
 * The frontend renders these as selectable labels in PreferencesForm; the
 * backend uses the same strings as keys when scoring candidate study slots.
 * Keeping the labels and the time-of-day ranges co-located prevents drift.
 */

export const TIME_OF_DAY_OPTIONS = [
  "Early Morning (5–8am)",
  "Morning (8–11am)",
  "Midday (11am–2pm)",
  "Afternoon (2–5pm)",
  "Evening (5–8pm)",
  "Night (8–11pm)",
  "Late Night (11pm+)",
] as const;
export type TimeOfDayOption = (typeof TIME_OF_DAY_OPTIONS)[number];

/** Inclusive-start, exclusive-end minute-from-midnight ranges per time-of-day label. */
export const TIME_OF_DAY_RANGES: Record<TimeOfDayOption, [number, number]> = {
  "Early Morning (5–8am)": [300, 480],
  "Morning (8–11am)": [480, 660],
  "Midday (11am–2pm)": [660, 840],
  "Afternoon (2–5pm)": [840, 1020],
  "Evening (5–8pm)": [1020, 1200],
  "Night (8–11pm)": [1200, 1380],
  "Late Night (11pm+)": [1380, 1440],
};

export const WORK_SESSION_STYLE_OPTIONS = [
  "Short bursts (25–30 min)",
  "Medium sessions (45–60 min)",
  "Long deep work (2+ hours)",
  "Varies by task",
] as const;
export type WorkSessionStyleOption = (typeof WORK_SESSION_STYLE_OPTIONS)[number];

export const DEADLINE_BEHAVIOR_OPTIONS = [
  "I work best well in advance",
  "I need the pressure of a deadline",
  "Somewhere in between",
] as const;
export type DeadlineBehaviorOption = (typeof DEADLINE_BEHAVIOR_OPTIONS)[number];

/** Minimum allowed value for a user's focus block length, in minutes. */
export const MIN_FOCUS_BLOCK_MINUTES = 15;
