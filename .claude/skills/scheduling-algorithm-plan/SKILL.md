---
name: scheduling-algorithm-plan
description: Reference plan for the R19 scheduling algorithm improvements. Use when working on any scheduling-related issue (#395, #396, #397, #398, #506, #507, #508), asking about the algorithm architecture, or deciding how a new scheduling change should fit into the overall design.
argument-hint: "issue number or scheduling topic"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Scheduling Algorithm Improvement Plan (R19 #387)

## Context

The scheduling pipeline has three phases:

- **Phase A — Block sizing:** `mutations/timeEstimate.ts` → `rebuildStudyBlocks` creates N unscheduled blocks from `timeEstimate / focusBlockLength`
- **Phase B — Slot enumeration:** `lib/scheduleSlots.ts` walks forward in 15-min steps, collecting valid candidate slots
- **Phase C — AI selection:** `selectAllSlotsWithAI()` sends candidates + `productivityTraits` to Gemini Flash; Gemini returns one index per block

Entry points: `actions/scheduleBlock.ts`, `actions/scheduleTask.ts`, `actions/scheduleAllTasks.ts`, `actions/scheduleSubtask.ts`

## Hard Constraints (enforced deterministically, before AI)

| Constraint | Where enforced |
|---|---|
| Blocked slots (`workHoursGrid[].blocked`) | `isSlotValid()` in `scheduleSlots.ts` |
| Task `dueDate` | `enumerateSlots()` / `filterPoolForBlock()` |
| `recommended_start` (added in #483/PR #509) | `enumerateSlots()` / `filterPoolForBlock()` via `recommendedStartMs` param |
| Google Calendar timed events | `occupiedIntervals` built from `fetch21DayCalendarEvents()` |
| Already-placed study blocks | `occupiedIntervals` |

## Soft Constraints (currently loose AI hints → being made deterministic)

| Constraint | Source field | Target approach |
|---|---|---|
| Spread/procrastination | `productivityTraits.deadlineBehavior` | Deterministic bucket sampling (#506) |
| Time of day | `productivityTraits.timeOfDay` | Parsed to minute ranges, scored (#507) |
| Day of week | `productivityTraits.dayOfWeek` | Scored per candidate (#507) |
| Available slots | `workHoursGrid[].available` (removed in #480/PR #494) | N/A — field removed |
| Session style | `focusBlockLength` (numeric) | Already enforced mechanically |
| Course difficulty | `userCourses.difficultyRating` | Difficulty-time bonus in scorer (#507) |
| Daily load | Derived from `occupiedIntervals` | Hard cap (#508) |

## Implementation Order (R19 open issues)

### Layer 1 — Independent algorithm changes (parallelizable)

**#395** — Add assignment weight to scheduling sort order
- File: `actions/scheduleAllTasks.ts`
- Change: multi-key sort — `dueDate ASC`, then `assignmentWeight DESC`, then `recommended_start ASC`, then `_creationTime ASC`
- Note: requires `assignmentWeight` on tasks (added in R22 #390 work)

**#506** — Replace greedy-earliest candidate enumeration with deadline-window sampling
- File: `lib/scheduleSlots.ts`
- Change: add `sampleFromWindow()` helper; replace early-break-at-20 with 5-bucket weighted sampling
- Bucket weights by `deadlineBehavior`:
  - `"Well in advance"` → `[5, 3, 1, 1, 0]`
  - `"Evenly spread"` (default) → `[1, 1, 1, 1, 1]`
  - `"Near deadline"` → `[0, 1, 2, 3, 4]`
- Thread `deadlineBehavior` from `productivityTraits` through all four scheduling actions

**#508** — Enforce daily study-block load cap
- Files: `lib/scheduleSlots.ts`, `actions/scheduleAllTasks.ts`
- Change: `buildDailyLoadMap(occupiedIntervals, timezone)` → `Map<YYYY-MM-DD, number>`; exclude slots on days at cap from candidate pool
- `maxBlocksPerDay` = `floor(availableSlotsPerDay * 30 / focusBlockLength)`, capped at 4; fallback 3 if no `workHoursGrid`
- Update map after each block is placed in the bulk-schedule loop

### Layer 2 — Scoring & prompt enrichment (after Layer 1)

**#507** — Add deterministic pre-scoring layer
- New file: `lib/scoreSlots.ts`
- Functions: `scoreCandidate()`, `parseTimeOfDayRanges()`, `buildDailyLoadMap()`
- Scoring rubric:

| Signal | Source | Points |
|---|---|---|
| Time of day match | `productivityTraits.timeOfDay` → minute ranges | +2 |
| Day of week match | `productivityTraits.dayOfWeek` | +1 |
| Buffer comfort | Both surrounding gaps > 15 min | +1 |
| Daily load penalty | Placed blocks on same calendar day | −1 each, max −3 |
| Difficulty-time bonus | `difficultyRating ≥ 4` AND time-of-day match | +1 |

- Time of day label → minute range mapping:
  - `"Morning (8–11am)"` → `[480, 660]`
  - `"Afternoon (12–4pm)"` → `[720, 960]`
  - `"Evening (5–9pm)"` → `[1020, 1260]`
  - `"Late night (9pm+)"` → `[1260, 1440]`
- Sort candidates by score descending before passing to Gemini
- `scoreCandidate()` must be a pure function (no Convex deps) for unit testability
- Thread `difficultyRating` from `userCourses` through scheduling actions

**#396** — Enrich scheduling LLM prompt with full user context
- File: `lib/prompts/scheduleBlock.prompt.ts`
- Replace raw `productivityTraits` JSON blob with structured per-candidate context:
  ```json
  {
    "index": 3,
    "startTime": "...",
    "dayOfWeek": "Saturday",
    "score": 5,
    "scoreBreakdown": { "timeOfDayMatch": 2, "dayOfWeekMatch": 1, "bufferComfort": 1, "dailyLoadPenalty": -1 },
    "dailyBlockCount": 1,
    "minutesSincePreviousEvent": 45,
    "minutesUntilNextEvent": 90
  }
  ```
- Task context block should include: `assignmentWeight`, `courseDifficulty`, `spreadPreference`, `transcriptSummary` (top insight), relevant chat context (vector search result from `chatChunks`)
- System prompt update: "Candidates are pre-scored and sorted by fit. Prefer higher scores but you may override if surrounding context makes a lower-scored slot clearly better."

### Layer 3 — Reasoning & UI (sequential)

**#397** — Add reasoning trace to Gemini scheduling response
- Files: `backend/convex/schema.ts`, `lib/prompts/scheduleBlock.prompt.ts`, `lib/scheduleSlots.ts`, `mutations/studyBlocks.ts`
- Add `schedulingReason: v.optional(v.string())` to `studyBlocks` schema
- Update `batchSlotSelectionResponseSchema` to return `{ selections: number[], reasons: string[] }`
- Persist `schedulingReason` when calling `placeStudyBlock`
- Example reason: `"Scheduled before 3 PM — your productivity peaks in the morning"`

**#398** — Display scheduling reasoning in schedule UI
- Files: frontend schedule components
- Read `schedulingReason` from study block data
- Surface via tooltip on hover or expandable detail on click
- Design must match `timemaxx.pen` — check before writing any React/CSS

## Key Files Reference

| File | Role |
|---|---|
| `backend/convex/lib/scheduleSlots.ts` | Slot enumeration, validation, AI selection orchestration |
| `backend/convex/lib/scoreSlots.ts` | **New** — deterministic candidate scorer (#507) |
| `backend/convex/lib/prompts/scheduleBlock.prompt.ts` | Gemini prompt builders for single and batch scheduling |
| `backend/convex/actions/scheduleAllTasks.ts` | Bulk scheduling action — task sort, pool extension, batch AI call |
| `backend/convex/actions/scheduleTask.ts` | Single-task scheduling action |
| `backend/convex/actions/scheduleBlock.ts` | Single-block scheduling action |
| `backend/convex/actions/scheduleSubtask.ts` | Subtask-level block scheduling |
| `backend/convex/actions/autoRescheduleConflicts.ts` | Re-schedules conflicted blocks — must receive all same params |

## What Stays LLM-Only

- **Final slot selection** from pre-scored candidates — contextual judgment on surrounding events
- **Subject switching** and **break preferences** — qualitative, pass as context strings
- **Chat context signals** — inject top vector-search result as a context hint, let LLM weight it

## Constraints Already Closed (do not re-implement)

- `recommended_start` hard constraint — done in PR #509 (closes #483)
- `workHoursGrid.available` slots removed — done in PR #494 (closes #480); `isInAvailableSlot` is now dead code
