# Scheduling Algorithm — Source of Truth

Last updated: issue #508 (daily load cap + spread)

---

## Overview

The scheduler turns unscheduled study blocks into placed calendar events. It runs in three phases:

1. **Phase 1 — Day selection & candidate collection** (deterministic)
2. **Phase 2 — AI slot selection** (Gemini Flash)
3. **Phase 3 — Placement & enforcement** (deterministic)

Entry points:

| Action | Scope |
|---|---|
| `actions/scheduleAllBlocks.ts` | Bulk: all unscheduled blocks for a task + its subtasks (max 10 per call) |
| `actions/scheduleTask.ts` | Single task: all unscheduled blocks for one task |
| `actions/scheduleBlock.ts` | Single block |

All three share the same slot pool and validation primitives from `lib/scheduleSlots.ts`.

---

## Phase 1 — Day selection & candidate collection

### Pool building

`extendSlotPool()` scans forward from `now` to `min(dueDate, now + 21 days)` in **15-minute increments**, adding each slot that passes `isSlotValid()` to a shared array. Slots that overlap `occupiedIntervals` (calendar events + already-placed blocks) or fall in blocked hours (`workHoursGrid[].blocked`) are excluded.

### Day discovery

For each unscheduled block, the full pool is scanned **in reverse** (latest slot first) to find the first physically valid slot per unique calendar day. This is unbounded by `MAX_CANDIDATES`, so every day with room in the window is visible regardless of how many slots it has.

```
blockDurationMs = block.studyBlockLength * 60_000
for pi in pool reversed:
  skip if slot ≥ dueDate or slot + blockDurationMs > dueDate
  skip if slot < recommendedStart (when set)
  skip if day already in dayAvailability
  if isSlotValid(slot):
    dayAvailability[dateStr] = { load: speculativeLoad, repMs: slot.startMs }
```

### Day selection — cap-first, then least-loaded

Days are split into two groups:

- **underCap**: days where `speculativeDailyLoadMap` is below `maxBlocksPerDayMap`
- **overCap**: all remaining days

The algorithm always picks from `underCap` first. Only when every available day is already over the speculative cap does it fall through to the least-loaded over-cap day. Within each group, the day with the **lowest speculative load** wins. Ties favour the latest day (closest to due date) because the pool is scanned latest-first.

### Speculative reservation

After selecting a target day, `speculativeDailyLoadMap` is incremented for that day. Subsequent blocks in the same run see an updated load and are routed to other days first. This is what produces the spread across days within a single scheduling run.

`speculativeDailyLoadMap` is never used for actual placement decisions — that is the job of `actualDailyLoadMap` in phase 3.

### Candidate list

Once the target day is chosen, `filterPoolForBlock()` is called on a **pool filtered to just that day**, with `reverseOrder: true`. This returns up to `MAX_CANDIDATES = 20` slots from that day, ordered **latest-first** (closest to due date). Gemini receives only these slots and picks the best time within the day.

---

## Phase 2 — AI slot selection

One Gemini Flash call covers all blocks in the run. Each block's candidate list and parent task context (title, due date, recommended start) are sent together. Gemini returns one candidate index per block. Falls back to index 0 if the API call fails or returns an invalid index.

---

## Phase 3 — Placement & enforcement

Blocks are placed in the order they were collected in phase 1. For each block:

### Slot validation

The AI-chosen candidate is checked against `withinCap`:

```
withinCap(c) =
  isSlotValid(c.startMs, durationMs, workHoursGrid, occupiedIntervals, timezone)
  AND NOT isDailyCapReached(c.startMs, timezone, actualDailyLoadMap, maxBlocksPerDayMap)
```

### Fallback hierarchy

1. AI-chosen slot passes `withinCap` → place it
2. AI-chosen slot fails → scan candidates for another that passes `withinCap`
3. No `withinCap` candidate exists → **cap override**: find all physically valid candidates, group by day, place on the **least-loaded day** (cap exceeded intentionally)
4. No physically valid candidate exists → skip block

