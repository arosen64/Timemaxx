# Iteration 4 Plan

<!-- Due: Tuesday 6 PM of Week 1 of the iteration -->

## Requirements & Acceptance Criteria

### R19: Scheduling Algorithm Improvements

**Description:** Enhance the scheduling algorithm to incorporate assignment weight/importance when ordering and placing study blocks, improve the cohesiveness of the LLM prompt to use all relevant user context (transcript, chat history, course data, preferences), and add explainability traces to all AI scheduling decisions so users understand why blocks were placed where they are.

- **Acceptance Criteria:**
  - [x] Assignment weight (from the task's course) is factored into scheduling priority alongside due date
  - [x] Higher-weight assignments are scheduled earlier or given preferred time slots
  - [ ] The Gemini scheduling prompt (`selectAllSlotsWithAI`) is refactored to include relevant user context: transcript summary, productivity traits, course difficulty ratings, and chat-derived insights
  - [x] Scheduling still completes within a reasonable time (~30s for bulk scheduling)

---

### R20: Calendar UI Finalization

**Description:** Finalize the schedule page calendar UI, specifically the right-hand side panel. Improve navigation, polish the unscheduled block tray, and ensure a cohesive user experience for managing study blocks.

- **Acceptance Criteria:**
  - [ ] The RHS panel (ScheduleTray) has a polished, finalized design matching `timemaxx.pen`
  - [ ] Unscheduled blocks in the tray are clearly actionable (schedule, edit, delete)
  - [x] Navigation between week views is intuitive and responsive
  - [x] The calendar grid accurately reflects work hours, calendar events, and study blocks
  - [ ] Visual feedback is provided for conflicts, scheduling actions, and export status
  - [x] The UI is responsive and usable at standard breakpoints (md, lg, xl)

---

### R21: Dashboard Daily Summary & Stats

**Description:** Improve the dashboard right-hand side to show a daily task summary (today's tasks with progress) and revise stat cards to show daily time instead of total estimated time, and show today's completed study blocks count instead of the placeholder study streak.

- **Acceptance Criteria:**
  - [ ] The RHS panel shows a "Today's Tasks" summary listing tasks with study blocks scheduled for today
  - [ ] Each task in the daily summary shows progress (e.g., completed blocks / total blocks)
  - [x] The "Estimated Time" stat card shows today's scheduled study time, not the total across all tasks
  - [ ] The "Study Streak" stat card shows the number of study blocks completed today (not a placeholder) — implemented as "Study Blocks This Week" with completed count
  - [x] A warning banner appears on a task if available time before its due date is less than the suggested time estimate
  - [x] The dashboard updates reactively when study blocks are completed or rescheduled

---

### R22: Assignment Weights for Tasks

**Description:** Add assignment weight support to tasks and courses. Weights are extracted during syllabus parsing, stored on tasks, and used by the scheduling algorithm to prioritize higher-weight assignments.

- **Acceptance Criteria:**
  - [x] An `assignmentWeight` field (0–100 scale, or percentage) is added to the tasks schema
  - [ ] Syllabus parsing extracts assignment weight/percentage when available in the syllabus
  - [x] Extracted weights are shown during syllabus review and persisted when tasks are confirmed
  - [ ] Users can manually set or override assignment weight on the task create/edit forms
  - [x] Assignment weight is visible on task cards in the dashboard
  - [x] The scheduling algorithm uses weight to influence block priority (R19 dependency)

---

### R23: Manual Time Estimate Override

**Description:** Allow users to manually override the AI-generated time estimate for a task, particularly when the summed subtask time does not match the desired total. The manual override takes precedence over auto-summed subtask estimates.

- **Acceptance Criteria:**
  - [x] Users can edit the time estimate field on the task create and edit forms
  - [x] A manual override sets `isManualEstimate: true` and persists the user-provided value
  - [x] Manual overrides are not overwritten by subsequent subtask estimate sums
  - [x] The UI indicates whether a time estimate is AI-generated, summed from subtasks, or manually set
  - [ ] Study blocks are recalculated/rebuilt when a time estimate is manually changed

---

### R24: Chatbot Scheduling Agent

**Description:** Add a scheduling specialist agent to the Mastra chatbot that can trigger schedule generation, reschedule tasks, and answer questions about the user's schedule. The supervisor routes scheduling-related messages to this agent.

- **Acceptance Criteria:**
  - [x] A new `scheduleAgent` is registered in Mastra with scheduling-specific system prompt
  - [x] The supervisor agent routes scheduling-related messages to the schedule agent
  - [x] The schedule agent can trigger task or block scheduling (invoke `scheduleAllBlocks`)
  - [x] Agent responses are streamed and persisted to chat history

---

### R25: Chatbot Task Agent — Subtask Support

**Description:** Extend the existing task agent to handle subtask operations. When users create or manage tasks with subtasks, the agent can generate, list, and modify subtasks.

- **Acceptance Criteria:**
  - [x] The task agent can generate subtasks for an existing task (triggers `generateSubtasks` action)
  - [x] The task agent can list subtasks for a given parent task
  - [ ] The task agent can delete individual subtasks
  - [x] Subtask context (titles, estimates) is included when the agent describes a task
  - [x] The agent handles the case where a task has no subtasks gracefully

---

### R26: Chatbot Course Agent

**Description:** Add a course specialist agent to the Mastra chatbot that can create courses (with SIS course picker integration for import), view course details, and update course information.

- **Acceptance Criteria:**
  - [x] A new `courseAgent` is registered in Mastra with course-specific system prompt
  - [x] The supervisor agent routes course-related messages to the course agent
  - [x] The course agent can create a new course from user input
  - [ ] The course agent can search and import courses from the JHU SIS course catalog
  - [x] The course agent can list the user's enrolled courses
  - [x] The course agent can update course details (study goal, difficulty rating, color)
  - [x] Agent responses are streamed and persisted to chat history

---

## Coordination & Design Decisions

### Schema Changes

```ts
// tasks table — new field for assignment weight
{
  assignmentWeight: v.optional(v.number()),  // 0–100 percentage weight of this assignment in the course
}
```

### Scheduling Algorithm Changes

The scheduling algorithm in `scheduleAllTasks.ts` currently sorts tasks by due date ascending. Changes:

1. **Sort order:** Primary sort by due date, secondary sort by assignment weight (descending) — higher-weight tasks scheduled first among same-due-date tasks
2. **Prompt enrichment:** The `selectAllSlotsWithAI` prompt should include:
   - Assignment weight per block
   - User's transcript summary and productivity traits (already partially available)
   - Course difficulty ratings from `userCourses`
   - Any relevant chat context from `chatChunks` vector search

### Syllabus Parsing Updates

The `uploadSyllabus.ts` action currently extracts: title, description, dueDate, taskType. Add:
- `weight` (number, 0–100) — parsed from syllabus grading breakdown (e.g., "Homework: 30%, Midterm: 25%")
- Distribute category weight evenly across assignments of that type if individual weights aren't specified

### Dashboard RHS Redesign

Current RHS shows "Today's Schedule" (upcoming study blocks). Changes:
- Keep study block timeline but add task-level progress grouping
- Stat card changes:
  - "Estimated Time" → "Today's Study Time" (sum of today's scheduled blocks in minutes/hours)
  - "Study Streak" → "Blocks Today" (count of study blocks with `startTime` today)
- Add due-date warning indicator on tasks where `availableHoursBeforeDue < timeEstimate`

### Chatbot Agent Architecture

Current agents: supervisor, taskAgent, feedbackAgent, preferencesAgent (stub).

New agents for Iteration 4:
- **scheduleAgent** — Handles: "schedule my tasks", "reschedule X", "what's on my calendar today"
  - Needs Convex HTTP endpoints or tools to invoke `scheduleAllTasks`, `scheduleTask`, and query `studyBlocks`
- **courseAgent** — Handles: "add a course", "import from SIS", "show my courses"
  - Needs tools to invoke `jhuCourses` search, `createUserCourse`, `getUserCourses`

Supervisor routing update: Add `"schedule"` and `"classes"` (already exists as a route but no agent) to the supervisor's route detection.

Task agent extension: Add subtask tools — `generateSubtasks`, `listSubtasks`, `deleteSubtask`.

### Responsibilities

| Feature | Primary | Secondary |
|---|---|---|
| R19: Scheduling Algorithm Improvements | mromoni1 | anviimishra |
| R20: Calendar UI Finalization | anviimishra | mromoni1 |
| R21: Dashboard Daily Summary & Stats | arosen64 | amintze2 |
| R22: Assignment Weights for Tasks | amintze2 | arosen64 |
| R23: Manual Time Estimate Override | amintze2 | arosen64 |
| R24: Chatbot Scheduling Agent | riatalwar | tranade |
| R25: Chatbot Task Agent — Subtask Support | tranade | riatalwar |
| R26: Chatbot Course Agent | riatalwar | tranade |

### Dependencies

- R19 (Scheduling Improvements) depends on R22 (Assignment Weights) for the weight field in the schema — but sorting/prompt work can proceed in parallel with a fallback for missing weights
- R21 (Dashboard Stats) and R22 (Assignment Weights) both touch task display — coordinate on task card changes
- R22 (Assignment Weights) includes syllabus parsing changes that feed into task creation
- R23 (Manual Override) — `isManualEstimate` already exists in schema; focus is on UI and subtask-sum interaction
- R24 (Scheduling Agent) depends on existing `scheduleAllTasks` action; needs HTTP endpoints or Convex tools
- R25 (Subtask Support) depends on existing subtask infrastructure from Iteration 3
- R26 (Course Agent) depends on existing `jhuCourses` action and `userCourses` mutations

---

## Task Breakdown

### R19: Scheduling Algorithm Improvements (feature — mromoni1, anviimishra)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #387 | **R19: Scheduling Algorithm Improvements** | feature | mromoni1, anviimishra | R19 |
| #395 | Add assignment weight to scheduling sort order (due date + weight) | task | unassigned | R19 |
| #396 | Enrich scheduling LLM prompt with full user context | task | unassigned | R19 |

### R20: Calendar UI Finalization (feature — anviimishra, mromoni1)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #388 | **R20: Calendar UI Finalization** | feature | anviimishra, mromoni1 | R20 |
| #399 | Finalize RHS ScheduleTray design and interaction | task | unassigned | R20 |
| #400 | Improve week navigation and calendar grid responsiveness | task | unassigned | R20 |

### R21: Dashboard Daily Summary & Stats (feature — arosen64, amintze2)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #389 | **R21: Dashboard Daily Summary & Stats** | feature | arosen64, amintze2 | R21 |
| #401 | Refactor dashboard RHS to show daily task summary with progress | task | unassigned | R21 |
| #402 | Update Estimated Time stat card to show today's study time | task | unassigned | R21 |
| #403 | Update Study Streak stat card to show today's block count | task | unassigned | R21 |
| #404 | Add due-date warning when available time < estimated time | task | unassigned | R21 |

### R22: Assignment Weights for Tasks (feature — amintze2, arosen64)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #390 | **R22: Assignment Weights for Tasks** | feature | amintze2, arosen64 | R22 |
| #405 | Add `assignmentWeight` field to tasks schema | task | unassigned | R22 |
| #406 | Update syllabus parsing to extract assignment weights | task | unassigned | R22 |
| #407 | Show extracted weights in syllabus review UI | task | unassigned | R22 |
| #408 | Add assignment weight input to task create/edit forms | task | unassigned | R22 |
| #409 | Display assignment weight on dashboard task cards | task | unassigned | R22 |

### R24: Chatbot Scheduling Agent (feature — riatalwar, tranade)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #391 | **R24: Chatbot Scheduling Agent** | feature | riatalwar, tranade | R24 |
| #410 | Create `scheduleAgent` with system prompt and intent detection | task | unassigned | R24 |
| #411 | Add scheduling tools to schedule agent | task | unassigned | R24 |
| #412 | Update supervisor to route scheduling messages to schedule agent | task | unassigned | R24 |

### R26: Chatbot Course Agent (feature — riatalwar, tranade)

| # | Task | Type | Assignee | Requirement |
|---|---|---|---|---|
| #392 | **R26: Chatbot Course Agent** | feature | riatalwar, tranade | R26 |
| #413 | Create `courseAgent` with system prompt | task | unassigned | R26 |
| #414 | Add course tools: create, search SIS, list, update | task | unassigned | R26 |
| #415 | Integrate SIS course picker flow into course agent | task | unassigned | R26 |
| #416 | Update supervisor to route course messages to course agent | task | unassigned | R26 |

### Standalone Tasks

| # | Task | Type | Assignee(s) | Requirement |
|---|---|---|---|---|
| #393 | Manual time estimate override | task | amintze2, arosen64 | R23 |
| #394 | Chatbot task agent subtask support | task | tranade, riatalwar | R25 |
