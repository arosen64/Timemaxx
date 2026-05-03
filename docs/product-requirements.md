# Product Requirement Document

## Overview

### Problem Statement

Hopkins students often struggle with time management when juggling coursework across multiple platforms. While final due dates for assignments and exams are typically recorded, the fragmented nature of academic tools makes it difficult to block off their time effectively or create a proactive plan for a balanced semester without students having to invest significant time. As a result, students are often disorganized in their approach to completing course tasks, leading to last-minute stress and inefficient schedules that could have been avoided with proper planning.

### Proposed Solution

Timemaxx is a web application that analyzes user-provided information, including syllabi, transcripts, and courses, to generate an optimal work schedule that helps students complete their work successfully and on time. By leveraging AI agents to  estimate the time required for completing assignments and studying for exams, the app proactively integrates work blocks into a student’s schedule, transforming static due dates into actionable plans. The platform will utilize AI to optimally segment students’ worktime so that time is allocated for difficult assignments and is scheduled at points in the student’s day where they are the most productive. Students will be able to integrate the generated schedules into their personal calendars and use the in-platform calendar.

### Target Users

Hopkins students who struggle to anticipate workload and maintain a balanced academic schedule, particularly those managing heavy course loads or multiple deadlines at once.

### AI Component


Timemaxx will have two primary AI components:

**Processing:** Automated processing of unstructured data from syllabi and course websites, transforming them into structured task lists with expected due dates and a visualization of assignments that need to be completed.

**Planning:** Intelligent estimation and scheduling of time for assignments and exam prep based on task type and user history, integrated with Google Calendar and Tasks. We will collect user history of how long it took the user to study for a particular exam or complete a project and grades in similar or prerequisite coursework during onboarding, to help tune the system. This information will be collected through a setup survey that a user must fill out during profile creation as well as through the upload of a transcript to enhance the student profile.

Without AI, it would be considerably more difficult to block off time work appropriately, especially given a busy student’s schedule with a lot of extracurriculars and external tasks. It would also be more difficult to extract the important dates for each class, given the unstructured nature of syllabi, transcripts, and the wide range of platforms used at Hopkins. With this data, AI can generate customized study plans with detail and customization that would otherwise not be possible.

### Similar Existing Solutions


**Clockwise** - focuses on meeting optimization and focus time/ideal day planning, but lacks deep academic integration and assignment-level planning.  

**Notion AI Calendar** - Integrates with Apple or Google Calendar and allows Notion AI to search and answer questions related to your calendar events. However, this calendar requires manual entry of assignments and tasks and does not provide estimated assignment completion times.  

**Motion** - Instantly prioritizes tasks, alerts you of at-risk deadlines, schedules meetings optimally, and protects your deep work time. This application lacks basic sync with LMS platforms such as Canvas and Gradescope, requiring students to replicate this data manually.  

**SyllySync** - Allows syllabi uploads and auto-syncs due dates to the calendar. Additionally, the app contains a built-in study assistant and grade calculator to prepare for exams and test expected grades. Although SyllySync parses syllabi, it does not provide effort estimations. Additionally, the integration scope is limited, as it does not pull data directly from systems such as SIS, Gradescope, and Canvas.  

**Courseway** - An iOS app that helps students organize and manage their semester coursework. It combines syllabus details, deadlines, and notifications into a mobile-friendly planner. This application is mobile-first, so it lends towards simpler reminders and notifications, rather than comprehensive planning. Additionally, it still requires extensive manual setup and maintenance.

## Requirements

### Functional Requirements

#### Essential (Must-Have)


- Users can log in using their Google account.
- Users must complete a required onboarding process including:
  - Basic information about study habits and preferences (preferred work hours, highest productivity times, focus block length).
  - Transcript upload to identify strong and weak subject areas.
- The system allows syllabi uploads and extracts relevant exams and assignment due dates. In case of failure, retries and manual text input are allowed.
- Users can manually add, edit, or remove tasks, subtasks, and time estimates.
- The system pulls the student’s availability from Google Calendar and schedules task-related time blocks in the in-app calendar; scheduled blocks are exported to Google Calendar (one-way sync).
- An AI chatbot is available on the dashboard and can create, update, and delete tasks, courses, and study blocks, and update user habits based on input.
- The system generates optimal time estimates for each task and subtask based on:
  - Task type (problem set, essay, coding assignment, exam preparation, lab, reading, presentation, etc.).
  - Performance in prerequisite or related courses from transcript analysis.
  - Course difficulty indicators (credit hours, user-rated difficulty).
  - Assignment weight (extracted from syllabus or set manually).
  - Relevant past chat context retrieved via vector search.
