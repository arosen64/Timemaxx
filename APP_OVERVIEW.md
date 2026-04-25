# Timemaxx — App Overview & Functionality Reference

## What Is Timemaxx?

**Timemaxx** is an AI-powered study scheduler built for Johns Hopkins University students. The app helps students manage their academic workload by:

- Parsing syllabi and transcripts to automatically extract assignments and course history
- Using AI (Google Gemini + Claude) to estimate how long each task will take
- Building personalized study schedules based on user preferences and Google Calendar availability
- Providing a conversational AI assistant ("Maxx") to manage tasks, log feedback, and update preferences

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Routing | Wouter (React Router-compatible) |
| Backend / DB | Convex (serverless DB + actions + mutations + queries) |
| Auth | Convex Auth + Google OAuth |
| Time Estimation AI | Claude Sonnet 4 (Anthropic) via RAG |
| Extraction AI | Google Gemini 2.5-flash (structured outputs) |
| Chat Agent | Mastra agent framework (separate Node.js server, port 4111) |
| Calendar | Google Calendar API (OAuth 2.0, read + write) |
| Course Data | JHU SIS API |
| Embeddings / Vector Search | Gemini embeddings (3072-dim) + Convex native vector index |
| PDF Processing | pdfjs-dist (client-side) |
| Testing | Vitest + React Testing Library |

---

## Application Routes

| Route | Page | Access | Purpose |
|---|---|---|---|
| `/` | LandingPage | Public | Google OAuth sign-in, brand hero |
| `/onboarding` | OnboardingPage | Authenticated | 6-step new user setup |
| `/dashboard` | DashboardPage | Authenticated | Task list, subtasks, upcoming schedule |
| `/schedule` | SchedulePage | Authenticated | 21-day calendar view with drag-and-drop blocks |
| `/classes` | ClassesPage | Authenticated | Course management, syllabus upload, transcript import |
| `/syllabus-review` | SyllabusReviewPage | Authenticated | Review and confirm AI-extracted tasks |
| `/preferences` | PreferencesPage | Authenticated | Update focus length, work hours, productivity settings |
| `/profile` | ProfilePage | Authenticated | Edit profile, manage Google Calendar connection |

---

## Pages — Detailed Functionality

### LandingPage `/`

The public entry point. Displays the Timemaxx brand hero and a "Sign in with Google" button. Unauthenticated users cannot access any other route.

### OnboardingPage `/onboarding`

A 6-step wizard shown to new users before they reach the dashboard.

| Step | Content |
|---|---|
| 1 — Profile | Enter major and academic year |
| 2 — Courses | Search and add current courses (via JHU SIS API) |
| 3 — Work Hours | Select available study hours on a weekly grid (30-min slots) |
| 4 — Preferences | Set study session length, productivity traits |
| 5 — Google Calendar | OAuth flow to connect Google Calendar |
| 6 — Academic Profile | View AI-generated summary from optional transcript upload |

Completing onboarding sets `onboardingComplete = true` on the user record and redirects to `/dashboard`.

### DashboardPage `/dashboard`

The main hub. Shows all tasks with their status, AI time estimates, and course tags. Key features:

- **Task list** — filterable by status (not started / in progress / completed)
- **TaskCard** — displays title, due date, course color bar, time estimate badge, status dropdown
- **TaskModal** — expand a task to see subtasks, submit feedback (easier / harder / about right), update status
- **AddTaskModal** — create a new task (title, description, type, due date, class)
- **EditTaskModal** — update any task field
- **DeleteTaskModal** — confirm deletion
- **Stat cards** — KPI summary: total tasks, completed, tasks due soon
- **UpcomingSchedulePanel** — shows the next 7 days of scheduled study blocks

### SchedulePage `/schedule`

A 21-day calendar grid for viewing and managing study blocks.

