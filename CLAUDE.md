# Project Configuration

## Project Description

AI-powered study scheduler that estimates task time using Google Gemini and builds personalized study plans based on user preferences.

## Tech Stack

React + Vite + TypeScript + TailwindCSS + Convex + React Router + Google Gemini + Mastra (AI agent server)

## Commands

- Install dependencies: `npm install`
- Run backend: `npx convex dev` (run this first, in its own terminal)
- Run Mastra agent server: `cd mastra && npx mastra dev` (run in its own terminal — required for the chatbot)
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
frontend/
  src/
    pages/                    # Route-level page components
      DashboardPage.tsx
      LandingPage.tsx
      OnboardingPage.tsx
      ClassesPage.tsx
      SchedulePage.tsx
      PreferencesPage.tsx
      ProfilePage.tsx
      SyllabusReviewPage.tsx
    components/               # Reusable UI components
      dashboard/
      classes/
      schedule/
      profile/
      onboarding/
      syllabus/
      landing/
      ui/
    main.tsx                  # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                   # Route definitions
mastra/
  src/
    mastra/
      index.ts                  # Registers all agents with new Mastra({ agents: { ... } })
      agents/
        chatAgent.ts            # "Maxx" — the chat assistant agent
backend/
  convex/
    dev/                      # Dev-only modules (CLI/dashboard; not wired into prod flows)
      localRetrievalTest.ts   # local CLI/dashboard testing: inspectRetrievalForTask
    schema.ts                 # Convex database schema
    queries/                  # Read-only data fetching functions (useQuery)
      tasks.ts
      users.ts
      calendar.ts
      studyBlocks.ts
      userCourses.ts
    mutations/                # Write operations that modify the database (useMutation)
      tasks.ts
      users.ts
      calendar.ts
      studyBlocks.ts
      userCourses.ts
      syllabi.ts
      timeEstimate.ts
    http.ts                   # HTTP router — auth, CORS, and makeApiHandler factory (Hono-based)
    http_chat.ts              # Hono app handling POST /api/chat → Mastra → save to DB
    ai/                       # AI actions (Mastra, Gemini, embeddings; "use node" where required)
      estimateTaskTime.ts, requestEstimateTaskTime.ts, estimateSubtasksBatch.ts,
      uploadSyllabus.ts, parseTranscript.ts, generateAcademicProfile.ts,
      embeddings.ts, generateSubtasks.ts
    actions/                  # Node.js-runtime actions only ("use node" required)
      autoRescheduleConflicts.ts, entityResolution.ts
    functions/                # Convex-runtime actions (no "use node")
      exportStudyBlocksToCalendar.ts
      fetchCalendarEvents.ts
      getCalendarAvailability.ts
      initiateGoogleCalendarOAuth.ts
      jhuCourses.ts
      requestEstimateSubtaskTime.ts
      requestGenerateSubtasks.ts
      scheduleAllBlocks.ts
      scheduleBlock.ts
      scheduleSubtask.ts
```

Routes: `/` (landing) → `/onboarding` (new users) → `/dashboard` → `/profile` → `/schedule` → `/preferences` → `/classes` → `/syllabus-review`

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
