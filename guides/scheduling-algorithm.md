# Scheduling Algorithm — Source of Truth

Last updated: issue #506 (deadline-window bucket scoring)

---

## Overview

The scheduler turns unscheduled study blocks into placed calendar events. It runs in three phases:

1. **Phase 1 — Global candidate scoring** (deterministic)
2. **Phase 2 — AI slot selection** (Mastra `scheduling-workflow` → Anthropic Claude Sonnet)
3. **Phase 3 — Placement & physical-validity fallback** (deterministic)

Entry points:

| Action | Scope |
|---|---|
| `actions/scheduleAllBlocks.ts` | Bulk: all unscheduled blocks for a task + its subtasks (max 10 per call) |
| `actions/scheduleBlock.ts` | Single block |

Both share the same slot pool and validation primitives from `lib/scheduleSlots.ts`.

---

## Phase 1 — Global candidate scoring (`scheduleAllBlocks`)

### Block processing order

Before any slot scoring begins, blocks are sorted into the order they will be processed:

```
parent due date ASC → parent assignment weight DESC → block creation time ASC
```

This means blocks whose parent task has an earlier due date are scheduled first. Among tasks with the same due date, blocks belonging to higher-weight assignments (e.g., a 40% final exam vs. a 10% homework) are prioritised. `assignmentWeight` is set on the task (0–100 scale) and populated from syllabus parsing or manually by the user. Tasks without a weight use 0 as a fallback, so any explicitly-weighted task floats above unweighted ones at the same deadline.

### Pool building

`extendSlotPool()` scans forward from `max(now, recommendedStart)` to `min(dueDate, now + 21 days)` in **15-minute increments**, adding each slot that passes `isSlotValid()` to a shared array. Slots that overlap `occupiedIntervals` (calendar events + already-placed blocks) or fall in blocked hours (`workHoursGrid[].blocked`) are excluded. The pool is extended incrementally as blocks are processed in due-date order.

### Global scoring

For each unscheduled block, **every slot in the shared pool** is evaluated. Hard constraints filter out invalid slots; the rest are scored:

```
for each slot in pool:
  skip if slot ≥ dueDate
  skip if slot + blockDurationMs > dueDate
  skip if slot < recommendedStart (when set)
  skip if not isSlotValid(slot)

  score = scoreCandidate(slot, preferences, speculativeDailyLoadMap)
  add to scoredSlots
```

Slots are then **sorted descending by score** and the top `MAX_CANDIDATES = 20` become the candidate list for Gemini. Because scoring uses `speculativeDailyLoadMap` (which grows after each block is assigned), preferred times and days naturally float to the top while already-loaded days are penalised.

This replaces the previous two-step "pick a day, then pick a time within it" approach. Day preference, time-of-day preference, and daily load spread are all expressed through the scoring rubric rather than hard gates.

### Spread via speculative load

After the top candidate is selected (i.e., after `scoredSlots.sort(...).slice(0, MAX_CANDIDATES)`), `speculativeDailyLoadMap` is incremented for that candidate's day. The next block therefore scores that day lower and is more likely to land elsewhere, producing natural spread across days without hard per-day limits.

---

## Pre-scoring layer

Implemented in `lib/scoreSlots.ts` (pure — no Convex deps). Called for every slot during Phase 1.

### Scoring rubric

| Signal | Source | Points |
|---|---|---|
| Time-of-day match | Slot falls within any of the user's preferred time windows (`productivityTraits.timeOfDay`) | +2 |
| Day-of-week match | Slot falls on a preferred day (`productivityTraits.dayOfWeek`) | +1 |
| Buffer comfort | Both surrounding gaps > 15 min (or no surrounding event) | +1 |
| Daily load penalty | Existing occupied intervals on the same calendar date (`speculativeDailyLoadMap`) | −1 each, max −3 |
| Difficulty bonus | Task's `difficultyRating ≥ 4` AND time-of-day match | +1 |
| Deadline bucket | Slot's position within 5 equal-width buckets across `[now, dueDate]`, weighted by `productivityTraits.deadlineBehavior` | 0 to +2 |

### Deadline bucket scoring

The `[now, dueDate]` window is divided into 5 equal buckets (0 = earliest, 4 = closest to due date). The raw bucket weight is normalised to 0–2 via `round((weight / maxWeight) * 2)`.

| Setting | Bucket weights (0 → 4) | Effect |
|---|---|---|
| `"Well in advance"` | `[3, 3, 2, 1, 0]` | Gradual bias toward earlier slots |
| `"Evenly spread"` (default) | — | No signal (0 for all slots) |
| `"Near deadline"` | `[1, 1, 2, 3, 3]` | Gradual bias toward later slots |

When `deadlineBehavior` is not set, the component defaults to 0. Both scheduling entry points (`scheduleAllBlocks`, `scheduleBlock`) pass `dueDateMs` and `nowMs` per block so the bucket is computed relative to each task's window.

