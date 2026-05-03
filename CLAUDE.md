# Project Configuration

## Project Description

AI-powered study scheduler that estimates task time using Google Gemini and builds personalized study plans based on user preferences.

## Tech Stack

React + Vite + TypeScript + TailwindCSS + Convex + React Router + Google Gemini + Mastra (AI agent server)

## Commands

- Install dependencies: `npm install`
- Run backend: `npx convex dev` (run this first, in its own terminal)
- Run Mastra agent server: `cd mastra && npm run dev` (run in its own terminal — required for the chatbot)
- Run frontend: `npm run dev` (run after backend and Mastra are running, in a separate terminal)
- Run tests: `npm test` (Vitest unit/component tests)
- Run E2E tests: `npm run test:e2e` (Playwright; first run requires `npm run test:e2e:install`)
- Run linter: `npm run lint:fix`
- Build for production: `npm run build`

> The Mastra server must be publicly reachable for Convex HTTP actions to call it.
> In local dev, use ngrok to create a public tunnel. First-time setup (once per machine):
> 1. Sign up at https://ngrok.com and copy your authtoken from the dashboard
> 2. `ngrok config add-authtoken <your-token>`
> 3. `ngrok http 4111` — copy the `https://` URL it prints
> 4. `npx convex env set MASTRA_URL <ngrok-url>/mastra`
>
> See `guides/ngrok-setup.md` for the full walkthrough. The ngrok URL changes each session (free tier) — repeat steps 3–4 each time.

## Code Style

- Formatting: Prettier
- Linting: ESLint
- Naming conventions: camelCase for variables/functions, PascalCase for components

## Architecture

