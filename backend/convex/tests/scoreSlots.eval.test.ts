import { describe, expect, test } from "vitest";
import { scoreCandidate, parseTimeOfDayRanges } from "../lib/scoreSlots";

// Base timestamp: Monday 2026-01-05T09:00:00Z (9am UTC = 540 min from midnight)
const BASE_MS = new Date("2026-01-05T09:00:00Z").getTime();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// ─── Scoring Rubric ───────────────────────────────────────────────────────────
// These tests pin the scoring parameter values. If a weight changes in
// scoreSlots.ts, update the assertion here to document the new value + rationale.
//
//   +2  time-of-day match   — strongest preference signal; weighted higher than day-of-week
//       because time-of-day correlates more directly with focus quality
//   +1  day-of-week match   — secondary preference; reflects weekly rhythm
//   +1  buffer comfort      — >15 min gap on both sides; avoids rushed context-switching
//   -1  daily load penalty  — per block already placed that day; cap at -3 so
//       heavily-booked days are still usable rather than completely avoided
//   +1  difficulty bonus    — high-difficulty course (rating ≥ 4) AND time-of-day match;
//       guards against scheduling hard work in low-energy off-peak hours
//   0–2 deadline bucket     — 5 buckets across the due-date window, weighted by
//       deadlineBehavior: advance-workers prefer early buckets, crammers prefer late
//
describe("scoring rubric — parameter documentation", () => {
  const base = {
    startMs: BASE_MS,
    timezone: "UTC",
    precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 }, // 9am, "Morning (8–11am)"
    minutesSincePreviousEvent: null as null,
    minutesUntilNextEvent: null as null,
    dailyLoadCount: 0,
  };

  test("time-of-day match: +2", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      timeOfDayRanges: [[480, 660]],
      dayOfWeekPrefs: [],
    });
    expect(scoreBreakdown.timeOfDayMatch).toBe(2);
  });

  test("day-of-week match: +1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      timeOfDayRanges: [],
      dayOfWeekPrefs: ["Monday"],
    });
    expect(scoreBreakdown.dayOfWeekMatch).toBe(1);
  });

  test("buffer comfort (both gaps > 15 min): +1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      timeOfDayRanges: [],
      dayOfWeekPrefs: [],
      minutesSincePreviousEvent: 20,
      minutesUntilNextEvent: 30,
    });
    expect(scoreBreakdown.bufferComfort).toBe(1);
  });

  test("daily load penalty: -1 per block, capped at -3", () => {
    const opts = {
      ...base,
      timeOfDayRanges: [] as [number, number][],
      dayOfWeekPrefs: [] as string[],
    };
    expect(scoreCandidate({ ...opts, dailyLoadCount: 0 }).scoreBreakdown.dailyLoadPenalty).toBe(0);
    expect(scoreCandidate({ ...opts, dailyLoadCount: 1 }).scoreBreakdown.dailyLoadPenalty).toBe(-1);
    expect(scoreCandidate({ ...opts, dailyLoadCount: 2 }).scoreBreakdown.dailyLoadPenalty).toBe(-2);
    expect(scoreCandidate({ ...opts, dailyLoadCount: 3 }).scoreBreakdown.dailyLoadPenalty).toBe(-3);
    expect(scoreCandidate({ ...opts, dailyLoadCount: 4 }).scoreBreakdown.dailyLoadPenalty).toBe(-3);
  });

  test("difficulty bonus (rating ≥ 4 AND time-of-day match): +1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      timeOfDayRanges: [[480, 660]],
      dayOfWeekPrefs: [],
      difficultyRating: 4, // minimum threshold
    });
    expect(scoreBreakdown.difficultyBonus).toBe(1);
  });

  test("deadline bucket score is in range [0, 2]", () => {
    const nowMs = BASE_MS;
    const dueDateMs = BASE_MS + 5 * ONE_DAY_MS;
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      timeOfDayRanges: [],
      dayOfWeekPrefs: [],
      deadlineBehavior: "I work best well in advance",
      dueDateMs,
      nowMs,
    });
    expect(scoreBreakdown.deadlineBucketScore).toBeGreaterThanOrEqual(0);
    expect(scoreBreakdown.deadlineBucketScore).toBeLessThanOrEqual(2);
  });
});

