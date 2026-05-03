# Iteration 3 Plan

<!-- Due: Tuesday 6 PM of Week 1 of the iteration -->

## Requirements & Acceptance Criteria

### R13: Transcript & Course-Based Time Estimation

**Description:** Improve time block estimation accuracy by incorporating the user's transcript summary and prior course performance. The system fetches prerequisite and same-department courses from SIS and userCourses, then includes grades and transcript context in the Gemini estimation prompt.

- **Acceptance Criteria:**
  - [x] Time estimation prompt includes the user's transcript summary from the users table
  - [x] The system fetches prerequisite courses and same-department courses from SIS for the task's associated class
  - [x] Prior course performance (grades from userCourses) for prerequisites and related courses is included in the estimation prompt
  - [x] The extended prompt is sent to Gemini and returns an improved time estimate
  - [x] Time estimates are noticeably more personalized (e.g., a student weak in writing gets longer estimates for essay tasks)
  - [x] The system gracefully handles missing data (no transcript, no prereqs) by falling back to the existing estimation logic
  - [x] Estimation still completes within 30 seconds

---

### R14: Chatbot-Informed Time Estimation

**Description:** Enhance time estimation by retrieving relevant context from chatbot conversations via vector search. When a user reflects on tasks or study habits in the chatbot, that context is extracted and fed into the Gemini estimation prompt to improve accuracy.

- **Acceptance Criteria:**
  - [x] Vector search is implemented over chatbot conversation history
  - [x] When generating a time estimate, the system queries chat history for context relevant to the task's class, type, or description
  - [x] Retrieved chatbot context is included in the Gemini estimation prompt alongside other signals
  - [x] The system gracefully handles missing chatbot history by falling back to estimation without chat context
  - [x] Relevance filtering ensures only meaningful context is included (not all chat messages)
  - [x] Estimation still completes within 30 seconds even with vector search overhead

---

### R15: Subtask Generation

**Description:** The system provides finer task breakdowns for large assignments, homework, or midterm planning when sufficient information is provided. Users can opt in to AI-generated subtasks, upload assignment descriptions, and manage parent/child task relationships.

- **Acceptance Criteria:**
  - [x] A "Generate subtasks" checkbox is available on the task creation and editing forms
  - [x] When enabled, the system sends the task details to Gemini and returns a list of subtasks
  - [x] Subtasks are linked to a parent task via a `parentTaskId` field in the tasks table
  - [x] Subtasks appear nested under their parent task in the dashboard task list
  - [x] Users can upload PDF or TXT files of assignment descriptions to provide additional context for subtask generation
  - [x] If insufficient context is provided (e.g., title only, no description or file), the system displays an error requesting more information instead of generating low-quality subtasks
  - [x] Users can edit, delete, or add subtasks after generation
  - [x] Each subtask independently receives its own time estimate
  - [x] Deleting a parent task prompts whether to also delete its subtasks

---

### R16: AI Chatbot

**Description:** An AI chatbot is present on the dashboard and can modify the schedule and update user habits based on input and feedback. The chatbot uses function calling to create, update, and delete tasks and preferences.

- **Acceptance Criteria:**
  - [x] A chatbot interface is accessible from the dashboard (as a widget or separate tab)
  - [x] The chatbot can answer questions about the user's schedule, tasks, and study habits
  - [x] The chatbot supports function calling to create, update, and delete tasks
  - [x] The chatbot supports function calling to update user preferences (work hours, focus block length, etc.)
  - [x] Chatbot responses are contextual — they reference the user's actual tasks and schedule
  - [x] Conversation history is persisted per user across sessions
  - [x] The chatbot UI supports streaming responses for a responsive feel
  - [x] The chatbot is only accessible to authenticated users

---

### R17: Google Calendar Export

**Description:** Study blocks are automatically exported to the user's Google Calendar. OAuth scope is upgraded from `calendar.readonly` to `calendar.events` to enable write access. A sync action handles creating, updating, and deleting Google Calendar events when study blocks change.