### After placement

- Slot is removed from the pool
- Interval is added to `occupiedIntervals` so later blocks in the same run see it as occupied
- `actualDailyLoadMap[date] += 1`

---

## Daily load cap

### `maxBlocksPerDayMap` (per day-of-week name)

Derived by `computeMaxBlocksPerDay(workHoursGrid, focusBlockLength, preferredDays)`:

```
availableSlots = 48 − row.blocked.length   (48 = all 30-min slots in a day)
base = min(4, floor(availableSlots × 30 / focusBlockLength))
cap  = preferredDay ? base : max(1, base − 1)
```

Fallback when a day has no `workHoursGrid` row:
- Preferred day → cap 3
- Non-preferred day → cap 2

### `actualDailyLoadMap` (per calendar date string)

Built from `occupiedIntervals` at the start of a run:

```
units = ceil(intervalDurationMinutes / focusBlockLength)
map[dateStr] += units
```

Updated after each real placement during phase 3. Calendar events count toward the load (a 2-hour lecture counts as 2 units with a 60-min focus block).

### Cap override rule

The cap is **soft**. It is respected whenever possible but overridden when there is no other physically valid slot before the due date. The override always picks the least-loaded available day to preserve spread even when exceeding the limit.

---

## Key constants

| Constant | Value | Location |
|---|---|---|
| `MAX_BLOCKS` | 10 | `scheduleAllBlocks.ts` — max blocks scheduled per single call |
| `MAX_CANDIDATES` | 20 | `scheduleSlots.ts` — max candidate slots offered to Gemini per block |
| `SCHEDULE_HORIZON_MS` | 21 days | `scheduleSlots.ts` — how far ahead the pool extends |
| `FIFTEEN_MIN_MS` | 15 min | `scheduleSlots.ts` — pool scan granularity |

---

## Key parameters per block

| Parameter | Source |
|---|---|
| `focusBlockLength` | `user.focusBlockLength` (default 60 min) |
| `workHoursGrid` | `user.workHoursGrid` |
| `preferredDays` | `user.productivityTraits.dayOfWeek` |
| `recommendedStart` | `task.recommendedStart` (hard lower bound on placement) |
| `dueDate` | `task.dueDate` or `subtask.suggestedCompletionAt` |
| `studyBlockLength` | `block.studyBlockLength` (set at block creation from `focusBlockLength`) |

---

## Hard constraints (enforced before AI)

| Constraint | Mechanism |
|---|---|
| Blocked hours | `isSlotValid()` checks `workHoursGrid[].blocked` |
| Calendar event overlap | `isSlotValid()` checks `occupiedIntervals` |
| Already-placed blocks | Included in `occupiedIntervals` |
| Due date | Pool never extends past due date; candidates filtered by `slot + duration ≤ dueDate` |
| `recommendedStart` | Slots before this timestamp skipped in day discovery and `filterPoolForBlock` |
| Daily load cap | `isDailyCapReached()` in phase 1 day selection and phase 3 `withinCap` check |

---

## Scheduling direction

Blocks are scheduled **backwards from the due date**. The pool is built forward (required for the shared pool architecture), but `filterPoolForBlock` iterates it in reverse (`reverseOrder: true`) so `candidates[0]` is the latest available slot on the target day. This means blocks land close to when they are needed rather than being packed at the earliest opportunity.

---

## Spread mechanism

Spread across days within a single run comes from two independent layers:

1. **Phase 1 speculative reservation** — each block increments `speculativeDailyLoadMap` for its target day after being assigned. The next block's day selection sees the updated load and prefers a different day.

2. **Phase 3 actual enforcement** — `actualDailyLoadMap` grows with each real placement. If an AI-chosen slot is now over the actual cap, the fallback finds a within-cap candidate (or overrides to least-loaded day).

The two maps are intentionally separate: the speculative map drives distribution in phase 1 without contaminating the real enforcement in phase 3.
