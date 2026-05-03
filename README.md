# Timemaxx

An AI-powered study scheduler that estimates task time and builds personalized study plans.

## Deployment

The application is deployed via **GitHub Actions** to **GitHub Pages**. On each push to `master`, the CD workflow builds the frontend, deploys the Convex backend, and publishes to GitHub Pages.

**Deployed site (Iteration 1-3):** [https://cs423sp26-homeworks.github.io/team-04/](https://cs423sp26-homeworks.github.io/team-04/)
**Deployed site (Iteration 4):** [https://timemaxx.netlify.app](https://timemaxx.netlify.app)

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
For Gemini API key setup (details and troubleshooting), see the [Gemini API Key Setup](guides/gemini-api-key-setup.md) guide.
For Mastra (AI agent server), **Gemini and Anthropic** keys for Convex/Mastra, and the ngrok `MASTRA_URL` flow, see [Mastra AI Agent Server](#mastra-ai-agent-server).
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

Configure **both** a Gemini key and an Anthropic key for local development: Convex uses Gemini for several features and Anthropic for others; Mastra’s `.env` should include both so nothing fails as you switch models or run different code paths. See [Gemini API Key Setup](guides/gemini-api-key-setup.md) for more detail on Gemini.

### Gemini API key (Mastra and Convex)

The Convex backend uses Google Gemini for syllabus parsing, embeddings, transcript parsing, and related flows (`GEMINI_API_KEY`). Mastra expects the same key under the variable name the Google AI SDK uses.

1. **Get a key** from [Google AI Studio](https://aistudio.google.com/app/apikey).

2. **Convex (your deployment):**

   ```bash
   npx convex env set GEMINI_API_KEY your_key_here
   ```

3. **Mastra (local):** Add to `mastra/.env` (same key as Convex; different variable name required by the SDK):

   ```
   GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
   ```

### Anthropic API key (Mastra and Convex)

Mastra chat agents use Claude via `@ai-sdk/anthropic`. The Convex backend uses the same key for task time estimation and related Anthropic calls (`ANTHROPIC_API_KEY` in server code). Configure **both** Mastra and Convex:

1. **Create an API key** in the [Anthropic Console](https://console.anthropic.com/settings/keys).

2. **Mastra (local):** Add to `mastra/.env` (same file as above; it is gitignored):

   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

3. **Convex (your deployment):**

   ```bash
   npx convex env set ANTHROPIC_API_KEY your_key_here
   ```

   Confirm with `npx convex env list`. Each developer must set Convex env vars on their own dev deployment.

### Run Mastra

```bash
cd mastra
npm install   # first time only
npm run dev   # starts on http://localhost:4111
```

### Expose Mastra via ngrok

Convex is a cloud backend and cannot reach `localhost` directly. Run ngrok to create a public tunnel:

```bash
ngrok http 4111
```

Copy the `https://` forwarding URL that ngrok prints (e.g. `https://abc123.ngrok-free.app`).

### Set the Mastra URL in Convex

```bash
npx convex env set MASTRA_URL https://abc123.ngrok-free.app/mastra
```

> The `/mastra` path suffix is required — Mastra serves its API under that prefix.

You need to repeat the ngrok tunnel and `MASTRA_URL` update each time you restart ngrok, as the tunnel URL changes.

### Set `SITE_URL` for local CORS

The chat HTTP route uses `SITE_URL` as its allowed CORS origin. If your dev Convex deployment's `SITE_URL` is set to a deployed URL, sending a chat message from `http://localhost:5173` will be blocked by the browser. Set it to your local frontend once per dev deployment:

```bash
npx convex env set SITE_URL http://localhost:5173
```

> Only do this on your **dev** deployment. The CD workflow manages `SITE_URL` on the prod deployment. See [Mastra Setup, Step 5](guides/mastra-setup.md) for the full explanation.

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