- **Acceptance Criteria:**
  - [x] OAuth scope is upgraded from `calendar.readonly` to `calendar.events`
  - [x] Existing users with a connected calendar are prompted to re-authenticate with the new scope
  - [x] A `googleEventId` field is added to the studyBlocks schema to track linked Google Calendar events
  - [x] When a study block is scheduled, a corresponding Google Calendar event is automatically created
  - [x] When a study block is updated (time change), the corresponding Google Calendar event is patched
  - [x] When a study block is deleted, the corresponding Google Calendar event is removed
  - [x] Cascade deletes from `deleteTask` also remove linked Google Calendar events
  - [x] A new `syncStudyBlockToCalendar` Convex action handles all create/update/delete sync operations
  - [x] Sync only applies to users with a connected calendar; others are unaffected
  - [x] No new packages are required — existing token storage and refresh logic is reused

---

### R18: Schedule Tab Redesign

**Description:** The schedule tab is redesigned to populate a local calendar view with study block time blocks, mimicking Google Calendar's UI. Time blocks are draggable, tasks are clickable with collapsible details, and both study blocks and imported Google Calendar events are displayed.

- **Acceptance Criteria:**
  - [x] The schedule tab displays a calendar view populated with study block time blocks
  - [x] Time blocks are draggable in the calendar view (drag to reschedule)
  - [x] Dragging a time block updates the study block's start time in the database
  - [x] Tasks are clickable with collapsible time block details
  - [x] The calendar view displays both study blocks and imported Google Calendar events
  - [x] The UI closely mimics Google Calendar's layout and interaction patterns
  - [x] The calendar supports day and week views at minimum
  - [x] Time blocks are color-coded by class or task type for visual distinction

---

## Unassigned Tasks

### Manual Time Override

**Description:** Users can manually override AI-generated time estimates for any task.

- **Acceptance Criteria:**
  - [x] Users can manually edit the time estimate field on any task (create and edit forms)
  - [x] Manual overrides replace the AI-generated estimate
  - [x] The UI clearly indicates when a time estimate has been manually overridden vs. AI-generated
  - [x] Manual overrides are persisted and do not get overwritten by subsequent AI re-estimations
  - [x] Study blocks are recalculated when a time estimate is manually changed

### Prompt Injection Prevention

**Description:** Harden the system against prompt injection attacks, particularly through chatbot input and any other user-provided text fields that are sent to Gemini.

- **Acceptance Criteria:**
  - [x] All user-provided text sent to Gemini is sanitized to prevent prompt injection
  - [x] Chatbot input is validated and sanitized before being included in any LLM prompt
  - [x] Input length limits are enforced on all text fields sent to Gemini
  - [x] The system uses structured prompt templates that clearly separate system instructions from user input
  - [x] Gemini responses are validated before being used to modify tasks, preferences, or other data
  - [ ] Attempted injection patterns are logged for monitoring — sanitizer replaces matches with `[FILTERED]` but does not emit a separate log/metric of detected attempts
  - [x] Existing Gemini actions (time estimation, syllabus parsing, transcript parsing) are audited and hardened
  - [x] Tests are added for common injection patterns (instruction override, role hijacking, data exfiltration attempts)

---

## Coordination & Design Decisions

### Convex Schema Updates

```ts
// tasks table — new field for subtask support
{
  parentTaskId?: Id<"tasks">,        // reference to parent task (null for top-level tasks)
  isManualEstimate?: boolean,        // true when user has manually overridden the AI estimate
}

// studyBlocks table — new field for GCal sync
{
  googleEventId?: string,            // Google Calendar event ID for synced events
}

// chatMessages table (new) — stores chatbot conversation history
{
  userId: Id<"users">,
  role: "user" | "assistant",
  content: string,
  timestamp: number,
  embedding?: number[],              // vector embedding for semantic search
}

// calendarConnections table — OAuth scope upgrade
// Existing table; scope changes from calendar.readonly to calendar.events
// Existing users must re-authenticate
```

### API Contracts

| Function | Type | Description |
|---|---|---|
| `generateSubtasks(taskId)` | action | Sends task details + optional file to Gemini, returns proposed subtasks |
| `confirmSubtasks(taskId, subtasks)` | mutation | Saves confirmed subtasks linked to parent via `parentTaskId` |
| `syncStudyBlockToCalendar(studyBlockId, operation)` | action | Creates/updates/deletes a Google Calendar event for a study block |
| `sendChatMessage(message)` | action | Processes a chatbot message, executes function calls, returns response |
| `getChatHistory(limit)` | query | Returns recent chat messages for the authenticated user |
| `searchChatContext(query)` | action | Vector search over chat history to find relevant context for estimation |
| `updateTimeEstimate(taskId, minutes)` | mutation | Manually overrides the time estimate and sets `isManualEstimate: true` |
| `sanitizeInput(text)` | internal | Validates and sanitizes user text before inclusion in Gemini prompts |

