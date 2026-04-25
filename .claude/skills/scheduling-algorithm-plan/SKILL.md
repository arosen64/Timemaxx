---
name: scheduling-algorithm-plan
description: Reference for the R19 scheduling algorithm. Use when working on any scheduling-related issue (#395, #396, #397, #398, #506, #507, #508, #510), asking about the algorithm architecture, or deciding how a new scheduling change should fit into the overall design. The authoritative runtime description is guides/scheduling-algorithm.md — read that first.
argument-hint: "issue number or scheduling topic"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Scheduling Algorithm — Skill Reference

> **Source of truth for how the algorithm works:** `guides/scheduling-algorithm.md`
> This skill file tracks implementation status and remaining work.

---

## Current Architecture (post #508 / #510)

The scheduler has three phases:

- **Phase 1 — Day selection & candidate collection** (deterministic)
  - Pool built forward in 15-min increments via `extendSlotPool()`
  - Each block: full pool scanned in **reverse** to find one valid slot per day (unbounded by `MAX_CANDIDATES`)
  - Target day chosen cap-first (prefer under-cap days), then least-loaded within that group
  - `speculativeDailyLoadMap` incremented after each day assignment to spread blocks across days
  - `filterPoolForBlock(reverseOrder: true)` returns up to 20 slots from the target day, latest-first

- **Phase 2 — AI slot selection**
  - One Gemini Flash call for all blocks in the run
  - Gemini picks the best time within the pre-selected day; it does not choose which day

- **Phase 3 — Placement & enforcement**
  - `withinCap` check: physically valid AND actual daily load below cap
  - Fallback hierarchy: withinCap candidate → cap override on least-loaded day → skip
  - `actualDailyLoadMap` updated after each real placement (separate from speculative map)

Entry points: `actions/scheduleAllBlocks.ts` (bulk), `actions/scheduleTask.ts`, `actions/scheduleBlock.ts`

Key files: `lib/scheduleSlots.ts` (pool, validation, AI orchestration), `actions/scheduleAllBlocks.ts`

---

## Closed Issues (do not re-implement)

| Issue | What was done |
|---|---|
| #483 / PR #509 | `recommendedStart` hard constraint in `enumerateSlots` and `filterPoolForBlock` |
| #480 / PR #494 | `workHoursGrid.available` removed; `isInAvailableSlot` is dead code |
| #510 | `scheduleAllTasks.ts` deleted; replaced by block-first `scheduleAllBlocks.ts` |
| #508 | Daily load cap: `buildDailyLoadMap`, `computeMaxBlocksPerDay`, `isDailyCapReached` added to `scheduleSlots.ts`; wired into all three scheduling actions; bulk path gets speculative + actual dual-map spread |

### #508 implementation notes (daily load cap)

The original plan called for a simple per-day block count cap. The final implementation is more nuanced:

- **Dual load maps**: `speculativeDailyLoadMap` (phase 1 spread) and `actualDailyLoadMap` (phase 3 enforcement) are kept separate to prevent speculative reservations from blocking real placements
- **Backward scheduling**: candidates are ordered latest-first so blocks land near the due date, not at the earliest opportunity
- **Full pool day discovery**: phase 1 scans the entire pool in reverse rather than relying on `filterPoolForBlock`'s `MAX_CANDIDATES` limit — prevents a day with many slots from monopolising all 20 candidate spots and hiding other days
- **Cap is soft**: when every available day exceeds the cap, the override places on the least-loaded day rather than skipping the block
- **`MAX_BLOCKS = 10`**: bulk scheduling caps at 10 blocks per call; callers must invoke again for remaining blocks
- **Preferred days**: `computeMaxBlocksPerDay` gives preferred days (from `productivityTraits.dayOfWeek`) a higher cap than non-preferred days

---

## Open Issues (R19)

### Layer 1 — Independent algorithm changes

**#395** — Add assignment weight to scheduling sort order
- File: `actions/scheduleAllBlocks.ts`
- Sort key already includes `assignmentWeight DESC` — verify it's wired end-to-end

**#506** — Deadline-window bucket sampling
- File: `lib/scheduleSlots.ts`
- Replace early-break-at-20 in `enumerateSlots` with 5-bucket weighted sampling
- Bucket weights from `productivityTraits.deadlineBehavior`:
  - `"Well in advance"` → `[5, 3, 1, 1, 0]`
  - `"Evenly spread"` (default) → `[1, 1, 1, 1, 1]`
  - `"Near deadline"` → `[0, 1, 2, 3, 4]`

### Layer 2 — Scoring & prompt enrichment

**#507** — Deterministic pre-scoring layer
- New file: `lib/scoreSlots.ts` — pure `scoreCandidate()` function
- Scoring rubric: time-of-day match (+2), day-of-week match (+1), buffer comfort (+1), daily load penalty (−1 each, max −3), difficulty-time bonus (+1)
- Sort candidates by score before passing to Gemini

**#396** — Enrich Gemini prompt with structured per-candidate context
- File: `lib/prompts/scheduleBlock.prompt.ts`
- Add score breakdown, daily block count, gap context, task weight, course difficulty

### Layer 3 — Reasoning & UI

**#397** — Add `schedulingReason` to Gemini response and persist to `studyBlocks` schema

**#398** — Surface `schedulingReason` in schedule UI (tooltip or expandable detail)

---

## Hard Constraints Reference

| Constraint | Enforced by |
|---|---|
| Blocked hours | `isSlotValid()` — `workHoursGrid[].blocked` |
| Calendar event overlap | `isSlotValid()` — `occupiedIntervals` |
| Already-placed blocks | `occupiedIntervals` |
| Due date | Pool cap + `filterPoolForBlock` end check |
| `recommendedStart` | Day discovery skip + `filterPoolForBlock` param |
| Daily load cap | `isDailyCapReached()` in phase 1 and phase 3 |

## What Stays LLM-Only

- Final slot selection from pre-filtered, pre-scored candidates
- Subject switching and break preferences
- Chat context signals (vector search result injected as context hint)