```
shared/                       # Enums shared between frontend, backend, and Mastra
  chatEnums.ts, courseEnums.ts, preferenceEnums.ts, taskEnums.ts, userEnums.ts
frontend/
  src/
    pages/                    # Route-level page components
      DashboardPage.tsx, LandingPage.tsx, OnboardingPage.tsx, ClassesPage.tsx,
      SchedulePage.tsx, PreferencesPage.tsx, ProfilePage.tsx, SyllabusReviewPage.tsx
    components/               # Reusable UI components
      dashboard/              # Task cards, modals, stats, subtask UI, badges (Estimate/Weight/DueDateWarning)
      schedule/               # ScheduleTab, TimeGrid, ClassPanel (RHS), MobileDayView, conflict UI
      classes/                # ClassCard, SyllabusUploadModal
      syllabus/               # TaskReviewCard, TaskTypePills (used by /syllabus-review)
      profile/                # ProfileField, ProfileAvatar, ProfileActions, DeleteAccountModal
      onboarding/             # OnboardingStepShell, OnboardingNav
      landing/                # LandingHeroPanel, LandingLoginCard, BrandLogo
      ui/                     # Button, Modal, FileUpload, Selector, Toggle, DatetimePicker
      prompt-kit/             # Chat UI primitives (chat-container, message, prompt-input, scroll-button, loader)
      AppLayout.tsx           # Authenticated layout (Sidebar + ChatBot + outlet)
      ChatBot.tsx             # Maxx chat widget (calls Convex /api/chat → Mastra)
      Sidebar.tsx, MobileTopBar.tsx, icons.tsx
      AcademicProfileSummary.tsx, TranscriptUpload.tsx, ParsingAnimation.tsx,
      DifficultyRating.tsx, CourseSelector.tsx, CoursesList.tsx, CoursesForm.tsx,
      PreferencesForm.tsx, ProfileForm.tsx, WorkHoursSelector.tsx,
      DueDateRowWithCalendar.tsx, DueTimeField.tsx
    hooks/                    # useIsMobile, useResizable
    utils/                    # date, color, sis cache, time, term, assignment-weight helpers
    constants.ts, types.ts, validators.ts
    main.tsx                  # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                   # Route definitions + auth redirects
  tests/                      # Vitest + React Testing Library component tests
mastra/
  src/
    mastra/
      index.ts                # Registers all agents and workflows with new Mastra({ agents, workflows })
      agents/                 # supervisor, task, course, schedule, feedback, estimation,
                              # subtask, syllabus, transcript, courseAnalyst, academicProfile
      workflows/              # chat, estimation, batchEstimation, scheduling, ocr, parse, etc.
      lib/prompts/            # Per-agent system prompts and Zod output schemas
      lib/schemas/            # Shared Zod schemas (chatSchemas)
    evals/                    # Mastra eval suite — see guides/mastra-eval-suite.md
backend/
  convex/
    schema.ts                 # Convex database schema
    auth.ts, auth.config.ts   # Convex Auth (Google + optional Anonymous in dev)
    http.ts                   # HTTP router — auth routes, /api/calendar/callback, /api/chat (Hono-based)
    http_chat.ts              # Hono app handling POST /api/chat → Mastra → save to DB
    calendarOAuthCallback.ts  # Google Calendar OAuth callback handler
    queries/                  # Read-only data fetching functions (useQuery)
      tasks.ts, subtasks.ts, users.ts, calendar.ts, studyBlocks.ts, userCourses.ts,
      chatMessages.ts, chatSessions.ts, chatChunks.ts
    mutations/                # Write operations that modify the database (useMutation)
      tasks.ts, subtasks.ts, users.ts, calendar.ts, studyBlocks.ts, userCourses.ts,
      syllabi.ts, timeEstimate.ts,
      chatMessages.ts, chatSessions.ts, chatChunks.ts, chatChunkEmbeddings.ts
    ai/                       # AI actions on the Convex runtime (no "use node")
      estimateTaskTime.ts, requestEstimateTaskTime.ts, estimateSubtasksBatch.ts,
      uploadSyllabus.ts, parseTranscript.ts, generateAcademicProfile.ts, embeddings.ts
    actions/                  # Node.js-runtime actions only ("use node" required)
      autoRescheduleConflicts.ts, entityResolution.ts, generateSubtasks.ts
    functions/                # Convex-runtime actions (no "use node")
      scheduleAllBlocks.ts, scheduleBlock.ts, scheduleSubtask.ts,
      requestEstimateSubtaskTime.ts, requestGenerateSubtasks.ts,
      exportStudyBlocksToCalendar.ts, fetchCalendarEvents.ts,
      getCalendarAvailability.ts, initiateGoogleCalendarOAuth.ts, jhuCourses.ts
    lib/                      # Shared backend helpers — gemini wrapper, sanitize, scheduling,
                              # retrieval, calendar crypto, chat workflow types, etc.
      prompts/                # XML-delimited prompt templates + Zod schemas for Gemini calls
    dev/                      # Dev-only modules (CLI/dashboard; not wired into prod flows)
      localRetrievalTest.ts   # `inspectRetrievalForTask` — see guides/convex-retrieval-debug.md
    tests/                    # Convex unit/integration tests (Vitest + convex-test)
    _generated/               # Convex generated API/types (do not edit manually)
e2e/                          # Playwright end-to-end tests — see e2e/README.md
.github/workflows/            # ci.yml (build + tests + e2e), cd.yml (Convex + Pages + Mastra Cloud)
```

Routes: `/` (landing) → `/onboarding` (new users) → `/dashboard` → `/profile` → `/schedule` → `/preferences` → `/classes` → `/syllabus-review`

HTTP endpoints: `/api/auth/callback/google` (Convex Auth), `/api/calendar/callback` (Google Calendar OAuth), `POST /api/chat` (chat assistant proxy to Mastra).

## Branch & Commit Conventions

- Branch pattern: `<author>/<type>/issue-<number>-<short-description>`
  - `type` must match the issue label: `feature`, `bug`, or `task`
- Never push directly to master
- Reference issues in commits: `Add file validation (#12)`
- Keep PRs under ~400 changed lines
- Use merge commits (no squash or rebase)

## Common Mistakes

<!-- TODO: Add patterns your team discovers during development -->

- [ ] Forgetting to reference the issue number in commits
- [ ] Pushing directly to master instead of creating a PR
- [ ] Creating issues for future iterations instead of the current one