### Google Calendar Sync Flow

1. User schedules/updates/deletes a study block via `editStudyBlockTime` or `deleteStudyBlock`
2. Mutation triggers `syncStudyBlockToCalendar` action
3. Action checks if user has a connected calendar with `calendar.events` scope
4. If connected: creates/patches/removes the Google Calendar event using stored tokens
5. Stores or clears `googleEventId` on the study block

### Chatbot Architecture

- Use Gemini with function calling (tool use) to let the chatbot invoke Convex mutations
- Available tools for the chatbot: `createTask`, `updateTask`, `deleteTask`, `updatePreferences`, `getSchedule`
- Chat history is stored per user in a new `chatMessages` table
- Vector embeddings on chat messages enable semantic search for the chatbot-informed estimation feature (R14)
- Chatbot widget lives on the dashboard; consider a floating button or sidebar panel

### Prompt Injection Mitigation Strategy

- Use structured prompt templates with clear delimiters between system and user content
- Apply input validation: max length, character filtering, pattern detection
- Validate Gemini responses against expected schemas before applying changes
- For chatbot function calls: validate parameters match expected types/ranges before executing

### Responsibilities

| Feature | Primary | Secondary |
|---|---|---|
| R13: Transcript & Course-Based Time Estimation | riatalwar | mromoni1 |
| R14: Chatbot-Informed Time Estimation | tranade | riatalwar |
| R15: Subtask Generation | amintze2 | tranade |
| R16: AI Chatbot | anviimishra | amintze2 |
| R17: Google Calendar Export | mromoni1 | arosen64 |
| R18: Schedule Tab Redesign | arosen64 | anviimishra |

| Task | Assignee |
|---|---|
| Manual Time Override | unassigned |
| Prompt Injection Prevention | unassigned |

### Dependencies

- R14 (Chatbot-Informed Estimation) depends on R16 (AI Chatbot) for chat message storage and vector embeddings
- R13 depends on existing `userCourses` and transcript data from Iteration 2
- R15 (Subtask Generation) requires `parentTaskId` schema field before subtask mutations work
- R16 (AI Chatbot) requires the `chatMessages` table and Gemini function calling setup before tool use works
- R17 (GCal Export) requires OAuth scope upgrade before write operations; existing users must re-auth
- R18 (Schedule Tab Redesign) can proceed in parallel with R17; it consumes study block data already in the DB
- Prompt Injection Prevention task should be coordinated with R16 (Chatbot) since chatbot is the highest-risk surface

---

## Task Breakdown

