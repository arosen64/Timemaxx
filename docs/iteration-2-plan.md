# Iteration 2 Plan

<!-- Due: Tuesday 6 PM of Week 1 of the iteration (Week 7) -->

## Requirements & Acceptance Criteria

### R7: Transcript Upload and Academic Profile

**Description:** Users can upload a transcript (PDF) during onboarding or later from their profile tab. The system extracts a natural-language description of the student's academic performance (strong/weak subjects), which is stored with the profile and used to improve time estimation. Users can edit the extracted description before saving.

- **Acceptance Criteria:**
  - [ ] A transcript upload field is available during onboarding (optional — users can skip)
  - [ ] The same upload is also accessible from the user's profile tab after onboarding
  - [ ] Accepted formats: PDF
  - [ ] Maximum file size: 10 MB
  - [ ] The transcript file is stored in Convex file storage (not as raw text in the users table)
  - [ ] Gemini generates a plain-language description of the student's academic performance (e.g., strong in math, weaker in writing) from the transcript
  - [ ] The extracted description is shown to the user for review and can be edited before saving
  - [ ] The description (not a courses list) is saved to the user's profile and used as context in time estimation prompts
  - [ ] If parsing fails, the user is shown an error and can retry or skip
  - [ ] Transcript data is scoped to the authenticated user and persists across sessions

---

### R8: Syllabus Upload and Due Date Extraction

**Description:** Users can upload a syllabus (PDF or plain text) from the classes section of the dashboard or during the onboarding step where classes are added. Each upload is independent — users can upload just a syllabus, just a schedule, or both. Gemini extracts assignment names and due dates, which the user reviews before tasks are saved. Tasks include a tag field to associate them with a class.

- **Acceptance Criteria:**
  - [ ] Syllabus upload is accessible from the classes section of the dashboard and from onboarding where classes are added
  - [ ] Accepted formats: PDF, plain text
  - [ ] Maximum file size: 10 MB
  - [ ] Syllabus and schedule can each be uploaded independently (not required together)
  - [ ] Gemini extracts assignment names and due dates from the uploaded file
  - [ ] Extracted items are presented to the user for review before being saved as tasks
  - [ ] User can edit, remove, or confirm each extracted task before saving
  - [ ] Each task created from a syllabus is tagged with the corresponding class name
  - [ ] If extraction fails, the user is shown a clear error and can paste the syllabus text manually as a fallback
  - [ ] Extraction completes within 30 seconds
  - [ ] Successfully extracted tasks appear in the task list on the dashboard

---

### R9: Settings Dashboard and Account Management

**Description:** Authenticated users can access a settings page to update onboarding preferences. Users can also permanently delete their account from settings.

- **Acceptance Criteria:**
  - [ ] A settings page is accessible from the sidebar or profile menu
  - [ ] Settings page displays the user's current onboarding preferences
  - [ ] Users can edit and save: preferred work hours, focus block length, difficult/enjoyed subjects, and courses
  - [ ] Changes are saved to Convex and reflected immediately on next load
  - [ ] Saving displays a success confirmation; errors are shown if the save fails
  - [ ] Settings page is only accessible to authenticated users
  - [ ] Users can permanently delete their account from the settings page
  - [ ] Account deletion removes all user data (tasks, profile, stored files) from Convex
  - [ ] A confirmation dialog is shown before deletion is executed

---

### R10: Google Calendar Schedule Integration

**Description:** The system connects to the user's Google Calendar to display their existing schedule and identify available time blocks. Users can pick available times for tasks, which are then shown in a dedicated schedule tab on the dashboard.

- **Acceptance Criteria:**
  - [ ] Users can connect their Google Calendar account from settings or onboarding
  - [ ] The system reads the user's calendar events via the Google Calendar API (read-only)
  - [ ] A schedule tab on the dashboard displays the user's Google Calendar events
  - [ ] Available time blocks are derived by subtracting calendar events from preferred work hours
  - [ ] Users can assign a task to an available time block and have it reflected in the schedule view
  - [ ] If Calendar access is denied or unavailable, the system falls back to preferred work hours only
  - [ ] Calendar data is not stored permanently — only used at schedule generation time

---

