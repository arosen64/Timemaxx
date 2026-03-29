# Project Configuration

## Project Description

AI-powered study scheduler that estimates task time using Google Gemini and builds personalized study plans based on user preferences.

## Tech Stack

React + Vite + TypeScript + TailwindCSS + Convex + React Router + Google Gemini

## Commands

- Install dependencies: `npm install`
- Run backend: `npx convex dev` (run this first, in its own terminal)
- Run frontend: `npm run dev` (run this after the backend is running, in a separate terminal)
- Run tests: `npm test`
- Run linter: `<command>`
- Build for production: `npm run build`

## Code Style

- Formatting: (e.g., Prettier, Black, etc.)
- Linting: (e.g., ESLint, Ruff, etc.)
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
backend/
  convex/
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
    actions/                  # Side-effectful functions, e.g. Google Gemini API calls
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