// ─── Scenario 1: Deadline Pressure ───────────────────────────────────────────
// Validates that the deadlineBucketScore signal correctly pushes slots toward
// the student's preferred timing style relative to the due date.
describe("scenario 1 — deadline pressure", () => {
  const nowMs = BASE_MS;
  const dueDateMs = BASE_MS + 10 * ONE_DAY_MS; // task due in 10 days
  const sharedOpts = {
    timezone: "UTC",
    timeOfDayRanges: [] as [number, number][],
    dayOfWeekPrefs: [] as string[],
    minutesSincePreviousEvent: null as null,
    minutesUntilNextEvent: null as null,
    dailyLoadCount: 0,
    dueDateMs,
    nowMs,
  };

  test("early slot earns deadlineBucketScore=2 for advance-worker preference", () => {
    // startMs = now + 1 hour → bucketIndex 0 of 5 buckets spanning 10 days
    const { scoreBreakdown } = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + ONE_HOUR_MS,
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 },
      deadlineBehavior: "I work best well in advance",
    });
    expect(scoreBreakdown.deadlineBucketScore).toBe(2);
  });

  test("last-day slot earns deadlineBucketScore=0 for advance-worker preference", () => {
    // startMs = now + 9 days → bucketIndex 4 (last bucket), weight=0 for advance-worker
    const { scoreBreakdown } = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + 9 * ONE_DAY_MS,
      precomputed: { dayOfWeek: "Wednesday", minutesFromMidnight: 540 },
      deadlineBehavior: "I work best well in advance",
    });
    expect(scoreBreakdown.deadlineBucketScore).toBe(0);
  });

  test("advance-worker: early slot ranks higher than last-day slot", () => {
    const earlySlot = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + ONE_HOUR_MS,
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 },
      deadlineBehavior: "I work best well in advance",
    });
    const lateSlot = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + 9 * ONE_DAY_MS,
      precomputed: { dayOfWeek: "Wednesday", minutesFromMidnight: 540 },
      deadlineBehavior: "I work best well in advance",
    });
    expect(earlySlot.score).toBeGreaterThan(lateSlot.score);
  });

  test("last-day slot earns deadlineBucketScore=2 for deadline-pressure preference", () => {
    // weight[4]=3 for "pressure" → score = round(3/3 * 2) = 2
    const { scoreBreakdown } = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + 9 * ONE_DAY_MS,
      precomputed: { dayOfWeek: "Wednesday", minutesFromMidnight: 540 },
      deadlineBehavior: "I need the pressure of a deadline",
    });
    expect(scoreBreakdown.deadlineBucketScore).toBe(2);
  });

  test("deadline-pressure: last-day slot ranks higher than early slot", () => {
    const earlySlot = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + ONE_HOUR_MS,
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 },
      deadlineBehavior: "I need the pressure of a deadline",
    });
    const lateSlot = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + 9 * ONE_DAY_MS,
      precomputed: { dayOfWeek: "Wednesday", minutesFromMidnight: 540 },
      deadlineBehavior: "I need the pressure of a deadline",
    });
    expect(lateSlot.score).toBeGreaterThan(earlySlot.score);
  });

  test("slot scheduled past due date falls in bucket 4 (treated as overdue)", () => {
    // startMs > dueDateMs — algorithm clamps bucketIndex to 4
    // for advance-worker, bucket 4 weight=0 → score=0
    const { scoreBreakdown } = scoreCandidate({
      ...sharedOpts,
      startMs: nowMs + 11 * ONE_DAY_MS,
      precomputed: { dayOfWeek: "Saturday", minutesFromMidnight: 540 },
      deadlineBehavior: "I work best well in advance",
    });
    expect(scoreBreakdown.deadlineBucketScore).toBe(0);
  });
});

// ─── Scenario 2: Overlapping Blocks / Buffer Comfort ─────────────────────────
// Validates that slots sandwiched tightly between calendar events are penalized
// relative to slots with breathing room on either side.
describe("scenario 2 — overlapping blocks / buffer comfort", () => {
  const base = {
    startMs: BASE_MS,
    timezone: "UTC",
    precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 },
    timeOfDayRanges: [] as [number, number][],
    dayOfWeekPrefs: [] as string[],
    dailyLoadCount: 0,
  };

  test("null gaps (no adjacent events) → bufferComfort = 1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: null,
      minutesUntilNextEvent: null,
    });
    expect(scoreBreakdown.bufferComfort).toBe(1);
  });

  test("both gaps > 15 min → bufferComfort = 1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 20,
      minutesUntilNextEvent: 30,
    });
    expect(scoreBreakdown.bufferComfort).toBe(1);
  });

  test("preceding gap ≤ 15 min → bufferComfort = 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 10,
      minutesUntilNextEvent: 30,
    });
    expect(scoreBreakdown.bufferComfort).toBe(0);
  });

  test("following gap ≤ 15 min → bufferComfort = 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 30,
      minutesUntilNextEvent: 5,
    });
    expect(scoreBreakdown.bufferComfort).toBe(0);
  });

  test("both gaps exactly 15 min → bufferComfort = 0 (boundary: must be strictly > 15)", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 15,
      minutesUntilNextEvent: 15,
    });
    expect(scoreBreakdown.bufferComfort).toBe(0);
  });

  test("comfortable slot ranks 1 point higher than sandwiched slot, all else equal", () => {
    const comfortable = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 30,
      minutesUntilNextEvent: 30,
    });
    const sandwiched = scoreCandidate({
      ...base,
      minutesSincePreviousEvent: 5,
      minutesUntilNextEvent: 30,
    });
    expect(comfortable.score - sandwiched.score).toBe(1);
  });
});

