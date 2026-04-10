# Timemaxx

An AI-powered study scheduler that estimates task time and builds personalized study plans.

## Deployment

The application is deployed via **GitHub Actions** to **GitHub Pages**. On each push to `master`, the CD workflow builds the frontend, deploys the Convex backend, and publishes to GitHub Pages.

**Deployed site:** [https://cs423sp26-homeworks.github.io/team-04/](https://cs423sp26-homeworks.github.io/team-04/)

If you encounter any issues with the deployed site, please reach out to a team member via Slack or email.

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [GitHub CLI (`gh`)](https://cli.github.com/) — used for issue, label, milestone, and PR management
- [Node.js](https://nodejs.org/) v18+

## Project Invites

For access to project invites (e.g., Convex, Google Cloud project), please contact a team member via Slack or email.

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd team-04

# Install dependencies
npm install

# Connect to Convex (creates .env.local with VITE_CONVEX_URL)
npx convex dev
```

For Google OAuth configuration, see the [Google Auth Setup](guides/google-auth-setup.md) guide.
For Google Calendar connection setup, see the [Google Calendar Connection Setup](guides/google-calendar-connection-setup.md) guide.
For SIS API key setup, see the [SIS API Key Setup](guides/sis-api-key-setup.md) guide.
For Gemini API key setup, see the [Gemini API Key Setup](guides/gemini-api-key-setup.md) guide.
For Mastra (AI agent server) setup, see the [Mastra Setup](#mastra-ai-agent-server) section below.
For ngrok tunnel setup (required for Mastra + Convex), see the [ngrok Setup](guides/ngrok-setup.md) guide.
For testing details, see the [Test Execution](guides/testing.md) guide.

## Running the Application

```bash
# Terminal 1 — Convex backend
npx convex dev

# Terminal 2 — Mastra AI agent server
cd mastra && npm run dev

# Terminal 3 — ngrok tunnel (required so Convex can reach Mastra)
ngrok http 4111

# Terminal 4 — Vite frontend
npm run dev
```

## Mastra AI Agent Server

The AI chat assistant runs through [Mastra](https://mastra.ai). Convex actions call Mastra over HTTP, so Mastra must be publicly reachable via an ngrok tunnel during local development.

### Step 1: Get a Gemini API Key

Mastra uses `gemini-2.5-flash` via the `@ai-sdk/google` package. Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey). See [Gemini API Key Setup](guides/gemini-api-key-setup.md) for details.

### Step 2: Configure Mastra's API Key

Add your key to `mastra/.env` (create the file if it doesn't exist):

```
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

> Note: this is the same key as `GEMINI_API_KEY` used in Convex — just a different variable name required by the AI SDK.

### Step 3: Run Mastra

```bash
cd mastra
npm install   # first time only
npm run dev   # starts on http://localhost:4111
```

### Step 4: Expose Mastra via ngrok

Convex is a cloud backend and cannot reach `localhost` directly. Run ngrok to create a public tunnel:

```bash
ngrok http 4111
```

Copy the `https://` forwarding URL that ngrok prints (e.g. `https://abc123.ngrok-free.app`).

### Step 5: Set the Mastra URL in Convex

```bash
npx convex env set MASTRA_URL https://abc123.ngrok-free.app/mastra
```

> The `/mastra` path suffix is required — Mastra serves its API under that prefix.

You need to repeat steps 4–5 each time you restart ngrok, as the tunnel URL changes.

### Frontend Environment Variable

The frontend also calls Mastra directly for streaming. Add this to `frontend/.env.local`:

```
VITE_MASTRA_URL=http://localhost:4111
```

This file is gitignored — each developer sets it locally.

## Running Tests

```bash
# Run all tests (backend + frontend)
npm test

# Run in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only backend tests
npx vitest run --project backend

# Run only frontend tests
npx vitest run --project frontend
```

## Building for Production

```bash
npm run build
```

## Project Structure

```
design/
  timemaxx.pen                      # Source-of-truth UI design file
frontend/
  src/
    pages/
      LandingPage.tsx               # Public landing / sign-in page (/)
      OnboardingPage.tsx            # New-user setup (/onboarding)
      DashboardPage.tsx             # Main study dashboard (/dashboard)
      SchedulePage.tsx              # Schedule view (/schedule)
      ClassesPage.tsx               # Class management (/classes)
      SyllabusReviewPage.tsx        # Syllabus review flow (/syllabus-review)
      PreferencesPage.tsx           # Preferences page (/preferences)
      ProfilePage.tsx               # User profile (/profile)
    components/
      dashboard/                    # Dashboard cards, modals, task UI
        StatCard.tsx
        TaskCard.tsx
        TaskModal.tsx
        AddTaskModal.tsx
        EditTaskModal.tsx
        DeleteTaskModal.tsx
        EstimationErrorModal.tsx
        TaskFeedbackForm.tsx
        ScheduleBlock.tsx
        UpcomingSchedulePanel.tsx
      schedule/                     # Schedule grid, conflict blocks, calendar picker
        ScheduleTab.tsx
        TimeGrid.tsx
        CalendarSelectorPopup.tsx
        ScheduleBlockConflict.tsx
      classes/                      # Class cards and syllabus upload UI
        ClassCard.tsx
        SyllabusUploadModal.tsx
      syllabus/                     # Syllabus task review components
        TaskReviewCard.tsx
        TaskTypePills.tsx
      profile/                      # Profile form fields and actions
        ProfileField.tsx
        ProfileAvatar.tsx
        ProfileActions.tsx
        DeleteAccountModal.tsx
      onboarding/                   # Onboarding shells and navigation
        OnboardingStepShell.tsx
        OnboardingNav.tsx
      landing/                      # Landing page presentation components
        LandingHeroPanel.tsx
        LandingLoginCard.tsx
        BrandLogo.tsx
      ui/                           # Shared base UI primitives
        Button.tsx
        Modal.tsx
        FileUpload.tsx
        Selector.tsx
        Toggle.tsx
      Sidebar.tsx                   # App sidebar navigation
      AcademicProfileSummary.tsx    # Academic profile display
      TranscriptUpload.tsx          # Transcript file upload
      DifficultyRating.tsx          # Task difficulty rating widget
      CourseSelector.tsx            # SIS-backed course search/selection
      CoursesList.tsx               # Enrolled courses list
      CoursesForm.tsx               # Course add/edit form
      PreferencesForm.tsx           # Study preferences form
      ProfileForm.tsx               # User profile edit form
      WorkHoursSelector.tsx         # Weekly work-hours picker
      DueDateRowWithCalendar.tsx    # Due date row with calendar picker
      DueTimeField.tsx              # Due time input field
    main.tsx                        # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                         # Route definitions + auth redirects
  tests/                    # Frontend behavioral tests (Vitest + React Testing Library)
backend/
  convex-tests/
    helpers.ts                      # Shared Convex test helpers (e.g., test user/session setup)
  convex/
    schema.ts                       # Convex database schema
    auth.ts                         # Convex Auth configuration
    http.ts                         # Convex HTTP routes
    calendarOAuthCallback.ts        # Google Calendar OAuth callback handler
    actions/                        # External API + AI actions (Gemini, SIS, Calendar)
      estimateTaskTime.ts
      requestEstimateTaskTime.ts
      generateAcademicProfile.ts
      parseTranscript.ts
      uploadSyllabus.ts
      fetchCalendarEvents.ts
      getCalendarAvailability.ts
      initiateGoogleCalendarOAuth.ts
      autoRescheduleConflicts.ts
      jhuCourses.ts
    queries/                        # Read-only Convex queries
      tasks.ts
      users.ts
      calendar.ts
      studyBlocks.ts
      userCourses.ts
    mutations/                      # Data-write Convex mutations
      tasks.ts
      users.ts
      calendar.ts
      studyBlocks.ts
      userCourses.ts
      syllabi.ts
      timeEstimate.ts
    lib/                            # Shared backend helpers/utilities
    tests/                          # Convex unit/integration tests
    _generated/                     # Convex generated API/types (do not edit manually)
```

## Routes

### Frontend Routes

| Path | Page | Access |
|---|---|---|
| `/` | LandingPage | Public |
| `/onboarding` | OnboardingPage | Authenticated |
| `/dashboard` | DashboardPage | Authenticated |
| `/schedule` | SchedulePage | Authenticated |
| `/profile` | ProfilePage | Authenticated |
| `/preferences` | PreferencesPage | Authenticated |
| `/classes` | ClassesPage | Authenticated |
| `/syllabus-review` | SyllabusReviewPage | Authenticated |

### Backend HTTP Routes

| Path | Handler | Purpose |
|---|---|---|
| `/api/auth/callback/google` | Convex Auth | Google auth callback |
| `/api/calendar/callback` | `calendarOAuthCallback` | Google Calendar OAuth callback |

## Documentation

- Guides index: `guides/README.md`
- Iteration plans: `docs/iteration-x-plan.md`
- Product Requirements Document: `docs/product-requirements.md`
- Team Information: `docs/team-agreement.md`
