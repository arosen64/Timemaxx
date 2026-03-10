# Iteration 2 Plan

<!-- Due: Tuesday 6 PM of Week 1 of the iteration (Week 7) -->

## Requirements & Acceptance Criteria

### R7: Transcript Upload in Onboarding

**Description:** The onboarding survey is updated to include an optional transcript upload. The system parses the transcript to identify strong and weak subject areas, which are used to improve time estimation.

- **Acceptance Criteria:**
  - [ ] A transcript upload field is added to the onboarding flow
  - [ ] Accepted formats: PDF
  - [ ] Upload is optional — users can skip and proceed without it
  - [ ] On successful upload, relevant course/grade data is extracted and stored in Convex
  - [ ] If parsing fails, the user is shown an error and can retry or skip
  - [ ] Extracted data is scoped to the authenticated user and persists across sessions

---

### R8: Syllabus Upload and Due Date Extraction

**Description:** Users can upload a syllabus (PDF or plain text). The system uses Gemini to extract assignment and exam due dates and creates corresponding tasks. If extraction fails, manual text input is allowed as a fallback.

- **Acceptance Criteria:**
  - [ ] A syllabus upload option is accessible from the dashboard
  - [ ] Accepted formats: PDF, plain text
  - [ ] Gemini extracts assignment names and due dates from the uploaded file
  - [ ] Extracted items are presented to the user for review before being saved as tasks
  - [ ] User can edit, remove, or confirm each extracted task before saving
  - [ ] If extraction fails, the user is shown a clear error and can paste the syllabus text manually as a fallback
  - [ ] Extraction completes within 30 seconds
  - [ ] Successfully extracted tasks appear in the task list on the dashboard

---

### R9: Settings Dashboard

**Description:** Authenticated users can access a settings page to update the preferences they set during onboarding (work hours, focus block length, study profile).

- **Acceptance Criteria:**
  - [ ] A settings page is accessible from the sidebar or profile menu
  - [ ] Settings page displays the user's current onboarding preferences
  - [ ] Users can edit and save: preferred work hours, focus block length, difficult/enjoyed subjects, and courses
  - [ ] Changes are saved to Convex and reflected immediately on next load
  - [ ] Saving displays a success confirmation; errors are shown if the save fails
  - [ ] Settings page is only accessible to authenticated users

---

### R10: Google Calendar Availability Integration

**Description:** The system connects to the user's Google Calendar to read their existing events and determine available time blocks. This availability is used to suggest when tasks can be scheduled.

- **Acceptance Criteria:**
  - [ ] Users can connect their Google Calendar account from settings or onboarding
  - [ ] The system reads the user's calendar events via the Google Calendar API (read-only)
  - [ ] Available time blocks are derived by subtracting existing events from preferred work hours
  - [ ] Available blocks are displayed on the dashboard alongside the user's task list
  - [ ] If Calendar access is denied or unavailable, the system falls back to preferred work hours only
  - [ ] Calendar data is not stored permanently — only used at schedule generation time

---

### R11 (Nice-to-Have): Class Website Upload

**Description:** Users can provide a URL to a course website. The system scrapes the page and extracts assignment names and due dates, treating them like a syllabus upload.

- **Acceptance Criteria:**
  - [ ] A URL input field is available alongside the syllabus upload option
  - [ ] The system fetches and parses the page content
  - [ ] Extracted items go through the same review flow as syllabus uploads
  - [ ] If scraping fails, the user is shown an error with a suggestion to use manual upload instead

---

## Coordination & Design Decisions

### Convex Schema Updates

New fields needed for Iteration 2:

```ts
// users table additions
{
  transcript?: {
    rawText: string,
    courses: { name: string, grade: string }[],
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
  }[],
}
```

### API Contracts