| # | Task | Type | Assignee(s) | Requirement |
|---|---|---|---|---|
| #264 | **R13: Transcript & Course-Based Time Estimation** | feature | riatalwar, mromoni1 | R13 |
| #270 | &nbsp;&nbsp;Fetch prerequisite and same-department courses from SIS for the task's class | task | riatalwar | R13 |
| #271 | &nbsp;&nbsp;Query userCourses for prior grades in prereqs and related courses | task | riatalwar | R13 |
| #272 | &nbsp;&nbsp;Design extended Gemini prompt incorporating transcript summary and course performance | task | riatalwar | R13 |
| #273 | &nbsp;&nbsp;Add fallback logic when transcript or course data is missing | task | riatalwar | R13 |
| #265 | **R14: Chatbot-Informed Time Estimation** | feature | tranade, riatalwar | R14 |
| #274 | &nbsp;&nbsp;Implement vector search over chatbot message history | task | tranade | R14 |
| #275 | &nbsp;&nbsp;Build relevance filtering to extract only meaningful chat context for a given task | task | tranade | R14 |
| #276 | &nbsp;&nbsp;Integrate retrieved chat context into the Gemini estimation prompt | task | tranade | R14 |
| #277 | &nbsp;&nbsp;Add fallback logic when no relevant chat history exists | task | tranade | R14 |
| #266 | **R15: Subtask Generation** | feature | amintze2, tranade | R15 |
| #278 | &nbsp;&nbsp;Add `parentTaskId` field to tasks schema and update queries to support nesting | task | amintze2 | R15 |
| #279 | &nbsp;&nbsp;Implement `generateSubtasks` Gemini action | task | amintze2 | R15 |
| #280 | &nbsp;&nbsp;Build "Generate subtasks" checkbox and subtask review UI on task create/edit forms | task | amintze2 | R15 |
| #281 | &nbsp;&nbsp;Add PDF/TXT upload for assignment descriptions on task forms | task | amintze2 | R15 |
| #282 | &nbsp;&nbsp;Display nested subtasks under parent tasks in dashboard task list | task | amintze2 | R15 |
| #267 | **R16: AI Chatbot** | feature | anviimishra, amintze2 | R16 |
| #283 | &nbsp;&nbsp;Create `chatMessages` table and `getChatHistory` query | task | anviimishra | R16 |
| #284 | &nbsp;&nbsp;Implement chatbot UI component (widget/panel on dashboard) | task | anviimishra | R16 |
| #285 | &nbsp;&nbsp;Implement `sendChatMessage` Gemini action with function calling | task | anviimishra | R16 |
| #286 | &nbsp;&nbsp;Build chatbot tools: createTask, updateTask, deleteTask, updatePreferences, getSchedule | task | anviimishra | R16 |
| #287 | &nbsp;&nbsp;Add vector embeddings to chat messages for semantic search | task | anviimishra | R16 |
| #268 | **R17: Google Calendar Export** | feature | mromoni1, arosen64 | R17 |
| #288 | &nbsp;&nbsp;Upgrade OAuth scope to `calendar.events` and add re-authentication prompt | task | mromoni1 | R17 |
| #289 | &nbsp;&nbsp;Add `googleEventId` field to studyBlocks schema | task | mromoni1 | R17 |
| #290 | &nbsp;&nbsp;Implement `syncStudyBlockToCalendar` action (create/update/delete events) | task | mromoni1 | R17 |
| #291 | &nbsp;&nbsp;Trigger sync from `editStudyBlockTime`, `deleteStudyBlock`, and `deleteTask` mutations | task | mromoni1 | R17 |
| #269 | **R18: Schedule Tab Redesign** | feature | arosen64, anviimishra | R18 |
| #292 | &nbsp;&nbsp;Build calendar view component (day and week views) populated with study blocks | task | arosen64 | R18 |
| #293 | &nbsp;&nbsp;Implement draggable time blocks with start time persistence on drop | task | arosen64 | R18 |
| #294 | &nbsp;&nbsp;Add clickable tasks with collapsible time block details | task | arosen64 | R18 |
| #295 | &nbsp;&nbsp;Display imported Google Calendar events alongside study blocks | task | arosen64 | R18 |
| #296 | &nbsp;&nbsp;Add color-coding for time blocks by class or task type | task | arosen64 | R18 |
| #297 | **Manual Time Override** | task | unassigned | — |
| #299 | &nbsp;&nbsp;Add `isManualEstimate` field to tasks schema | task | unassigned | — |
| #300 | &nbsp;&nbsp;Add editable time estimate field to task create/edit forms | task | unassigned | — |
| #301 | &nbsp;&nbsp;Implement `updateTimeEstimate` mutation and recalculate study blocks on override | task | unassigned | — |
| #302 | &nbsp;&nbsp;Display manual vs. AI-generated indicator in task UI | task | unassigned | — |
| #298 | **Prompt Injection Prevention** | task | unassigned | — |
| #303 | &nbsp;&nbsp;Audit all existing Gemini actions and add input sanitization | task | unassigned | — |
| #304 | &nbsp;&nbsp;Implement structured prompt templates with user/system delimiters | task | unassigned | — |
| #305 | &nbsp;&nbsp;Add input validation and length limits on all LLM-facing text fields | task | unassigned | — |
| #306 | &nbsp;&nbsp;Validate Gemini responses against expected schemas before applying | task | unassigned | — |
| #307 | &nbsp;&nbsp;Add tests for common prompt injection patterns | task | unassigned | — |
