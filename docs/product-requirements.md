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

<!-- Features required for the minimum viable product. -->

#### Non-Essential (Nice-to-Have)

<!-- Features to add if time permits. -->

#### Out of Scope (Won't Have)

<!-- Features explicitly excluded from this project. -->

### Non-Functional Requirements

#### Performance

<!-- Response time, load capacity, etc. -->

#### Security

<!-- Authentication, authorization, data protection. -->

#### Privacy

<!-- How user data is stored, shared, and deleted. -->

#### Usability

<!-- Accessibility, responsive design, ease of use. -->

### Technology Stack

- **Frontend:**
- **Backend:**
- **Database:**
- **Auth:**
- **AI Services:**
- **External:**
- **Deployment:**
- **Testing:**

## Product Roadmap

<!-- For each iteration, define a goal and split features into must-have vs nice-to-have. -->

### Iteration 1

**Dates:** Week 5-6

**Goal:**

**Must-Have Features:**

**Nice-to-Have Features:**

### Iteration 2

**Dates:** Week 7-8

**Goal:**

**Must-Have Features:**

**Nice-to-Have Features:**

### Iteration 3

**Dates:** Week 10-11

**Goal:**

**Must-Have Features:**

**Nice-to-Have Features:**

### Iteration 4

**Dates:** Week 12-13

**Goal:**

**Must-Have Features:**

**Nice-to-Have Features:**
