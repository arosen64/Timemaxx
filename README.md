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

## Building for Production

```bash
npm run build
```

## Project Structure

```
design/
  timemaxx.pen              # File for UI design 
frontend/
  src/
    pages/
      LandingPage.tsx       # Public landing / sign-in page (/)
      OnboardingPage.tsx    # New-user setup (/onboarding)
      DashboardPage.tsx     # Main study dashboard (/dashboard)
      ProfilePage.tsx       # User profile (/profile)
    components/
      AddTaskModal.tsx      # Modal for adding a new task
      PreferencesForm.tsx   # Study preferences form
      ProfileForm.tsx       # Profile editing form
      sidebar.tsx           # Dashboard sidebar navigation
      WorkHoursSelector.tsx # Weekly work-hours picker
    main.tsx                # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                 # Route definitions
  tests/                    # Frontend behavioral tests (Vitest + React Testing Library)
backend/
  convex/
    schema.ts               # Convex database schema
    auth.ts                 # Convex Auth configuration
    queries/
      users.ts              # User read queries
      tasks.ts              # Task read queries
    mutations/
      users.ts              # User write operations
      tasks.ts              # Task write operations
    actions/
      estimateTaskTime.ts         # Google Gemini time-estimation action
      requestEstimateTaskTime.ts  # Triggers time-estimation for a task
```

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | LandingPage | Public |
| `/onboarding` | OnboardingPage | Authenticated |
| `/dashboard` | DashboardPage | Authenticated |
| `/profile` | ProfilePage | Authenticated |

## Documentation

- Iteration plans: `docs/iteration-x-plan.md`
- Product Requirements Document: `docs/product-requirements.md`
- Team Information: `docs/team-agreement.md`
