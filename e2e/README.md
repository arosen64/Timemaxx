# End-to-End Tests

End-to-end (E2E) tests use [Playwright](https://playwright.dev/) and exercise the
production-built frontend in a real Chromium browser. These tests complement the
component-level Vitest suite under `frontend/tests/`.

## Layout

```
e2e/
  fixtures/   # Page-object models and shared test fixtures
  tests/      # *.spec.ts files — one per user flow
  tsconfig.json
```

## Running locally

```bash
# One-time browser install (after npm install)
npx playwright install --with-deps chromium

# Run all E2E tests (auto-builds and serves the frontend)
npm run test:e2e

# Run tests with the Playwright UI
npm run test:e2e:ui

# Run against a frontend you have already started yourself
E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

`npm run test:e2e` calls `vite preview` on the production build by default; set
`E2E_BASE_URL` to point at any running dev server (Vite, ngrok tunnel, staging,
etc.) and Playwright will skip starting its own webServer.

## Scope of these tests

These tests intentionally cover **unauthenticated flows only**:

- Landing page renders core marketing content and the sign-in card
- Protected routes redirect anonymous visitors back to `/`
- The frontend boots without runtime errors

Authenticated flows (onboarding, scheduling, classes) require a live Convex
backend and seeded user data, which we will add in a follow-up once we have a
deterministic test deployment. New unauthenticated flows can be added as their
own `*.spec.ts` file under `e2e/tests/`.

## Conventions

- One `*.spec.ts` per page or user flow
- Reach for fixtures in `e2e/fixtures/` rather than copy-pasting selectors
- Prefer accessible queries (`getByRole`, `getByLabel`, `getByText`) over CSS
  selectors so tests stay close to user behavior
