import { describe, it, expect } from "vitest";
import {
  parseTimeOfDayRanges,
  scoreCandidate,
  buildSlotDailyLoadMap,
  dateStrLocal,
} from "../lib/scoreSlots";

const TZ = "America/New_York";

// Helper: build a timestamp for a given weekday + hour in ET (non-DST week: 2026-01-05 Mon)
function etMs(isoDate: string, hour: number, minute = 0): number {
  // isoDate = "2026-01-05" (Monday)
  return new Date(`${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`).getTime();
}

const MON = "2026-01-05"; // Monday
const TUE = "2026-01-06"; // Tuesday
const SAT = "2026-01-10"; // Saturday

// Slot at 9am Monday — within "Morning (8–11am)" window, on a Monday
const slot9amMon = etMs(MON, 9);
// Slot at 2pm Tuesday — within "Afternoon (2–5pm)" window, on a Tuesday
const slot2pmTue = etMs(TUE, 14);
// Slot at 11pm Saturday — within "Night (8–11pm)" window (just before boundary)
const slot10pmSat = etMs(SAT, 22);
// Slot at 6am Monday — "Early Morning (5–8am)"
const slot6amMon = etMs(MON, 6);

describe("parseTimeOfDayRanges", () => {
  it("maps all known labels to correct minute ranges", () => {
    const ranges = parseTimeOfDayRanges([
      "Early Morning (5–8am)",
      "Morning (8–11am)",
      "Midday (11am–2pm)",
      "Afternoon (2–5pm)",
      "Evening (5–8pm)",
      "Night (8–11pm)",
      "Late Night (11pm+)",
    ]);
    expect(ranges).toEqual([
      [300, 480],
      [480, 660],
      [660, 840],
      [840, 1020],
      [1020, 1200],
      [1200, 1380],
      [1380, 1440],
    ]);
  });

  it("drops unknown labels silently", () => {
    const ranges = parseTimeOfDayRanges(["Morning (8–11am)", "Nonexistent"]);
    expect(ranges).toEqual([[480, 660]]);
  });

  it("returns empty array for empty prefs", () => {
    expect(parseTimeOfDayRanges([])).toEqual([]);
  });
});

describe("dateStrLocal", () => {
  it("returns YYYY-MM-DD in the given timezone", () => {
    // 2026-01-05 09:00 ET
    expect(dateStrLocal(slot9amMon, TZ)).toBe("2026-01-05");
  });
});

describe("buildSlotDailyLoadMap", () => {
  it("counts intervals per date", () => {
    const intervals = [
      { startMs: slot9amMon },
      { startMs: etMs(MON, 14) },
      { startMs: slot2pmTue },
    ];
    const map = buildSlotDailyLoadMap(intervals, TZ);
    expect(map.get("2026-01-05")).toBe(2);
    expect(map.get("2026-01-06")).toBe(1);
  });

  it("returns empty map for no intervals", () => {
    expect(buildSlotDailyLoadMap([], TZ).size).toBe(0);
  });
});