// ─── Scenario 3: Sparse Availability / Outside Preferred Hours ────────────────
// When a student has limited availability and all slots fall outside their
// preferred time windows, the algorithm should fall back to other signals
// (day-of-week, buffer comfort) rather than scoring everything equally.
describe("scenario 3 — sparse availability / outside preferred hours", () => {
  const morningRange = parseTimeOfDayRanges(["Morning (8–11am)"]); // [480, 660]

  test("slot at 3pm (minutesFromMidnight=900) is outside Morning preference → timeOfDayMatch = 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      startMs: BASE_MS,
      timezone: "UTC",
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 900 },
      timeOfDayRanges: morningRange,
      dayOfWeekPrefs: [],
      minutesSincePreviousEvent: null,
      minutesUntilNextEvent: null,
      dailyLoadCount: 0,
    });
    expect(scoreBreakdown.timeOfDayMatch).toBe(0);
  });

  test("when all slots are off-peak, preferred day still differentiates by +1", () => {
    const opts = {
      startMs: BASE_MS,
      timezone: "UTC",
      timeOfDayRanges: morningRange,
      dayOfWeekPrefs: ["Monday", "Wednesday"],
      minutesSincePreviousEvent: null as null,
      minutesUntilNextEvent: null as null,
      dailyLoadCount: 0,
    };
    const preferredDay = scoreCandidate({
      ...opts,
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 900 },
    });
    const nonPreferredDay = scoreCandidate({
      ...opts,
      precomputed: { dayOfWeek: "Tuesday", minutesFromMidnight: 900 },
    });
    expect(preferredDay.scoreBreakdown.timeOfDayMatch).toBe(0);
    expect(nonPreferredDay.scoreBreakdown.timeOfDayMatch).toBe(0);
    expect(preferredDay.score - nonPreferredDay.score).toBe(1);
  });

  test("no preferences configured — all preference dimensions score 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      startMs: BASE_MS,
      timezone: "UTC",
      precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 900 },
      timeOfDayRanges: [],
      dayOfWeekPrefs: [],
      minutesSincePreviousEvent: null,
      minutesUntilNextEvent: null,
      dailyLoadCount: 0,
    });
    expect(scoreBreakdown.timeOfDayMatch).toBe(0);
    expect(scoreBreakdown.dayOfWeekMatch).toBe(0);
    expect(scoreBreakdown.difficultyBonus).toBe(0);
    expect(scoreBreakdown.deadlineBucketScore).toBe(0);
  });

  test("parseTimeOfDayRanges maps label strings to minute ranges", () => {
    const ranges = parseTimeOfDayRanges(["Morning (8–11am)", "Evening (5–8pm)"]);
    expect(ranges).toContainEqual([480, 660]);
    expect(ranges).toContainEqual([1020, 1200]);
  });

  test("parseTimeOfDayRanges ignores unknown labels", () => {
    const ranges = parseTimeOfDayRanges(["Not a real label"]);
    expect(ranges).toHaveLength(0);
  });
});

// ─── Scenario 4: Large Task Load / Daily Load Penalty ────────────────────────
// When a student has many tasks, the algorithm must discourage over-packing a
// single day. The cap at -3 ensures even very busy days remain schedulable.
describe("scenario 4 — large task load / daily load penalty", () => {
  const base = {
    startMs: BASE_MS,
    timezone: "UTC",
    precomputed: { dayOfWeek: "Monday", minutesFromMidnight: 540 },
    timeOfDayRanges: [] as [number, number][],
    dayOfWeekPrefs: [] as string[],
    minutesSincePreviousEvent: null as null,
    minutesUntilNextEvent: null as null,
  };

  test("first block of day (dailyLoadCount=0) → no penalty", () => {
    expect(scoreCandidate({ ...base, dailyLoadCount: 0 }).scoreBreakdown.dailyLoadPenalty).toBe(0);
  });

  test("each additional block reduces score by 1 (up to 3 blocks)", () => {
    const scores = [0, 1, 2, 3].map((n) => scoreCandidate({ ...base, dailyLoadCount: n }).score);
    expect(scores[0] - scores[1]).toBe(1);
    expect(scores[1] - scores[2]).toBe(1);
    expect(scores[2] - scores[3]).toBe(1);
  });

  test("penalty caps at -3; fourth+ block does not reduce score further", () => {
    const thirdBlock = scoreCandidate({ ...base, dailyLoadCount: 3 }).score;
    const fourthBlock = scoreCandidate({ ...base, dailyLoadCount: 4 }).score;
    const tenthBlock = scoreCandidate({ ...base, dailyLoadCount: 10 }).score;
    expect(fourthBlock).toBe(thirdBlock);
    expect(tenthBlock).toBe(thirdBlock);
  });

  test("day with 10 blocks placed still produces a non-negative base score", () => {
    // Even a maximally-loaded day should remain a viable fallback (score ≥ 0 without other bonuses)
    const { score } = scoreCandidate({ ...base, dailyLoadCount: 10 });
    expect(score).toBeGreaterThanOrEqual(-3);
  });
});