### R11: Task Improvements — Custom Types and Time Estimate Feedback

**Description:** The task system is extended with more built-in task types, the ability to define custom task types, a class tag field, and a mechanism for users to provide feedback on AI-generated time estimates.

- **Acceptance Criteria:**
  - [ ] Task types include at least: Essay, Problem Set, Exam Prep, Coding, Reading, Lab, Presentation, and Other
  - [ ] Users can define a custom task type when creating or editing a task
  - [ ] Each task has a class tag field to associate it with a course
  - [ ] After a time estimate is generated, users can rate it (thumbs up / thumbs down) or submit a corrected estimate
  - [ ] Feedback is stored in Convex and surfaced in future prompts as context for the same user

---

### R12: UI Update

**Description:** Update the dashboard and onboarding UI to accommodate the new features added in Iteration 2, ensuring a consistent and responsive layout.

- **Acceptance Criteria:**
  - [ ] Dashboard includes a schedule tab alongside the existing task list
  - [ ] Onboarding flow includes the transcript upload step and syllabus upload step at the appropriate screens
  - [ ] All new UI components follow the existing TailwindCSS design conventions
  - [ ] Layout is responsive across mobile, tablet, and desktop breakpoints

---

## Coordination & Design Decisions

### Convex Schema Updates

Changes needed for Iteration 2:

```ts
// users table — update transcript field
{
  transcriptFileId?: Id<"_storage">,        // file stored in Convex storage
  transcriptDescription?: string,           // AI-generated plain-language description
  // NOTE: remove the old courses[] list from transcript; replaced by transcriptDescription
}

// tasks table additions
{
  classTag?: string,          // course label (e.g., "CS 423")
  taskType: string,           // extended set including custom types
  estimateFeedback?: {
    rating: "up" | "down",
    correctedEstimate?: number,
  },
}

// syllabi table (new)
{
  userId: Id<"users">,
  fileName: string,
  uploadedAt: number,
  rawText: string,
  extractedTasks: {
    title: string,
    dueDate: number,
    taskType: string,
    classTag: string,
  }[],
}
```

### API Contracts

| Function | Type | Description |
|---|---|---|
| `uploadTranscript(fileId)` | action | Sends stored transcript file to Gemini, generates description, saves to user profile |
| `uploadSyllabus(fileName, fileText, className)` | action | Sends text to Gemini for extraction, stores result, returns extracted tasks for review |
| `confirmSyllabusTasks(syllabusId, tasks)` | mutation | Saves confirmed extracted tasks (with class tags) to the tasks table |
| `updateUserSettings(fields)` | mutation | Updates user's work hours, focus block length, and study profile fields |
| `deleteAccount()` | mutation | Deletes user and all associated data from Convex |
| `getCalendarAvailability()` | action | Calls Google Calendar API and returns free time blocks within preferred work hours |
| `submitEstimateFeedback(taskId, feedback)` | mutation | Stores user feedback on a time estimate |

### Google Calendar Integration

- OAuth scopes needed: `https://www.googleapis.com/auth/calendar.readonly`
- Calendar tokens should be stored per user in Convex (encrypted)
- Availability computation: intersect preferred work hours (from onboarding) with gaps between calendar events for the next 7 days

### Gemini Prompt for Syllabus Parsing

```
You are parsing a course syllabus. Extract all assignments and exams with their due dates.

Syllabus text:
{syllabusText}

Return JSON: {
  "tasks": [{ "title": string, "dueDate": "YYYY-MM-DD", "type": "Essay|Problem Set|Exam Prep|Coding|Reading|Lab|Presentation|Other" }]
}
```

### Gemini Prompt for Transcript Description

```
You are analyzing a student transcript. Write a short (2–4 sentence) description of the student's academic performance, noting subject areas where they perform strongly and areas where they may need more time.

Transcript text:
{transcriptText}

Return plain text only. Do not include names, IDs, or identifying information.
```

### Responsibilities (6 features, one per person)

| Feature | Owner |
|---|---|
| R7: Transcript upload + academic profile | TBD |
| R8: Syllabus upload + due date extraction + class tags | TBD |
| R9: Settings dashboard + account deletion | TBD |
| R10: Google Calendar schedule integration + schedule tab | TBD |
| R11: Task improvements (custom types + estimate feedback) | TBD |
| R12: UI update (dashboard + onboarding layout) | TBD |

