# Timemaxx

An AI-powered study scheduler that estimates task time and builds personalized study plans.

## Deployment

On each push to `master`, the GitHub Actions CD workflow (`.github/workflows/cd.yml`) deploys three things:

- **Convex backend** — `npx convex deploy` pushes schema, functions, and env vars
- **Frontend** — built and uploaded to GitHub Pages
- **Mastra agent server** — `npx mastra server deploy` pushes to Mastra Cloud and updates `MASTRA_URL` on Convex

A separate Netlify site (configured via `netlify.toml`) builds the frontend on its own CI and serves the iteration 4 deployment.

**Deployed site (Iteration 1–3):** [https://cs423sp26-homeworks.github.io/team-04/](https://cs423sp26-homeworks.github.io/team-04/)
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
For Gemini API key setup (used by Convex for embeddings only), see the [Gemini API Key Setup](guides/gemini-api-key-setup.md) guide.
For Mastra (AI agent server), the **Anthropic** key it needs (also handles task estimation, syllabus / transcript parsing, schedule slot selection, and chat), and the ngrok `MASTRA_URL` flow, see [Mastra AI Agent Server](#mastra-ai-agent-server).
For ngrok tunnel setup (required for Mastra + Convex), see the [ngrok Setup](guides/ngrok-setup.md) guide.
For dev-only "Continue as Guest" sign-in, see [Anonymous Sign-In](docs/anonymous-sign-in.md).
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

Configure three keys for local development:

- **Anthropic** — required by every Mastra agent (chat, task estimation, syllabus / transcript parsing, schedule slot selection).
- **Gemini** — required by Convex for embeddings (`gemini-embedding-001`, 3072-dim) used in chat-history RAG and task/course similarity search. Not used elsewhere.
- **Mistral** — required by Mastra's `ocrWorkflow` for extracting text from uploaded syllabus / transcript PDFs.

### Gemini API key (Convex only)

```bash
# In your Convex deployment
npx convex env set GEMINI_API_KEY your_key_here
```

Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey). See [Gemini API Key Setup](guides/gemini-api-key-setup.md) for details.

### Anthropic API key (Mastra)

1. **Create an API key** in the [Anthropic Console](https://console.anthropic.com/settings/keys).

2. **Mastra (local):** Add to `mastra/.env` (gitignored):

   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

### Mistral API key (Mastra)

1. **Create an API key** at [console.mistral.ai](https://console.mistral.ai/).

2. **Mastra (local):** Add to `mastra/.env`:

   ```
   MISTRAL_API_KEY=your_key_here
   ```

See [Mastra Setup](guides/mastra-setup.md) for details.

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
  timemaxx.pen                      # Source-of-truth UI design file (open with the Pencil app)
shared/                             # Enums shared between frontend, backend, and Mastra
  chatEnums.ts
  courseEnums.ts
  preferenceEnums.ts
  taskEnums.ts
  userEnums.ts
frontend/
  src/
    pages/                          # Route-level page components
      LandingPage.tsx               # Public landing / sign-in page (/)
      OnboardingPage.tsx            # New-user setup (/onboarding)
      DashboardPage.tsx             # Main study dashboard (/dashboard)
      SchedulePage.tsx              # Schedule view (/schedule)
      ClassesPage.tsx               # Class management (/classes)
      SyllabusReviewPage.tsx        # Syllabus review flow (/syllabus-review)
      PreferencesPage.tsx           # Preferences page (/preferences)
      ProfilePage.tsx               # User profile (/profile)
    components/
      dashboard/                    # Dashboard cards, modals, stats, task & subtask UI
        StatCard.tsx, TaskCard.tsx, TaskModal.tsx, AddTaskModal.tsx,
        EditTaskModal.tsx, DeleteTaskModal.tsx, EstimationErrorModal.tsx,
        TaskFeedbackForm.tsx, ScheduleBlock.tsx, UpcomingSchedulePanel.tsx,
        StudyBlockRow.tsx, SubtaskCard.tsx, SubtaskReviewModal.tsx,
        StatusDropdown.tsx, EstimateBadge.tsx, WeightBadge.tsx,
        DueDateWarningBadge.tsx, types.ts, index.ts
      schedule/                     # Calendar grid, drag/drop, RHS class panel, mobile day view
        ScheduleTab.tsx, ScheduleHeader.tsx, TimeGrid.tsx, ClassPanel.tsx,
        MobileDayView.tsx, CalendarSelectorPopup.tsx, ScheduleBlockConflict.tsx,
        CalendarNudge.tsx, NoCalendarNudge.tsx, NudgeModal.tsx,
        overlapLayout.ts, utils.ts
      classes/                      # Class cards and syllabus upload UI
        ClassCard.tsx, SyllabusUploadModal.tsx
      syllabus/                     # Syllabus task review components
        TaskReviewCard.tsx, TaskTypePills.tsx, types.ts
      profile/                      # Profile form fields and account actions
        ProfileField.tsx, ProfileAvatar.tsx, ProfileActions.tsx, DeleteAccountModal.tsx
      onboarding/                   # Onboarding shells and navigation
        OnboardingStepShell.tsx, OnboardingNav.tsx
      landing/                      # Landing page presentation components
        LandingHeroPanel.tsx, LandingLoginCard.tsx, BrandLogo.tsx
      ui/                           # Shared base UI primitives
        Button.tsx, Modal.tsx, FileUpload.tsx, Selector.tsx, Toggle.tsx,
        DatetimePicker.tsx, index.ts
      prompt-kit/                   # Reused chat UI primitives (message, scroll, input, loader)
        chat-container.tsx, message.tsx, prompt-input.tsx, scroll-button.tsx, loader.tsx
      AppLayout.tsx                 # Authenticated layout with sidebar + chatbot
      Sidebar.tsx                   # App sidebar navigation
      MobileTopBar.tsx              # Mobile-only top bar
      ChatBot.tsx                   # Maxx chat widget (calls Convex /api/chat → Mastra)
      AcademicProfileSummary.tsx    # Academic profile display
      TranscriptUpload.tsx          # Transcript file upload
      ParsingAnimation.tsx          # Loading animation shown during AI parsing
      DifficultyRating.tsx          # Task / class difficulty rating widget
      CourseSelector.tsx            # SIS-backed course search/selection
      CoursesList.tsx, CoursesForm.tsx
      PreferencesForm.tsx, ProfileForm.tsx
      WorkHoursSelector.tsx         # Weekly work-hours picker
      DueDateRowWithCalendar.tsx, DueTimeField.tsx
      icons.tsx                     # Inline SVG icon components
    hooks/                          # Reusable React hooks (useIsMobile, useResizable)
    utils/                          # Frontend helpers (date, color, sis cache, etc.)
    constants.ts, types.ts, validators.ts
    main.tsx                        # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                         # Route definitions + auth redirects
  tests/                            # Frontend behavioral tests (Vitest + React Testing Library)
backend/
  convex-tests/
    helpers.ts                      # Shared Convex test helpers (e.g., test user/session setup)
  convex/
    schema.ts                       # Convex database schema
    auth.ts, auth.config.ts         # Convex Auth (Google + optional Anonymous) configuration
    http.ts                         # HTTP router (auth routes, /api/calendar/callback, /api/chat)
    http_chat.ts                    # Hono app handling POST /api/chat → Mastra → save to DB
    calendarOAuthCallback.ts        # Google Calendar OAuth callback handler
    ai/                             # AI actions (no "use node" — runs on Convex runtime)
      estimateTaskTime.ts, requestEstimateTaskTime.ts, estimateSubtasksBatch.ts,
      uploadSyllabus.ts, parseTranscript.ts, generateAcademicProfile.ts, embeddings.ts
    actions/                        # Node.js-runtime actions ("use node" required)
      autoRescheduleConflicts.ts, entityResolution.ts, generateSubtasks.ts
    functions/                      # Convex-runtime actions (no "use node")
      scheduleAllBlocks.ts, scheduleBlock.ts, scheduleSubtask.ts,
      requestEstimateSubtaskTime.ts, requestGenerateSubtasks.ts,
      exportStudyBlocksToCalendar.ts, fetchCalendarEvents.ts,
      getCalendarAvailability.ts, initiateGoogleCalendarOAuth.ts, jhuCourses.ts
    queries/                        # Read-only Convex queries
      tasks.ts, subtasks.ts, users.ts, calendar.ts, studyBlocks.ts,
      userCourses.ts, chatMessages.ts, chatSessions.ts, chatChunks.ts
    mutations/                      # Data-write Convex mutations
      tasks.ts, subtasks.ts, users.ts, calendar.ts, studyBlocks.ts,
      userCourses.ts, syllabi.ts, timeEstimate.ts,
      chatMessages.ts, chatSessions.ts, chatChunks.ts, chatChunkEmbeddings.ts
    lib/                            # Shared backend helpers (Mastra client, gemini embeddings, scheduling, retrieval, sanitization, calendar crypto)
      prompts/                      # Server-side prompt templates (estimateTaskTime, scheduleBlock, mastraChatContext)
    dev/                            # Dev-only modules (CLI/dashboard; not wired into prod flows)
      localRetrievalTest.ts         # `inspectRetrievalForTask` — see guides/convex-retrieval-debug.md
    tests/                          # Convex unit/integration tests
    _generated/                     # Convex generated API/types (do not edit manually)
mastra/                             # Mastra AI agent server (separate process — see Mastra section)
  src/mastra/
    index.ts                        # Registers agents and workflows with `new Mastra({...})`
    agents/                         # supervisor, task, course, schedule, feedback, estimation,
                                    # subtask, syllabus, transcript, courseAnalyst, academicProfile
    workflows/                      # chat, estimation, batchEstimation, scheduling, ocr, parse, etc.
    lib/prompts/                    # Per-agent system prompts and Zod output schemas
    lib/schemas/                    # Shared Zod schemas
  src/evals/                        # Mastra eval suite — see guides/mastra-eval-suite.md
e2e/                                # Playwright end-to-end tests — see e2e/README.md
.github/workflows/                  # ci.yml (build + lint + tests) and cd.yml (Convex + Pages + Mastra Cloud deploy)
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
| `/api/chat` (POST) | `http_chat.ts` (Hono) | Chat assistant endpoint — proxies to the Mastra `chatWorkflow` and persists messages |

## Documentation

- Project docs index: [`docs/README.md`](docs/README.md) — PRD, team agreement, iteration plans, and topic deep-dives (prompt injection prevention, anonymous sign-in)
- Guides index: [`guides/README.md`](guides/README.md) — setup walkthroughs (Google auth, Calendar, Gemini for embeddings, Anthropic via Mastra, ngrok, SIS), CI/CD, testing, scheduling algorithm, retrieval debug, Mastra eval suite
- E2E test conventions: [`e2e/README.md`](e2e/README.md)
