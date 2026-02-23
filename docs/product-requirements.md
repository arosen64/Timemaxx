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
- Users can manually add, edit, or remove tasks and time estimates.
- The system pulls the student’s availability from Google Calendar and schedules task-related time blocks and assignments in the in-app calendar, which is two-way synced with Google Calendar and Google Tasks.
- An AI chatbot is available on the dashboard and can modify the schedule and update user habits based on input.
- The system generates optimal time estimates for each task based on:
  - Task type (problem set, essay, coding assignment, exam preparation).
  - Performance in prerequisite or related courses from transcript analysis.
  - Course difficulty indicators (credit hours, level).
- The system provides finer task breakdowns for large assignments, homework, or midterm planning when sufficient information is provided.
- Users can provide feedback on time estimates.
- Manual time override is supported.
- Users can designate missed study blocks.
- The system learns from edits to the plan and user feedback for future assignments.
- The system provides a daily outline of time to spend on upcoming tasks.
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
- Native mobile apps (web-responsive design only).
- Real-time collaboration features.
- Grade prediction or GPA calculator.
- Study assistance features.

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

- **Frontend:** React, TypeScript, TailwindCSS  
- **Backend:** TypeScript
- **Database:** Convex
- **Auth:** Google OAuth
- **AI Services:** Google Gemini
- **External:** 
  - Google Calendar API  
  - Google Tasks API  
  - Canvas API  
- **Deployment:** GitHub Actions
- **Testing:** Jest

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

**Goal:** Centralized Dashboard and Email Scanning

**Must-Have Features:**

- Users can view a daily summary of their to-dos and upcoming deadlines in a centralized dashboard
- Final bug fixes and performance improvements
- Users can connect the system to their email so the system can scan academic emails for exams/ meetings/ assignments.

**Nice-to-Have Features:**

- Users can set priority levels for their tasks
- The application integrates with email to schedule meetings in Calendar/ offer times to meet.