- **TimeGrid** — 24-hour view in 30-min slots; drag-and-drop to move blocks
- **Week/day navigation** — step forward/backward
- **Schedule All button** — bulk-schedule all unscheduled tasks via AI
- **Conflict detection** — blocks that overlap calendar events are flagged red
- **CalendarSelectorPopup** — manually pick a time to place a block

### ClassesPage `/classes`

Course and syllabus management.

- **Current/Past tabs** — separate enrolled courses by active vs. historical
- **Add Class** — search JHU SIS for courses or add manually
- **ClassCard** — shows course code, title, difficulty rating, credits; has actions for syllabus upload and deletion
- **SyllabusUploadModal** — PDF upload that triggers AI parsing
- **Import Transcript** — upload JHU transcript PDF to auto-populate course history

### SyllabusReviewPage `/syllabus-review`

After uploading a syllabus, the user sees all AI-extracted tasks here before committing them to the database.

- **TaskReviewCard** — edit title, description, type, and due date per extracted task
- **TaskTypePills** — pill selector: Essay, Problem Set, Exam Prep, Lab Report, etc.
- **Confirm button** — calls `confirmSyllabusTasks` mutation; tasks are created and time estimation is queued
- **Discard button** — deletes syllabus record

### PreferencesPage `/preferences`

Update study preferences without going through onboarding again.

- Focus block length (e.g., 25 min, 50 min, 90 min)
- Weekly work hour grid (same 30-min slot picker as onboarding)
- Productivity traits (e.g., early bird, night owl, needs breaks)

### ProfilePage `/profile`

- **ProfileField** — inline edit of name, email, major, year
- **Google Calendar** — shows connection status; button to revoke access
- **Delete Account** — confirmation modal before permanent deletion

---

## AI & Machine Learning

### Time Estimation (Claude Sonnet 4 + RAG)

Time estimation is the core intelligence of Timemaxx. It runs automatically when a task is created and can be triggered manually.

**Retrieval-Augmented Generation context built for each estimate:**

| Context Source | What Is Retrieved |
|---|---|
| Similar Tasks | Up to 10 prior tasks with similar embeddings; includes their estimates and user feedback |
| Related Courses | Up to 10 courses from same department or by embedding similarity |
| Chat Chunks | Excerpts from chat history related to the task topic |
| User Profile | Major, year, difficult subjects, transcript summary, productivity traits |

Claude receives a structured prompt with all context and returns:
- `estimatedMinutes` — the predicted time to complete
- `reasoningTrace` — per-category explanation of the reasoning

**Feedback loop:** Users can rate estimates (up/down) and enter actual minutes. This feedback is stored and included in future estimation context, making estimates more accurate over time.

### Syllabus Parsing (Gemini 2.5-flash)

1. Client extracts text from the PDF using `pdfjs-dist`
2. Text is sent to a Convex action
3. Gemini parses it with a structured output schema and returns an array of tasks with title, description, due date, and task type
4. Tasks are stored in the `syllabi` table with status `pending` until user confirms on the review page

### Transcript Parsing (Gemini 2.5-flash)

1. User uploads a JHU PDF transcript
2. Client extracts text via `pdfjs-dist`
3. Gemini extracts: course code, title, credits, academic term, letter grade
4. User previews the results; on confirm, records are written to `userCourses`

### Subtask Generation (Gemini 2.5-flash)

When a task is created, Gemini can break it into 1–6 concrete subtasks. Each subtask gets its own title, task type, and AI-estimated time.

### AI-Assisted Scheduling (Gemini 2.5-flash)

When scheduling study blocks:

1. All valid candidate time slots are enumerated (respecting work-hour grid and existing calendar events)
2. The candidate list is sent to Gemini
3. Gemini ranks and selects the best slots, considering: task deadline, surrounding calendar events, user productivity traits
4. If a chosen slot is no longer valid (race condition), the system falls back to the next valid candidate

### Embeddings & Vector Search (Gemini embeddings, 3072-dim)

