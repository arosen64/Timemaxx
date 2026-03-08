# Timemaxx

An AI-powered study scheduler that estimates task time and builds personalized study plans.

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [GitHub CLI (`gh`)](https://cli.github.com/) — used for issue, label, milestone, and PR management
- [Node.js](https://nodejs.org/) v18+

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

## Running the Application

```bash
# In one terminal — starts the Convex backend
npx convex dev

# In another terminal — starts the Vite dev server
npm run dev
```

## Running Tests

```bash
# Run all tests (backend + frontend)
npm test

# Run in watch mode
npm run test:watch

# Run only backend tests
npx vitest run --project backend

# Run only frontend tests
npx vitest run --project frontend
```

## Project Structure

```
frontend/        # React + Vite + TailwindCSS app
  src/
    pages/       # Route-level page components
    components/  # Reusable UI components
    main.tsx     # App entry point
    App.tsx      # Route definitions
backend/
  convex/
    schema.ts      # Convex database schema
    queries/       # Read-only data fetching functions (useQuery)
    mutations/     # Write operations that modify the database (useMutation)
    actions/       # Side-effectful functions, e.g. Google Gemini API calls
```

## Documentation

- Iteration plans: `docs/iteration-x-plan.md`
- Product Requirements Document: `docs/product-requirements.md`
- Team Information: `docs/team-agreement.md`