describe("scoreCandidate", () => {
  const baseOpts = {
    timezone: TZ,
    timeOfDayRanges: parseTimeOfDayRanges(["Morning (8–11am)"]),
    dayOfWeekPrefs: ["Monday", "Wednesday"],
    minutesSincePreviousEvent: null,
    minutesUntilNextEvent: null,
    dailyLoadCount: 0,
    difficultyRating: undefined,
  };

  it("awards +2 for time-of-day match", () => {
    const { score, scoreBreakdown } = scoreCandidate({ ...baseOpts, startMs: slot9amMon });
    expect(scoreBreakdown.timeOfDayMatch).toBe(2);
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it("awards 0 for time-of-day miss", () => {
    const { scoreBreakdown } = scoreCandidate({ ...baseOpts, startMs: slot2pmTue });
    expect(scoreBreakdown.timeOfDayMatch).toBe(0);
  });

  it("awards +1 for day-of-week match", () => {
    const { scoreBreakdown } = scoreCandidate({ ...baseOpts, startMs: slot9amMon });
    expect(scoreBreakdown.dayOfWeekMatch).toBe(1);
  });

  it("awards 0 for day-of-week miss", () => {
    const { scoreBreakdown } = scoreCandidate({ ...baseOpts, startMs: slot2pmTue });
    expect(scoreBreakdown.dayOfWeekMatch).toBe(0);
  });

  it("awards +1 buffer comfort when both gaps are null (no surrounding events)", () => {
    const { scoreBreakdown } = scoreCandidate({ ...baseOpts, startMs: slot9amMon });
    expect(scoreBreakdown.bufferComfort).toBe(1);
  });

  it("awards +1 buffer comfort when both gaps exceed 15 min", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      minutesSincePreviousEvent: 30,
      minutesUntilNextEvent: 20,
    });
    expect(scoreBreakdown.bufferComfort).toBe(1);
  });

  it("awards 0 buffer comfort when previous gap is ≤15 min", () => {
    const { scoreBreakdown } = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      minutesSincePreviousEvent: 10,
      minutesUntilNextEvent: null,
    });
    expect(scoreBreakdown.bufferComfort).toBe(0);
  });

  it("applies daily load penalty of -1 per interval, capped at -3", () => {
    const { scoreBreakdown: sb1 } = scoreCandidate({ ...baseOpts, startMs: slot9amMon, dailyLoadCount: 1 });
    expect(sb1.dailyLoadPenalty).toBe(-1);

    const { scoreBreakdown: sb3 } = scoreCandidate({ ...baseOpts, startMs: slot9amMon, dailyLoadCount: 3 });
    expect(sb3.dailyLoadPenalty).toBe(-3);

    const { scoreBreakdown: sb5 } = scoreCandidate({ ...baseOpts, startMs: slot9amMon, dailyLoadCount: 5 });
    expect(sb5.dailyLoadPenalty).toBe(-3);
  });

  it("awards difficulty bonus only when difficultyRating ≥ 4 AND time-of-day matches", () => {
    // Match + high difficulty → +1
    const { scoreBreakdown: yes } = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      difficultyRating: 4,
    });
    expect(yes.difficultyBonus).toBe(1);

    // Match + low difficulty → 0
    const { scoreBreakdown: lowDiff } = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      difficultyRating: 3,
    });
    expect(lowDiff.difficultyBonus).toBe(0);

    // High difficulty but NO time-of-day match → 0
    const { scoreBreakdown: noTime } = scoreCandidate({
      ...baseOpts,
      startMs: slot2pmTue,
      difficultyRating: 5,
    });
    expect(noTime.difficultyBonus).toBe(0);
  });

  it("score equals sum of all breakdown components", () => {
    const result = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      dailyLoadCount: 1,
      difficultyRating: 4,
    });
    const { timeOfDayMatch, dayOfWeekMatch, bufferComfort, dailyLoadPenalty, difficultyBonus } =
      result.scoreBreakdown;
    expect(result.score).toBe(
      timeOfDayMatch + dayOfWeekMatch + bufferComfort + dailyLoadPenalty + difficultyBonus,
    );
  });

  it("scores 0 for all signals when no prefs and no load", () => {
    const { score, scoreBreakdown } = scoreCandidate({
      ...baseOpts,
      startMs: slot9amMon,
      timeOfDayRanges: [],
      dayOfWeekPrefs: [],
      dailyLoadCount: 0,
    });
    expect(scoreBreakdown.timeOfDayMatch).toBe(0);
    expect(scoreBreakdown.dayOfWeekMatch).toBe(0);
    expect(scoreBreakdown.dailyLoadPenalty).toBe(0);
    expect(scoreBreakdown.difficultyBonus).toBe(0);
    // bufferComfort is 1 (no surrounding events)
    expect(score).toBe(1);
  });

  it("handles all seven time-of-day labels correctly", () => {
    const cases: Array<[string, number, number]> = [
      ["Early Morning (5–8am)", 6, 300],   // 6am = 360 min → in [300, 480)
      ["Morning (8–11am)", 9, 480],
      ["Midday (11am–2pm)", 12, 660],
      ["Afternoon (2–5pm)", 15, 840],
      ["Evening (5–8pm)", 18, 1020],
      ["Night (8–11pm)", 21, 1200],
      ["Late Night (11pm+)", 23, 1380],
    ];
    for (const [label, hour] of cases) {
      const ranges = parseTimeOfDayRanges([label]);
      const { scoreBreakdown } = scoreCandidate({
        ...baseOpts,
        startMs: etMs(MON, hour),
        timeOfDayRanges: ranges,
        dayOfWeekPrefs: [],
      });
      expect(scoreBreakdown.timeOfDayMatch, `${label} at ${hour}h`).toBe(2);
    }
  });
});