Embeddings power retrieval in two places:

- **RAG for time estimation** — tasks, courses, and chat chunks all have embeddings; cosine similarity is used to pull relevant context before calling Claude
- **Entity resolution in chat** — when the user refers to "my linear algebra assignment" without being precise, embedding search finds the closest matching task or course

---

## Chat Agent — Maxx (Mastra + Claude)

Maxx is a floating chat widget available on all authenticated pages. It runs on a separate Mastra server (Node.js, port 4111). Convex communicates with Mastra over HTTP via an ngrok tunnel in local development.

### Agents

| Agent | Responsibility |
|---|---|
| **Supervisor** | Routes incoming messages to the correct specialist agent; detects multi-domain ambiguity |
| **Task Agent** | Handles creating, reading, updating, and deleting tasks via conversation |
| **Feedback Agent** | Records effort/difficulty feedback on tasks (effort rating, actual minutes, what was hard) |
| **Preferences Agent** | Updates study preferences through natural language |

### Conversation Flow

1. User types a message in the chat widget
2. Message is sent to `POST /api/chat` (Convex HTTP action in `http_chat.ts`)
3. The supervisor workflow routes the message to the appropriate specialist agent
4. The specialist collects any missing fields through follow-up questions
5. When the agent has all required information, it signals `readyToExecute = true`
6. `http_chat.ts` runs the corresponding Convex mutation (e.g., `createTask`)
7. A confirmation message is returned to the chat

### Entity Clarification

When the user references a task or course ambiguously, the system:

1. Runs an embedding search to find candidates
2. Presents a multiple-choice clarification question in the chat
3. The user selects an option; the resolved ID is stored in the chat session
4. The original request resumes with the resolved entity

### Chat History & Embeddings

Every conversation is chunked and embedded for use as RAG context in future time estimations. This means the more a user interacts with Maxx about their workload, the more accurate future estimates become.

---

## Google Calendar Integration

### OAuth Flow

1. User initiates from Onboarding step 5 or the Profile page
2. `initiateGoogleCalendarOAuth` action generates a Google OAuth URL with a state token
3. Browser is redirected to Google's consent screen
4. Google redirects back to the Convex HTTP OAuth callback endpoint
5. The access token and refresh token are stored encrypted in `calendarConnections`
6. The user is redirected back to their original page

### Features Enabled by Calendar Connection

| Feature | Description |
|---|---|
| Event visibility | Calendar events appear on the Schedule page as blocked-off time |
| Conflict detection | Study blocks are flagged if they overlap calendar events |
| Auto-reschedule | When new calendar events are added, conflicting study blocks are automatically moved |
| Export to calendar | Study blocks can be synced to a dedicated "Timemaxx" Google Calendar |

---

## Database Schema

### users

Core user record combining auth info and onboarding data.

| Field | Type | Description |
|---|---|---|
| email, name, image | string | From Google OAuth |
| onboardingComplete | boolean | Gates /dashboard access |
| major | string | e.g., "Computer Science" |
| year | string | e.g., "Junior" |
| difficultSubjects | string[] | Subjects the user struggles with |
| enjoyedSubjects | string[] | Subjects the user enjoys |
| courses | string[] | Enrolled course codes |
| workHoursGrid | object[] | Weekly availability (day/hour/30-min slots) |
| productivityTraits | string[] | e.g., "early_bird", "needs_breaks" |
| transcriptSummary | object[] | AI-extracted academic profile |

### userCourses

Per-enrollment course record.

| Field | Type | Description |
|---|---|---|
| userId | ID | Owner |
| courseCode | string | e.g., "EN.601.226" |
| title, credits, term, grade | string/number | Course metadata |
| difficultyRating | number | 1–5 user rating |
| color | string | Hex color for UI display |
| studyGoal | string | How much time to spend on this course |
| embedding | float64[] | 3072-dim for vector search |

### tasks

The central work item.

