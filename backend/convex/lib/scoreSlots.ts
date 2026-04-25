// Pure deterministic scoring for candidate study slots — no Convex dependencies.

export interface ScoreBreakdown {
  timeOfDayMatch: number;    // 0 or +2
  dayOfWeekMatch: number;    // 0 or +1
  bufferComfort: number;     // 0 or +1
  dailyLoadPenalty: number;  // 0 to −3 (one per occupied interval on the day)
  difficultyBonus: number;   // 0 or +1 (high-difficulty course + time-of-day match)
}

// Label strings from PreferencesForm.tsx → [startMinFromMidnight, endMinFromMidnight)
const TIME_OF_DAY_RANGES: Record<string, [number, number]> = {
  "Early Morning (5–8am)": [300, 480],
  "Morning (8–11am)": [480, 660],
  "Midday (11am–2pm)": [660, 840],
  "Afternoon (2–5pm)": [840, 1020],
  "Evening (5–8pm)": [1020, 1200],
  "Night (8–11pm)": [1200, 1380],
  "Late Night (11pm+)": [1380, 1440],
};

export function parseTimeOfDayRanges(prefs: string[]): Array<[number, number]> {
  return prefs.flatMap((p) => (TIME_OF_DAY_RANGES[p] !== undefined ? [TIME_OF_DAY_RANGES[p]] : []));
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
    new Date(startMs),
  );
}

/**
 * Scores a single candidate slot against the user's soft preferences.
 * Pure function — deterministic, no I/O, no Convex deps.
 *
 * Scoring rubric:
 *   +2  time-of-day match (slot falls within any preferred time window)
 *   +1  day-of-week match (slot falls on a preferred day)
 *   +1  buffer comfort (>15 min gap on both sides of the slot)
 *   −1  per existing occupied interval on the same calendar date, max −3
 *   +1  difficulty bonus (course difficultyRating ≥ 4 AND time-of-day match)
 */
export function scoreCandidate(opts: {
  startMs: number;
  timezone: string;
  timeOfDayRanges: Array<[number, number]>;
  dayOfWeekPrefs: string[];
  minutesSincePreviousEvent: number | null;
  minutesUntilNextEvent: number | null;
  dailyLoadCount: number;
  difficultyRating?: number;
}): { score: number; scoreBreakdown: ScoreBreakdown } {
  const minFromMidnight = getMinutesFromMidnight(opts.startMs, opts.timezone);
  const dayOfWeek = getDayOfWeek(opts.startMs, opts.timezone);

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
    opts.difficultyRating !== undefined && opts.difficultyRating >= 4 && timeOfDayMatch > 0 ? 1 : 0;

  const score = timeOfDayMatch + dayOfWeekMatch + bufferComfort + dailyLoadPenalty + difficultyBonus;

  return {
    score,
    scoreBreakdown: { timeOfDayMatch, dayOfWeekMatch, bufferComfort, dailyLoadPenalty, difficultyBonus },
  };
}