- The system provides finer task breakdowns for large assignments, homework, or midterm planning when sufficient information is provided.
- Users can provide feedback on time estimates.
- Manual time and assignment-weight overrides are supported.
- Users can mark study blocks as completed; the system reschedules conflicted or unfinished blocks on demand.
- The system learns from edits to the plan and user feedback for future assignments.
- The system provides a daily outline of time to spend on upcoming tasks (today's tasks panel and weekly stats).
- Users can view a daily summary and upcoming deadlines in a centralized dashboard.
- Users have a settings dashboard where they can modify their preferences.

#### Non-Essential (Nice-to-Have)

- Users can set priority levels for tasks.
- Users can upload class websites to provide assignment data.
- Integration with Gradescope API and Instructure Canvas API to pull active courses, assignment titles, and due dates.
- Email integration to schedule meetings in Calendar or offer meeting times.
- Users can connect email accounts so the system can scan academic emails for exams, meetings, and assignments.

#### Out of Scope (Won't Have)

- Integration with non-Google calendar and task providers.
- Two-way sync with Google Calendar (only one-way export from Timemaxx → Google Calendar is supported).
- Google Tasks integration.
- Native mobile apps (web-responsive design only).
- Real-time collaboration features.
- Grade prediction or GPA calculator.
- Study assistance features (e.g., flashcards, practice quizzes).

### Non-Functional Requirements

#### Performance

- Pages load in under 2 seconds.
- Study schedule generation in under 2 seconds.
- Document upload and initial ingestion in under 10 seconds.
- Document parsing and AI-based extraction in under 30 seconds.

#### Security

- Authentication via Google OAuth.
- All API endpoints require authenticated requests using OAuth tokens.
- Role-based access control ensures users can only access their own data.
- Rate limiting of 120 requests per minute per user.
- HTTPS enforced for all API traffic.

#### Privacy

- All stored user data and documents encrypted with:
  - AES-256 at rest
  - SSL/TLS in transit
- Data retention policy:
  - Active account data retained indefinitely.
  - Deleted account data permanently removed within 30 days.
  - Only the most recent transcript is retained.
  - Syllabi retained indefinitely unless manually deleted.

#### Usability

- Initial onboarding survey takes no longer than 2 minutes to complete.

### Technology Stack

- **Frontend:** React, Vite, TypeScript, TailwindCSS, React Router
- **Backend:** TypeScript (Convex serverless functions, Hono HTTP routes)
- **Database:** Convex (with vector indexes for embeddings)
- **Auth:** Google OAuth (via Convex Auth); dev-only anonymous provider
- **AI Services:** Google Gemini (parsing, embeddings), OpenAI GPT-4o mini (time estimation), Anthropic Claude (chat agents via Mastra)
- **Agent Framework:** Mastra (multi-agent supervisor + specialists, deployed to Mastra Cloud)
- **External:**
  - Google Calendar API (read availability + write study-block events)
  - JHU SIS API (course catalog lookup)
- **Deployment:** GitHub Actions (CI/CD) → Convex Cloud + GitHub Pages + Mastra Cloud; Netlify (iteration 4 frontend)
- **Testing:** Vitest (backend + frontend), Playwright (end-to-end)

## Product Roadmap

<!-- For each iteration, define a goal and split features into must-have vs nice-to-have. -->

### Iteration 1

**Dates:** Week 5-6

**Goal:** Auth, Basic UI, and Initial Time Estimation

**Must-Have Features:**

- Users can log in using their Google account
- Manual assignment entry: user pastes assignment description
- The system generates optimal time estimates for each task based on task type (e.g., problem set, essay, coding assignment, exam preparation)
- User completes basic onboarding survey with information about their study habits and preferences (e.g., preferred work hours, highest productivity times, focus block length)
- Users' data from onboarding process is retained between sessions so they can return to the application without re-entering information

**Nice-to-Have Features:**

- Users can access a central dashboard that displays their task list, with the ability to manually add, edit, or remove tasks

### Iteration 2

**Dates:** Week 7-8

**Goal:** File Parsing and Improved Time Estimation

**Must-Have Features:**

- Onboarding survey is updated with transcript upload option
- The system allows syllabi uploads and extracts relevant exams and assignment due dates. In case of failure, retries and text inputs are allowed
- Users have a settings dashboard where they can modify their original preferences
- The system pulls the student’s availability from Google Calendar and evaluates what time blocks the user is available and can schedule a task for that time

**Nice-to-Have Features:**

- Users can upload class websites to provide the system with assignment data

### Iteration 3

**Dates:** Week 10-11

**Goal:** System Learns Study Habits

**Must-Have Features:**

- Adaptive and accurate time block estimation using users transcripts, prior performance in classes (particularly pre recs), and user context given in text to the chatbot about reflection on certain tasks to give more context to particular skills that would translate to work time.
- An AI chatbot will be present on the dashboard and will be able to modify the schedule and update user habits based on input and feedback
- Sync tasks to be able to be automatically exported to users' Google Calendar

**Nice-to-Have Features:**

- System integrates with Instructure Canvas API to pull active courses, assignment titles, and due dates
- System integrates with Gradescope API to pull active courses, assignment titles, and due dates

### Iteration 4

**Dates:** Week 12-13

**Goal:** Scheduling Intelligence, Assignment Weights, and Chatbot Agents

**Must-Have Features:**

- Scheduling algorithm enhanced with assignment-weight-based priority and a pre-scoring layer (time-of-day, day-of-week, deadline-bucket bias, difficulty bonus)
- Assignment weights extracted from syllabi, displayed in syllabus review, shown on task cards, and used by the scheduler
- Dashboard stat cards updated: "Study Time Today" (today's scheduled minutes) and "Study Blocks This Week" (total and completed)
- Due-date warning badge on tasks where available time before the deadline is less than the estimated time
- Manual time estimate override with clear UI indication of estimate source (AI, subtask-summed, or manual)
- Chatbot scheduling agent (`scheduleAgent`) to trigger block or task scheduling
- Chatbot task agent extended with subtask support: generate, list, and update subtask time estimates via chat
- Chatbot course agent (`courseAgent`) to create, list, and update courses via chat
- Mobile-responsive calendar (day view) and task card layouts

**Nice-to-Have Features:**

- SIS course import via chatbot course agent
