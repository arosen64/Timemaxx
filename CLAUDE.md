# Project Configuration

## Project Description

AI-powered study scheduler that estimates task time using Google Gemini and builds personalized study plans based on user preferences.

## Tech Stack

React + Vite + TypeScript + TailwindCSS + Convex + React Router + Google Gemini

## Commands

- Install dependencies: `npm install`
- Run development server: `npm run dev` (also run `npx convex dev` in a separate terminal)
- Run tests: `<command>`
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
    pages/       # Route-level page components
    components/  # Reusable UI components
    main.tsx     # App entry point (ConvexProvider + BrowserRouter)
    App.tsx      # Route definitions
backend/
  convex/
    schema.ts      # Convex database schema
    queries/       # Read-only data fetching functions (useQuery)
    mutations/     # Write operations that modify the database (useMutation)
    actions/       # Side-effectful functions, e.g. Google Gemini API calls
```

Routes: `/` (landing) → `/onboarding` (new users) → `/dashboard`

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