| Field | Type | Description |
|---|---|---|
| userId | ID | Owner |
| title, description | string | Task content |
| taskType | string | Essay, Problem Set, Exam Prep, etc. |
| dueDate | string | ISO date |
| courseId | ID? | Linked course |
| classTag | string | Free-text label |
| timeEstimate | number | Minutes (AI or manual) |
| isManualEstimate | boolean | True if user overrode AI estimate |
| estimateFeedback | object | Up/down rating + corrected minutes |
| status | string | not_started / in_progress / completed |
| embedding | float64[] | 3072-dim for RAG retrieval |
| reasoning | object | Per-category reasoning trace from Claude |

### subtasks

AI-generated breakdown of a parent task.

| Field | Type | Description |
|---|---|---|
| parentTaskId | ID | Links to parent task |
| userId | ID | Owner |
| title, taskType, order | string/number | Subtask content and sequence |
| timeEstimate | number | Minutes |
| dueDate, suggestedCompletionAt | string | Target dates |
| status | string | not_started / in_progress / completed |
| embedding, reasoning | mixed | Same as tasks |

### studyBlocks

Scheduled time chunks tied to tasks or subtasks.

| Field | Type | Description |
|---|---|---|
| taskId / subtaskId | ID? | What this block is for |
| userId | ID | Owner |
| title | string | Display label |
| studyBlockLength | number | Duration in minutes |
| startTime | string? | ISO datetime; null if unscheduled |
| isConflicted | boolean | True if overlapping calendar event |
| googleEventId | string? | If exported to Google Calendar |
| needsExport | boolean | Pending sync flag |

### calendarConnections

Stores OAuth credentials for one Google account per user.

| Field | Description |
|---|---|
| accessToken | Encrypted OAuth access token |
| refreshToken | Encrypted OAuth refresh token |
| expiresAt | Token expiry timestamp |
| selectedCalendarIds | Which calendars to read for conflicts |
| timemaxxCalendarId | Calendar where study blocks are exported |

### syllabi

Tracks uploaded syllabi through the parse-and-review pipeline.

| Field | Description |
|---|---|
| fileContents | Raw extracted PDF text |
| courseId | Linked course |
| status | pending / confirmed / failed |

### chatMessages / chatSessions / chatChunks

Full chat history with session state tracking for multi-turn agent conversations.

| Table | Purpose |
|---|---|
| chatMessages | Individual messages (role, content, linked task/course) |
| chatSessions | Per-session state: resolved entity IDs, active agent, clarification step |
| chatChunks | Conversation chunks with embeddings for RAG retrieval |

---

## Key Data Flows

### Syllabus Upload → Task Creation

```
1. User selects a class and uploads a PDF on ClassesPage
2. Client extracts text via pdfjs-dist
3. uploadSyllabus action calls Gemini → returns structured task list
4. Tasks stored in syllabi table (status: pending)
5. User navigates to SyllabusReviewPage to edit each task
6. User clicks Confirm → confirmSyllabusTasks mutation:
   - Creates tasks in tasks table
   - Queues async time estimation for each task
   - Deletes the syllabus staging record
```

### Chat Message → Task Created

```
1. User types "Add a problem set due Friday for Data Structures"
2. POST /api/chat → Convex HTTP action
3. Supervisor agent routes to taskAgent
4. taskAgent infers intent = CREATE, extracts title + dueDate + taskType
5. If course is ambiguous → chat presents MCQ; user picks one
6. taskAgent.readyToExecute = true
7. http_chat.ts runs createTask mutation
8. Async time estimation queued
9. Confirmation message returned to user
```

### Time Estimation with RAG

```
1. Task is created (any method)
2. requestEstimateTaskTime action is triggered
3. Retrieval phase:
   - Vector search for similar tasks (up to 10)
   - Vector search for related courses (up to 10)
   - Vector search over chat history chunks (up to 5)
   - Fetch user profile
4. Prompt assembled with all context
5. Claude Sonnet 4 returns estimatedMinutes + reasoningTrace
6. Result stored in tasks table
7. Dashboard re-renders with estimate
8. User can rate accuracy (up/down) or enter actual minutes
9. Feedback stored and included in future estimation context
```

