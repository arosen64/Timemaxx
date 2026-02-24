# Iteration 1 Plan

<!-- Due: Tuesday 6 PM of Week 1 of the iteration (Week 5) -->

## Requirements & Acceptance Criteria

### R1: Google Authentication

**Description:** Users can sign in to Timemaxx using their Google account via Google OAuth. New users are redirected to onboarding; returning users go to the dashboard.

- **Acceptance Criteria:**
  - [ ] A "Sign in with Google" button is present on the landing/login page
  - [ ] Clicking the button initiates the Google OAuth flow
  - [ ] Successful authentication redirects new users to onboarding and returning users to the dashboard
  - [ ] Failed authentication displays an appropriate error message
  - [ ] Users remain logged in across sessions until they explicitly log out

---

### R2: Onboarding Survey

**Description:** New users complete a required onboarding survey capturing study habits and preferences: preferred work hours (per day of the week) and focus block length.

- **Acceptance Criteria:**
  - [ ] New users are redirected to the onboarding survey after first login
  - [ ] Survey collects: preferred work hours and focus block length
  - [ ] All required fields must be completed before submission
  - [ ] Survey can be completed in under 2 minutes
  - [ ] Returning users (who have already completed onboarding) are not shown the survey again

---

### R3: User Data Persistence

**Description:** Onboarding survey data is stored in Convex and persisted across sessions so users do not need to re-enter their preferences on subsequent logins.

- **Acceptance Criteria:**
  - [ ] Onboarding data is saved to Convex upon survey submission
  - [ ] Stored data is scoped to the authenticated user's Google account ID
  - [ ] User preferences are retrievable on subsequent logins
  - [ ] No data is lost or corrupted between sessions

---

### R4: Manual Assignment Entry

**Description:** Users can manually add a task by entering or pasting an assignment description and selecting its type. The task is saved to their account.

- **Acceptance Criteria:**
  - [ ] A form is available for users to enter/paste an assignment description
  - [ ] Users can select a task type: problem set, essay, coding assignment, or exam preparation
  - [ ] Submitted tasks are saved to Convex and associated with the user's account
  - [ ] Submitted tasks appear in the user's task list

---

### R5: AI-Based Time Estimation

**Description:** After a task is submitted, the system uses Google Gemini to generate an optimal time estimate based on the task description and type.

- **Acceptance Criteria:**
  - [ ] Time estimate is generated automatically after task submission
  - [ ] Estimation uses task type as input
  - [ ] Time estimate is displayed to the user alongside the task
  - [ ] Estimation completes within 30 seconds of submission
  - [ ] If estimation fails, an error is shown and the user can retry

---

### R6 (Nice-to-Have): Task Dashboard

**Description:** Users have a central dashboard displaying their task list with the ability to manually add, edit, or remove tasks.

- **Acceptance Criteria:**
  - [ ] Dashboard displays all tasks for the logged-in user (title, type, estimated time)
  - [ ] Users can add new tasks from the dashboard
  - [ ] Users can edit task details (description, type, due date)
  - [ ] Users can delete tasks
  - [ ] Dashboard is accessible immediately after login for returning users

---

## Coordination & Design Decisions

### Architecture Overview

- **Frontend:** React + TypeScript + TailwindCSS, using React Router for client-side routing
- **Backend/Database:** Convex for database, server functions, and auth session management
- **AI:** Google Gemini API called from a Convex action (server-side) to keep API keys secure
- **Auth:** Convex Auth with Google OAuth provider

### Routing Flow

```
/ (landing/login) → /onboarding (new users only) → /dashboard
```

- On login, check if user has onboarding data in Convex
- If not → redirect to `/onboarding`
- If yes → redirect to `/dashboard`

### Convex Schema

```ts
// users table
{
  googleId: string,         // from OAuth
  email: string,
  preferredWorkHours: {
    monday: { start: string, end: string }[],
    tuesday: { start: string, end: string }[],
    wednesday: { start: string, end: string }[],
    thursday: { start: string, end: string }[],
    friday: { start: string, end: string }[],
    saturday: { start: string, end: string }[],
    sunday: { start: string, end: string }[],
  },
  focusBlockLength: number, // in minutes
  onboardingComplete: boolean,
}

// tasks table
{
  userId: Id<"users">,
  description: string,
  taskType: "problem_set" | "essay" | "coding" | "exam_prep",
  timeEstimate: number | null,  // hours, null until AI responds
  createdAt: number,
}
```

### API Contracts (Convex Functions)

| Function | Type | Description |
|---|---|---|
| `saveOnboardingData(preferences)` | mutation | Saves onboarding survey results for authenticated user |
| `getUserProfile()` | query | Returns onboarding data for authenticated user |
| `createTask(description, taskType)` | mutation | Creates task and triggers AI estimation |
| `estimateTaskTime(taskId)` | action | Calls Gemini API and updates task with time estimate |
| `getTasks()` | query | Returns all tasks for authenticated user |
| `updateTask(taskId, fields)` | mutation | Edits a task |
| `deleteTask(taskId)` | mutation | Removes a task |

### Gemini Prompt Design

The AI subteam should agree on a prompt template before implementation. Suggested structure:

```
Given the following assignment description and type, estimate the number of hours a typical college student would need to complete it.

Task type: {taskType}
Description: {description}

Return JSON: { "estimatedHours": number, "rationale": string }
```

### Responsibilities

- **Auth + Convex setup:** Set up project scaffold, Convex schema, and Google OAuth
- **Onboarding:** Survey UI and saving data to Convex
- **Task entry + persistence:** Task entry form and Convex mutation
- **AI integration:** Gemini API action for time estimation
- **Dashboard (nice-to-have):** Task list display with add/edit/delete

### Dependencies Between Tasks

- Convex schema must be agreed on before backend mutations are implemented
- Auth must be working before onboarding or task entry can be tested end-to-end
- Task entry form depends on auth and schema being in place
- AI estimation depends on task entry being in place

---

## Task Breakdown

| # | Task | Type | Assignee(s) | Requirement |
|---|---|---|---|---|
| TBD | Project setup: initialize React + Vite + TailwindCSS + Convex + routing | task | TBD | All |
| TBD | Implement Google OAuth with Convex Auth | feature | TBD | R1 |
| TBD | Design and finalize Convex schema (users, tasks tables) | task | TBD | R3, R4 |
| TBD | Build onboarding survey UI | feature | TBD | R2 |
| TBD | Save onboarding data to Convex and enforce redirect logic | feature | TBD | R2, R3 |
| TBD | Build manual task entry form | feature | TBD | R4 |
| TBD | Integrate Gemini API for AI time estimation | feature | TBD | R5 |
| TBD | Build task dashboard (nice-to-have) | feature | TBD | R6 |