| Function | Type | Description |
|---|---|---|
| `uploadTranscript(fileText)` | mutation | Stores raw transcript text and extracted course/grade data for the user |
| `uploadSyllabus(fileName, fileText)` | action | Sends text to Gemini for extraction, stores result, returns extracted tasks for review |
| `confirmSyllabusTasks(syllabusId, tasks)` | mutation | Saves confirmed extracted tasks to the tasks table |
| `updateUserSettings(fields)` | mutation | Updates user's work hours, focus block length, and study profile fields |
| `getCalendarAvailability()` | action | Calls Google Calendar API and returns free time blocks within preferred work hours |

### Google Calendar Integration

- OAuth scopes needed: `https://www.googleapis.com/auth/calendar.readonly`
- Calendar tokens should be stored per user in Convex (encrypted)
- Availability computation: intersect preferred work hours (from onboarding) with gaps between calendar events for the next 7 days

### Gemini Prompt for Syllabus Parsing

Suggested prompt structure:

```
You are parsing a course syllabus. Extract all assignments and exams with their due dates.

Syllabus text:
{syllabusText}

Return JSON: {
  "tasks": [{ "title": string, "dueDate": "YYYY-MM-DD", "type": "Essay|Problem Set|Exam Prep|Coding" }]
}
```

### Responsibilities

- **Transcript upload + parsing:** Onboarding UI update and Convex storage
- **Syllabus upload + Gemini extraction:** File upload UI, Convex action, review flow
- **Settings dashboard:** Profile form reuse, settings page UI, update mutation
- **Google Calendar integration:** OAuth scopes, Calendar API action, availability display
- **Backlog/polish:** Date picker, responsive design, sidebar routing

### Dependencies

- Convex schema updates must be agreed on before backend mutations are implemented
- Syllabus extraction depends on Gemini action patterns established in Iteration 1
- Google Calendar integration requires OAuth token storage to be in place before the action is built

---

## Task Breakdown

| # | Task | Type | Assignee(s) | Requirement |
|---|---|---|---|---|
| TBD | **R7: Transcript Upload in Onboarding** | feature | TBD | R7 |
| TBD | &nbsp;&nbsp;Add transcript upload field to onboarding UI | task | TBD | R7 |
| TBD | &nbsp;&nbsp;Implement `uploadTranscript` mutation and Gemini parsing action | task | TBD | R7 |
| TBD | **R8: Syllabus Upload and Due Date Extraction** | feature | TBD | R8 |
| TBD | &nbsp;&nbsp;Build syllabus upload UI with file picker and manual text fallback | task | TBD | R8 |
| TBD | &nbsp;&nbsp;Implement `uploadSyllabus` Gemini action and `confirmSyllabusTasks` mutation | task | TBD | R8 |
| TBD | &nbsp;&nbsp;Build extracted task review flow (edit/remove/confirm before saving) | task | TBD | R8 |
| TBD | **R9: Settings Dashboard** | feature | TBD | R9 |
| TBD | &nbsp;&nbsp;Build settings page UI reusing ProfileForm and WorkHoursSelector | task | TBD | R9 |
| TBD | &nbsp;&nbsp;Implement `updateUserSettings` mutation and wire to settings form | task | TBD | R9 |
| TBD | **R10: Google Calendar Availability Integration** | feature | TBD | R10 |
| TBD | &nbsp;&nbsp;Add Google Calendar OAuth scope and token storage | task | TBD | R10 |
| TBD | &nbsp;&nbsp;Implement `getCalendarAvailability` action and availability display on dashboard | task | TBD | R10 |
| 76 | Add date picker for add/edit task modal | feature | TBD | — |
| 75 | Fix responsive design for various screen sizes | bug | TBD | — |
| 74 | Route sidebar logo and user info clicks to correct pages | task | TBD | — |
| TBD | **R11: Class Website Upload (Nice-to-Have)** | feature | TBD | R11 |
| TBD | &nbsp;&nbsp;Build class website URL input UI and extracted task review screen | task | TBD | R11 |
| TBD | &nbsp;&nbsp;Implement Convex action to fetch and parse class website for assignment data | task | TBD | R11 |
| 58 | Modularize existing pages into reusable components *(backlog)* | task | riatalwar | — |
| 56 | Refactor timemaxx.pen to use reusable components *(backlog)* | task | riatalwar | — |