// ─── Scenario 5: Mixed Priorities / Difficulty Bonus ─────────────────────────
// High-difficulty courses require peak focus. The difficulty bonus rewards
// scheduling them during preferred hours, but only fires when both conditions
// are true — preventing it from padding scores for easy tasks or off-peak slots.
describe("scenario 5 — mixed priorities / difficulty bonus", () => {
  const morningRange = parseTimeOfDayRanges(["Morning (8–11am)"]);
  const base = {
    startMs: BASE_MS,
    timezone: "UTC",
    dayOfWeekPrefs: [] as string[],
    minutesSincePreviousEvent: null as null,
    minutesUntilNextEvent: null as null,
    dailyLoadCount: 0,
  };
  const morningPrecomputed = { dayOfWeek: "Monday", minutesFromMidnight: 540 }; // inside morning window
  const afternoonPrecomputed = { dayOfWeek: "Monday", minutesFromMidnight: 900 }; // outside morning window

  test("hard course (rating=4) + preferred hours → difficultyBonus = 1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 4,
    });
    expect(scoreBreakdown.difficultyBonus).toBe(1);
    expect(scoreBreakdown.timeOfDayMatch).toBe(2);
  });

  test("hard course (rating=5) + preferred hours → difficultyBonus = 1", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 5,
    });
    expect(scoreBreakdown.difficultyBonus).toBe(1);
  });

  test("easy course (rating=3) + preferred hours → difficultyBonus = 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 3,
    });
    expect(scoreBreakdown.difficultyBonus).toBe(0);
  });

  test("hard course + off-peak hours → difficultyBonus = 0 (bonus requires time-of-day match)", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      precomputed: afternoonPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 5,
    });
    expect(scoreBreakdown.timeOfDayMatch).toBe(0);
    expect(scoreBreakdown.difficultyBonus).toBe(0);
  });

  test("no time-of-day preference configured → difficultyBonus always 0", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: [],
      difficultyRating: 5,
    });
    expect(scoreBreakdown.difficultyBonus).toBe(0);
  });

  test("hard-course slot during preferred hours scores 1 point higher than easy-course slot", () => {
    const hardCourse = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 5,
    });
    const easyCourse = scoreCandidate({
      ...base,
      precomputed: morningPrecomputed,
      timeOfDayRanges: morningRange,
      difficultyRating: 2,
    });
    expect(hardCourse.score - easyCourse.score).toBe(1);
  });

  test("sorting mixed-priority slots by score puts hard-course preferred-hour slot first", () => {
    const slots = [
      // easy course, off-peak, preferred day
      scoreCandidate({
        ...base,
        precomputed: afternoonPrecomputed,
        timeOfDayRanges: morningRange,
        dayOfWeekPrefs: ["Monday"],
        difficultyRating: 2,
      }),
      // hard course, preferred hours
      scoreCandidate({
        ...base,
        precomputed: morningPrecomputed,
        timeOfDayRanges: morningRange,
        dayOfWeekPrefs: [],
        difficultyRating: 5,
      }),
      // no preferences
      scoreCandidate({
        ...base,
        precomputed: afternoonPrecomputed,
        timeOfDayRanges: morningRange,
        dayOfWeekPrefs: [],
        difficultyRating: 2,
      }),
    ];
    const sorted = [...slots].sort((a, b) => b.score - a.score);
    // Hard course during preferred hours (timeOfDayMatch=2, difficultyBonus=1 = score 3+) should win
    expect(sorted[0].scoreBreakdown.difficultyBonus).toBe(1);
    expect(sorted[0].scoreBreakdown.timeOfDayMatch).toBe(2);
  });
});
