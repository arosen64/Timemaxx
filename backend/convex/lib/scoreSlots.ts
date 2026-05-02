// Pure deterministic scoring for candidate study slots — no Convex dependencies.

import { TIME_OF_DAY_RANGES } from "../../../shared/preferenceEnums";
import type { DeadlineBehaviorOption } from "../../../shared/preferenceEnums";

export interface ScoreBreakdown {
  timeOfDayMatch: number; // 0 or +2
  dayOfWeekMatch: number; // 0 or +1
  bufferComfort: number; // 0 or +1
  dailyLoadPenalty: number; // 0 to −3 (one per placed block on the day)
  difficultyBonus: number; // 0 or +1 (high-difficulty course + time-of-day match)
  deadlineBucketScore: number; // 0 to +2 (deadline-proximity signal from deadlineBehavior)
}

const HIGH_DIFFICULTY_THRESHOLD = 4;

// Bucket weights per deadlineBehavior setting (bucket 0 = earliest, 4 = closest to due date).
// Keys are DeadlineBehaviorOption labels from shared/preferenceEnums.ts.
// "Somewhere in between" is absent intentionally — missing key → score 0 (no signal).
const DEADLINE_BUCKET_WEIGHTS: Record<string, number[]> = {
  "I work best well in advance": [3, 3, 2, 1, 0],
  "I need the pressure of a deadline": [1, 1, 2, 3, 3],
} satisfies Partial<Record<DeadlineBehaviorOption, number[]>>;
const DEADLINE_BUCKET_MAX_WEIGHTS: Record<string, number> = Object.fromEntries(
  Object.entries(DEADLINE_BUCKET_WEIGHTS).map(([k, weights]) => [k, Math.max(...weights)])
);

export function parseTimeOfDayRanges(prefs: string[]): Array<[number, number]> {
  const ranges: Record<string, [number, number]> = TIME_OF_DAY_RANGES;
  return prefs.flatMap((p) => (ranges[p] !== undefined ? [ranges[p]] : []));
}

export function getProductivityTraits(traits: unknown): {
  dayOfWeek: string[];
  timeOfDay: string[];
  deadlineBehavior: string | undefined;
} {
  const t = traits as Record<string, unknown> | null | undefined;
  return {
    dayOfWeek: Array.isArray(t?.dayOfWeek) ? (t!.dayOfWeek as string[]) : [],
    timeOfDay: Array.isArray(t?.timeOfDay) ? (t!.timeOfDay as string[]) : [],
    deadlineBehavior: typeof t?.deadlineBehavior === "string" ? t!.deadlineBehavior : undefined,
  };
}

function getMinutesFromMidnight(startMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(new Date(startMs));
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  // hour12: false can return 24 for midnight in some runtimes
  return (h === 24 ? 0 : h) * 60 + m;
}

function getDayOfWeek(startMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(
    new Date(startMs)
  );
}

/** Pre-computes the time-of-day fields for a slot so callers can cache them
 *  across multiple blocks scored against the same pool. */
export function getSlotTimeInfo(
  startMs: number,
  timezone: string
): { dayOfWeek: string; minutesFromMidnight: number } {
  return {
    dayOfWeek: getDayOfWeek(startMs, timezone),
    minutesFromMidnight: getMinutesFromMidnight(startMs, timezone),
  };
}

/**
 * Scores a single candidate slot against the user's soft preferences.
 * Pure function — deterministic, no I/O, no Convex deps.
 *
 * Scoring rubric:
 *   +2  time-of-day match (slot falls within any preferred time window)
 *   +1  day-of-week match (slot falls on a preferred day)
 *   +1  buffer comfort (>15 min gap on both sides of the slot)
 *   −1  per placed block on the same calendar date, max −3
 *   +1  difficulty bonus (course difficultyRating ≥ HIGH_DIFFICULTY_THRESHOLD AND time-of-day match;
 *       never fires when the user has no time-of-day preferences)
 */
export function scoreCandidate(opts: {
  startMs: number;
  timezone: string;
  precomputed?: { dayOfWeek: string; minutesFromMidnight: number };
  timeOfDayRanges: Array<[number, number]>;
  dayOfWeekPrefs: string[];
  minutesSincePreviousEvent: number | null;
  minutesUntilNextEvent: number | null;
  dailyLoadCount: number;
  difficultyRating?: number;
  deadlineBehavior?: string;
  dueDateMs?: number;
  nowMs?: number;
}): { score: number; scoreBreakdown: ScoreBreakdown } {
  const minFromMidnight =
    opts.precomputed?.minutesFromMidnight ?? getMinutesFromMidnight(opts.startMs, opts.timezone);
  const dayOfWeek = opts.precomputed?.dayOfWeek ?? getDayOfWeek(opts.startMs, opts.timezone);

  const timeOfDayMatch =
    opts.timeOfDayRanges.length > 0 &&
    opts.timeOfDayRanges.some(([start, end]) => minFromMidnight >= start && minFromMidnight < end)
      ? 2
      : 0;

  const dayOfWeekMatch =
    opts.dayOfWeekPrefs.length > 0 && opts.dayOfWeekPrefs.includes(dayOfWeek) ? 1 : 0;

  const bufferComfort =
    (opts.minutesSincePreviousEvent === null || opts.minutesSincePreviousEvent > 15) &&
    (opts.minutesUntilNextEvent === null || opts.minutesUntilNextEvent > 15)
      ? 1
      : 0;

  const dailyLoadPenalty = opts.dailyLoadCount <= 0 ? 0 : Math.max(-3, -opts.dailyLoadCount);

  const difficultyBonus =
    opts.difficultyRating !== undefined &&
    opts.difficultyRating >= HIGH_DIFFICULTY_THRESHOLD &&
    timeOfDayMatch > 0
      ? 1
      : 0;

  let deadlineBucketScore = 0;
  const weights = opts.deadlineBehavior
    ? DEADLINE_BUCKET_WEIGHTS[opts.deadlineBehavior]
    : undefined;
  if (
    weights &&
    opts.dueDateMs !== undefined &&
    opts.nowMs !== undefined &&
    opts.dueDateMs > opts.nowMs
  ) {
    const bucketWidth = (opts.dueDateMs - opts.nowMs) / 5;
    const bucketIndex = Math.min(4, Math.floor((opts.startMs - opts.nowMs) / bucketWidth));
    const maxWeight = DEADLINE_BUCKET_MAX_WEIGHTS[opts.deadlineBehavior!];
    deadlineBucketScore = Math.round((weights[Math.max(0, bucketIndex)] / maxWeight) * 2);
  }

  const score =
    timeOfDayMatch +
    dayOfWeekMatch +
    bufferComfort +
    dailyLoadPenalty +
    difficultyBonus +
    deadlineBucketScore;

  return {
    score,
    scoreBreakdown: {
      timeOfDayMatch,
      dayOfWeekMatch,
      bufferComfort,
      dailyLoadPenalty,
      difficultyBonus,
      deadlineBucketScore,
    },
  };
}