### Dependencies

- Convex schema updates must be agreed on before backend mutations are implemented
- Transcript description field must be defined before R7 backend work starts (replaces old courses list)
- Syllabus extraction depends on Gemini action patterns established in Iteration 1
- Google Calendar integration requires OAuth token storage before the action is built
- R12 (UI update) depends on R7–R11 feature shapes being stable

---

## Task Breakdown

| # | Task | Type | Assignee(s) | Requirement |
|---|---|---|---|---|
| TBD | **R7: Transcript Upload and Academic Profile** | feature | TBD | R7 |
| TBD | &nbsp;&nbsp;Add transcript upload step to onboarding and profile tab | task | TBD | R7 |
| TBD | &nbsp;&nbsp;Store transcript file in Convex file storage | task | TBD | R7 |
| TBD | &nbsp;&nbsp;Implement Gemini action to generate transcript description | task | TBD | R7 |
| TBD | &nbsp;&nbsp;Add editable description review UI before saving | task | TBD | R7 |
| TBD | **R8: Syllabus Upload and Due Date Extraction** | feature | TBD | R8 |
| TBD | &nbsp;&nbsp;Add syllabus upload to dashboard classes section and onboarding | task | TBD | R8 |
| TBD | &nbsp;&nbsp;Implement `uploadSyllabus` Gemini action and `confirmSyllabusTasks` mutation | task | TBD | R8 |
| TBD | &nbsp;&nbsp;Build extracted task review flow (edit/remove/confirm, with class tag) | task | TBD | R8 |
| TBD | **R9: Settings Dashboard and Account Management** | feature | TBD | R9 |
| TBD | &nbsp;&nbsp;Build settings page UI reusing ProfileForm and WorkHoursSelector | task | TBD | R9 |
| TBD | &nbsp;&nbsp;Implement `updateUserSettings` mutation and wire to settings form | task | TBD | R9 |
| TBD | &nbsp;&nbsp;Add account deletion UI and `deleteAccount` mutation | task | TBD | R9 |
| TBD | **R10: Google Calendar Schedule Integration** | feature | TBD | R10 |
| TBD | &nbsp;&nbsp;Add Google Calendar OAuth scope and token storage | task | TBD | R10 |
| TBD | &nbsp;&nbsp;Build schedule tab UI displaying calendar events | task | TBD | R10 |
| TBD | &nbsp;&nbsp;Implement `getCalendarAvailability` action and available-time picker | task | TBD | R10 |
| TBD | **R11: Task Improvements** | feature | TBD | R11 |
| TBD | &nbsp;&nbsp;Extend task types and add custom type input | task | TBD | R11 |
| TBD | &nbsp;&nbsp;Add class tag field to task create/edit forms | task | TBD | R11 |
| TBD | &nbsp;&nbsp;Implement time estimate feedback UI and `submitEstimateFeedback` mutation | task | TBD | R11 |
| TBD | **R12: UI Update** | task | TBD | R12 |
| TBD | &nbsp;&nbsp;Update dashboard layout to include schedule tab | task | TBD | R12 |
| TBD | &nbsp;&nbsp;Update onboarding flow with transcript and syllabus upload steps | task | TBD | R12 |
| 76 | Add date picker for add/edit task modal | feature | TBD | — |
| 75 | Fix responsive design for various screen sizes | bug | TBD | — |
| 74 | Route sidebar logo and user info clicks to correct pages | task | TBD | — |
| TBD | **R11: Class Website Upload (Nice-to-Have)** | feature | TBD | R11 |
| TBD | &nbsp;&nbsp;Build class website URL input UI and extracted task review screen | task | TBD | R11 |
| TBD | &nbsp;&nbsp;Implement Convex action to fetch and parse class website for assignment data | task | TBD | R11 |
| 58 | Modularize existing pages into reusable components *(backlog)* | task | riatalwar | — |
| 56 | Refactor timemaxx.pen to use reusable components *(backlog)* | task | riatalwar | — |

