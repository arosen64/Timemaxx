/**
 * Scheduling Workflow Eval
 *
 * Evaluates whether the schedulingWorkflow (LLM slot selection via Claude Sonnet)
 * reliably picks a high-quality slot index from a pre-scored candidate list.
 *
 * Each scenario provides a pre-built batch prompt and an "acceptable" set of
 * slot indices (the top-N by score). The scorer checks that the workflow's
 * selection falls in the acceptable set.
 *
 * Requires: ANTHROPIC_API_KEY set in the environment.
 * Run: npm run eval  (from mastra/)
 */

import { schedulingWorkflow } from "../mastra/workflows/schedulingWorkflow";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioResult {
  name: string;
  passed: boolean;
  selections: number[];
  acceptable: number[][];
  detail: string;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt(
  blocks: Array<{
    taskTitle: string;
    dueDate: string;
    doNotScheduleBefore?: string;
    candidates: Array<{
      index: number;
      startTime: string;
      dayOfWeek: string;
      score: number;
      scoreBreakdown: Record<string, number>;
      previousEventTitle: string | null;
      minutesSincePreviousEvent: number | null;
      nextEventTitle: string | null;
      minutesUntilNextEvent: number | null;
    }>;
  }>,
  productivityPreferences: Record<string, unknown>
): string {
  const blocksJson = blocks.map((b, i) => {
    const { doNotScheduleBefore, ...rest } = b;
    return {
      blockIndex: i,
      ...rest,
      ...(doNotScheduleBefore !== undefined ? { doNotScheduleBefore } : {}),
    };
  });
  const sections = [
    `<productivity_preferences>\n${JSON.stringify(productivityPreferences, null, 2)}\n</productivity_preferences>`,
    `<blocks>\n${JSON.stringify(blocksJson, null, 2)}\n</blocks>`,
  ];
  return `Select the best slot index for each study block. Return one integer per block in the same order as the input.\n\n${sections.join("\n\n")}`;
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

// Scenario 1: Clear winner
// Block has 5 candidates. Slot 0 dominates with score=6 (all bonuses).
// All other slots score ≤ 2 and have tight buffers or off-peak times.
// Acceptable: only slot 0.
const scenario1 = {
  name: "clear-winner: highest-scored slot selected",
  prompt: buildPrompt(
    [
      {
        taskTitle: "Write Literature Review",
        dueDate: "May 9, 2026, 11:59 PM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-05T09:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: 6,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 1,
              deadlineBucketScore: 1,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-05T22:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: 1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: "Study group",
            minutesSincePreviousEvent: 10,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 2,
            startTime: "2026-05-06T14:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: 2,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: -1,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: "Lecture",
            minutesSincePreviousEvent: 30,
            nextEventTitle: "Office hours",
            minutesUntilNextEvent: 45,
          },
          {
            index: 3,
            startTime: "2026-05-07T23:00:00.000Z",
            dayOfWeek: "Thursday",
            score: 0,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: -3,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 4,
            startTime: "2026-05-08T01:00:00.000Z",
            dayOfWeek: "Friday",
            score: 1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: "Evening event",
            minutesSincePreviousEvent: 5,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: ["Morning (8–11am)"],
      dayOfWeek: ["Monday", "Tuesday", "Wednesday"],
      deadlineBehavior: "I work best well in advance",
    }
  ),
  // Only slot 0 is acceptable — it clearly dominates
  acceptable: [[0]],
};

// Scenario 2: Deadline-pressure student
// A student who prefers to work close to deadlines. Slots are sorted so that
// slot 0 is furthest from the due date (low deadlineBucketScore) and slots 3-4
// are closest (high deadlineBucketScore). Acceptable: indices 2, 3, or 4.
const scenario2 = {
  name: "deadline-pressure: selects a late-bucket slot",
  prompt: buildPrompt(
    [
      {
        taskTitle: "Problem Set 4",
        dueDate: "May 10, 2026, 11:59 PM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-03T10:00:00.000Z",
            dayOfWeek: "Sunday",
            score: 1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-05T10:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: 2,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 2,
            startTime: "2026-05-07T10:00:00.000Z",
            dayOfWeek: "Thursday",
            score: 3,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 3,
            startTime: "2026-05-09T10:00:00.000Z",
            dayOfWeek: "Saturday",
            score: 3,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 4,
            startTime: "2026-05-10T09:00:00.000Z",
            dayOfWeek: "Sunday",
            score: 3,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: [],
      dayOfWeek: [],
      deadlineBehavior: "I need the pressure of a deadline",
    }
  ),
  // Slots 2, 3, 4 all share the highest deadline bucket score
  acceptable: [[2, 3, 4]],
};

// Scenario 3: Multi-block batch
// Three blocks with different optimal slots. Tests that the LLM handles a
// multi-block batch and returns one index per block in order.
// Acceptable per block: [0], [1], [0 or 1]
const scenario3 = {
  name: "multi-block batch: correct index per block",
  prompt: buildPrompt(
    [
      {
        // Block 0: slot 0 wins (score=5 vs score=1)
        taskTitle: "Read Chapter 12",
        dueDate: "May 6, 2026, 5:00 PM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-05T09:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: 5,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 1,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-05T21:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: 1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: "Club meeting",
            minutesSincePreviousEvent: 5,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
      {
        // Block 1: slot 1 wins (score=4 vs score=0)
        taskTitle: "Exam Review",
        dueDate: "May 8, 2026, 8:00 AM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-06T23:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: 0,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -3,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: "Dinner",
            minutesSincePreviousEvent: 10,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-07T10:00:00.000Z",
            dayOfWeek: "Thursday",
            score: 4,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
      {
        // Block 2: tie — slots 0 and 1 both have score=3, both acceptable
        taskTitle: "Draft Outline",
        dueDate: "May 12, 2026, 11:59 PM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-06T09:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: 3,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-06T14:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: 3,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: ["Morning (8–11am)"],
      dayOfWeek: ["Monday", "Tuesday", "Thursday"],
      deadlineBehavior: "Somewhere in between",
    }
  ),
  // per-block acceptable sets: block 0 → [0], block 1 → [1], block 2 → [0, 1]
  acceptable: [[0], [1], [0, 1]],
};

// Scenario 4: Winner is last index
// Slot 0 is the worst candidate (late night, tight buffer, overloaded day).
// Slot 4 is the clear winner (preferred hours, comfortable buffer, score=5).
// Tests that the model doesn't have positional bias toward index 0.
const scenario4 = {
  name: "positional-bias: winner is last index (4)",
  prompt: buildPrompt(
    [
      {
        taskTitle: "Stats Problem Set",
        dueDate: "May 10, 2026, 11:59 PM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-05T02:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: -2,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -3,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: "Late night study session",
            minutesSincePreviousEvent: 8,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-05T22:30:00.000Z",
            dayOfWeek: "Tuesday",
            score: 0,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -1,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: "Club meeting",
            minutesSincePreviousEvent: 5,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 2,
            startTime: "2026-05-06T20:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: 1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: -1,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: "Dinner",
            minutesUntilNextEvent: 12,
          },
          {
            index: 3,
            startTime: "2026-05-07T14:00:00.000Z",
            dayOfWeek: "Thursday",
            score: 2,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 2,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 4,
            startTime: "2026-05-08T09:00:00.000Z",
            dayOfWeek: "Friday",
            score: 5,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 1,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: ["Morning (8–11am)"],
      dayOfWeek: ["Monday", "Friday"],
      deadlineBehavior: "Somewhere in between",
    }
  ),
  acceptable: [[4]],
};

// Scenario 5: doNotScheduleBefore constraint
// Slots 0 and 1 both have higher scores than slot 2, but they fall before the
// doNotScheduleBefore date. The model must respect the constraint and pick slot 2.
const scenario5 = {
  name: "doNotScheduleBefore: ignores higher-scored early slots",
  prompt: buildPrompt(
    [
      {
        taskTitle: "Project Proposal Draft",
        dueDate: "May 15, 2026, 11:59 PM",
        doNotScheduleBefore: "2026-05-06T00:00:00.000Z",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-04T09:00:00.000Z", // before constraint
            dayOfWeek: "Sunday",
            score: 6,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 1,
              deadlineBucketScore: 1,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 1,
            startTime: "2026-05-05T10:00:00.000Z", // before constraint
            dayOfWeek: "Monday",
            score: 4,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 1,
              bufferComfort: 1,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 2,
            startTime: "2026-05-06T10:00:00.000Z", // on/after constraint
            dayOfWeek: "Tuesday",
            score: 2,
            scoreBreakdown: {
              timeOfDayMatch: 2,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: 0,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: null,
            minutesSincePreviousEvent: null,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: ["Morning (8–11am)"],
      dayOfWeek: ["Monday", "Tuesday"],
      deadlineBehavior: "I work best well in advance",
    }
  ),
  acceptable: [[2]],
};

// Scenario 6: All-negative scores (overloaded week)
// Every slot has a negative score due to daily load penalties and tight buffers.
// The model should still pick the least-bad option (slot 1, score=-1) rather
// than defaulting to index 0 (score=-3).
const scenario6 = {
  name: "all-negative scores: picks least-bad slot",
  prompt: buildPrompt(
    [
      {
        taskTitle: "Weekly Reading",
        dueDate: "May 9, 2026, 9:00 AM",
        candidates: [
          {
            index: 0,
            startTime: "2026-05-05T21:00:00.000Z",
            dayOfWeek: "Tuesday",
            score: -3,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -3,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: "Evening lecture",
            minutesSincePreviousEvent: 10,
            nextEventTitle: "Study group",
            minutesUntilNextEvent: 8,
          },
          {
            index: 1,
            startTime: "2026-05-06T19:00:00.000Z",
            dayOfWeek: "Wednesday",
            score: -1,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -1,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: "Lab section",
            minutesSincePreviousEvent: 8,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
          {
            index: 2,
            startTime: "2026-05-07T22:00:00.000Z",
            dayOfWeek: "Thursday",
            score: -2,
            scoreBreakdown: {
              timeOfDayMatch: 0,
              dayOfWeekMatch: 0,
              bufferComfort: 0,
              dailyLoadPenalty: -2,
              difficultyBonus: 0,
              deadlineBucketScore: 0,
            },
            previousEventTitle: "Dinner with friends",
            minutesSincePreviousEvent: 12,
            nextEventTitle: null,
            minutesUntilNextEvent: null,
          },
        ],
      },
    ],
    {
      timeOfDay: [],
      dayOfWeek: [],
      deadlineBehavior: "Somewhere in between",
    }
  ),
  acceptable: [[1]],
};

const SCENARIOS = [scenario1, scenario2, scenario3, scenario4, scenario5, scenario6];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runScenario(scenario: (typeof SCENARIOS)[number]): Promise<ScenarioResult> {
  const run = await schedulingWorkflow.createRun();
  const result = await run.start({ inputData: { prompt: scenario.prompt } });

  if (result.status !== "success") {
    return {
      name: scenario.name,
      passed: false,
      selections: [],
      acceptable: scenario.acceptable,
      detail: `workflow status: ${result.status}`,
    };
  }

  const { selections } = result.result;

  // Each block's selection must appear in the corresponding acceptable set
  const blockResults = scenario.acceptable.map((acceptableSet, i) => ({
    block: i,
    selected: selections[i],
    acceptable: acceptableSet,
    ok: acceptableSet.includes(selections[i] ?? -1),
  }));

  const passed = blockResults.every((b) => b.ok);
  const failDetail = blockResults
    .filter((b) => !b.ok)
    .map((b) => `block ${b.block}: selected ${b.selected}, acceptable [${b.acceptable.join(",")}]`)
    .join("; ");

  return {
    name: scenario.name,
    passed,
    selections,
    acceptable: scenario.acceptable,
    detail: passed ? "all blocks within acceptable set" : failDetail,
  };
}

export async function runSchedulingEval(): Promise<{
  scores: Record<string, number>;
  summary: { totalItems: number };
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  (skipped — ANTHROPIC_API_KEY not set)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  const results: ScenarioResult[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  [${scenario.name}] running... `);
    try {
      const r = await runScenario(scenario);
      results.push(r);
      console.log(r.passed ? "PASS" : `FAIL — ${r.detail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        name: scenario.name,
        passed: false,
        selections: [],
        acceptable: scenario.acceptable,
        detail: msg,
      });
      console.log(`ERROR — ${msg}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const passRate = total > 0 ? passed / total : 0;

  console.log(
    `\n  Result: ${passed}/${total} scenarios passed (pass rate: ${(passRate * 100).toFixed(0)}%)`
  );

  const scores = Object.fromEntries(results.map((r) => [r.name, r.passed ? 1 : 0]));
  return { scores, summary: { totalItems: total } };
}