### Time-of-day label → minute range mapping

| Label | Range (minutes from midnight) |
|---|---|
| Early Morning (5–8am) | [300, 480) |
| Morning (8–11am) | [480, 660) |
| Midday (11am–2pm) | [660, 840) |
| Afternoon (2–5pm) | [840, 1020) |
| Evening (5–8pm) | [1020, 1200) |
| Night (8–11pm) | [1200, 1380) |
| Late Night (11pm+) | [1380, 1440) |

### Difficulty rating source

`difficultyRating` comes from `userCourses` via the task's `courseId`. Both scheduling actions fetch user courses once at startup and build a `courseId → difficultyRating` map. For subtask blocks, the parent task's `courseId` is used.

### What the AI still decides

Candidates are pre-sorted but the AI is told it may override a lower-scored slot if surrounding calendar context makes it clearly better. The AI handles qualitative judgment (event titles, session flow, subject context) that the scorer can't capture numerically.

---

## Phase 2 — AI slot selection

One Mastra `scheduling-workflow` call (Claude Sonnet) covers all blocks in the run. `selectAllSlotsWithAI` (`backend/convex/lib/scheduleSlots.ts`) sends each block's pre-scored, sorted candidate list and parent task context (title, due date, recommended start) together. The prompt includes `score` and `scoreBreakdown` per candidate so the model can see why each slot ranked as it did. The workflow returns one candidate index per block plus an optional skip reason. Falls back to index 0 if `MASTRA_URL` is unset, the workflow fails, or it returns an invalid index.

---

## Phase 3 — Placement & physical-validity fallback

Blocks are placed in the order they were collected in Phase 1. For each block:

### Slot validation

The AI-chosen candidate is checked for **physical validity** only:

```
isPhysValid(c) = isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, timezone)
```

### Fallback hierarchy

1. AI-chosen slot is physically valid → place it
2. AI-chosen slot is no longer valid (race condition with earlier placement) → scan remaining candidates for the first physically valid one
3. No physically valid candidate exists → skip block

### After placement

- Slot is removed from the pool
- Interval is added to `occupiedIntervals` so later blocks in the same run see it as occupied
- `speculativeDailyLoadMap[date] += 1` to keep the map accurate for any subsequent runs

---

## Key constants

| Constant | Value | Location |
|---|---|---|
| `MAX_BLOCKS` | 10 | `scheduleAllBlocks.ts` — max blocks scheduled per single call |
| `MAX_CANDIDATES` | 20 | `scheduleAllBlocks.ts` / `scheduleSlots.ts` — candidate slots offered to Gemini per block |
| `SCHEDULE_HORIZON_MS` | 21 days | `scheduleSlots.ts` — how far ahead the pool extends |
| `FIFTEEN_MIN_MS` | 15 min | `scheduleSlots.ts` — pool scan granularity |

---

## Key parameters per block

| Parameter | Source |
|---|---|
| `focusBlockLength` | `user.focusBlockLength` (default 60 min) |
| `workHoursGrid` | `user.workHoursGrid` |
| `preferredDays` | `user.productivityTraits.dayOfWeek` |
| `timeOfDayPrefs` | `user.productivityTraits.timeOfDay` (array of label strings) |
| `recommendedStart` | `task.recommendedStart` (hard lower bound on placement) |
| `dueDate` | `task.dueDate` or `subtask.suggestedCompletionAt` |
| `studyBlockLength` | `block.studyBlockLength` (set at block creation from `focusBlockLength`) |
| `difficultyRating` | `userCourses[task.courseId].difficultyRating` (used in scoring bonus) |
| `deadlineBehavior` | `user.productivityTraits.deadlineBehavior` (used in deadline bucket scoring) |

---

## Hard constraints (enforced before AI)

| Constraint | Mechanism |
|---|---|
| Blocked hours | `isSlotValid()` checks `workHoursGrid[].blocked` |
| Calendar event overlap | `isSlotValid()` checks `occupiedIntervals` |
| Already-placed blocks | Included in `occupiedIntervals` |
| Due date | Pool never extends past due date; candidates filtered by `slot + duration ≤ dueDate` |
| `recommendedStart` | Slots before this timestamp skipped during pool scoring |

---

## Spread mechanism

Spread across days within a single run comes from the **speculative load penalty** in scoring:

- Each block's top candidate's day is incremented in `speculativeDailyLoadMap` after Phase 1 selection
- After each real placement in Phase 3, `speculativeDailyLoadMap` is incremented again
- The `dailyLoadPenalty` in `scoreCandidate` (−1 per unit, max −3) means a day with 3+ blocks scores at least 3 points lower than an empty day on the same rubric
- Once a preferred day accumulates enough blocks, a non-preferred day at the right time can outscore it

There is no hard per-day cap in the bulk scheduler. Soft penalisation handles spread in the common case; edge cases (very constrained windows) naturally stack blocks on fewer days rather than skipping them.
