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
      schedule/                     # Schedule grid, conflict blocks, calendar picker
      classes/                      # Class cards and syllabus upload UI
      syllabus/                     # Syllabus task review components
      profile/                      # Profile form fields and actions
      onboarding/                   # Onboarding shells and navigation
      landing/                      # Landing page presentation components
      ui/                           # Shared base UI primitives
      Sidebar.tsx                   # App sidebar navigation
      WorkHoursSelector.tsx         # Weekly work-hours picker
      CourseSelector.tsx            # SIS-backed course search/selection
    main.tsx                        # App entry point (ConvexProvider + BrowserRouter)
    App.tsx                         # Route definitions + auth redirects
  tests/                    # Frontend behavioral tests (Vitest + React Testing Library)
backend/
  convex/
    schema.ts                       # Convex database schema
    auth.ts                         # Convex Auth configuration
    http.ts                         # Convex HTTP routes
    calendarOAuthCallback.ts        # Google Calendar OAuth callback handler
    actions/                        # External API + AI actions (Gemini, SIS, Calendar)
    queries/                        # Read-only Convex queries
    mutations/                      # Data-write Convex mutations
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

- Iteration plans: `docs/iteration-x-plan.md`
- Product Requirements Document: `docs/product-requirements.md`
- Team Information: `docs/team-agreement.md`