### Schedule Study Blocks

```
1. User clicks "Schedule" on a task or "Schedule All"
2. scheduleTask / scheduleAllTasks action runs:
   a. Fetch user workHoursGrid and productivityTraits
   b. Fetch Google Calendar events for 21-day window
   c. Enumerate all valid candidate slots (15-min intervals)
      - Skip slots blocked by calendar events
      - Skip slots outside user's work hours
   d. Send candidates to Gemini → returns chosen slot indices
   e. If chosen slot is now taken → fall back to next valid slot
   f. Place blocks via placeStudyBlock mutation
3. SchedulePage re-renders with new blocks
4. User can drag-drop to adjust placement
```

### Google Calendar Sync

```
1. User initiates OAuth on Onboarding Step 5 or Profile page
2. initiateGoogleCalendarOAuth action returns Google OAuth URL
3. Browser redirects → Google consent screen → OAuth callback
4. Backend stores encrypted tokens in calendarConnections
5. Calendar events now appear on SchedulePage as conflicts
6. exportStudyBlocksToCalendar action writes study blocks as Google Calendar events
7. autoRescheduleConflicts runs when new events are detected
```

### Transcript Import → Course History

```
1. User uploads JHU transcript PDF on ClassesPage
2. Client extracts text via pdfjs-dist
3. parseTranscript action calls Gemini → returns course list
   (courseCode, title, credits, term, grade)
4. Frontend shows import preview
5. User confirms → mutations create userCourses records
6. Course history is now available as context for time estimation RAG
```

---

## Backend Architecture Summary

All backend code lives in `backend/convex/`. Convex provides a fully type-safe, serverless backend with three function types:

| Type | Purpose | Called By |
|---|---|---|
| **Queries** | Read-only data fetching | `useQuery()` in React |
| **Mutations** | Write operations (DB changes) | `useMutation()` in React or other actions |
| **Actions** | Side-effectful work (AI calls, OAuth, Google APIs) | `useAction()` in React or internal scheduling |

HTTP endpoints (`http.ts`, `http_chat.ts`) handle external callbacks (Google OAuth) and the Mastra chat bridge. They use a Hono-based router with authentication middleware.

---

## Frontend Architecture Summary

All frontend code lives in `frontend/src/`.

- **`pages/`** — one file per route; imports and composes components
- **`components/`** — organized by feature area (`dashboard/`, `schedule/`, `classes/`, etc.)
- **`components/ui/`** — primitive components (Button, Modal, Toggle, etc.)
- **`main.tsx`** — wraps the app in `ConvexProvider` and `BrowserRouter`
- **`App.tsx`** — defines all routes with auth guards

State is managed via Convex's reactive queries (`useQuery`) — components automatically re-render when data changes in the database. No separate state management library is used.

---

## Mastra Agent Server Architecture

The Mastra server (`mastra/`) runs independently from the Convex backend.

```
mastra/
  src/mastra/
    index.ts              # Registers all agents with Mastra
    agents/
      supervisorAgent.ts  # Routes messages to specialist agents
      taskAgent.ts        # Task CRUD via conversation
      feedbackAgent.ts    # Effort/difficulty feedback collection
      preferencesAgent.ts # Preference updates via conversation
    workflows/
      supervisorWorkflow.ts
      taskWorkflow.ts
      feedbackWorkflow.ts
      preferencesWorkflow.ts
```

In production, the Mastra server must be publicly reachable. In local development, ngrok creates a public HTTPS tunnel (`ngrok http 4111`), and the URL is stored as a Convex environment variable (`MASTRA_URL`).

---

*Generated from codebase as of April 2026.*
