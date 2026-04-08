# Anonymous Sign-In (Development Only)

An anonymous "Continue as Guest" login option is available for local development so you can test the app without configuring Google OAuth credentials.

## How It Works

- **Backend** (`backend/convex/auth.ts`): The `Anonymous` provider from `@convex-dev/auth` is added alongside Google when the `ANONYMOUS_AUTH_ENABLED` environment variable is set to `"true"`.
- **Frontend** (`frontend/src/components/landing/LandingLoginCard.tsx`): A "Continue as Guest" button appears below the Google sign-in button when running in Vite dev mode (`import.meta.env.DEV`) or when `VITE_ANONYMOUS_AUTH_ENABLED` is set to `"true"`.

In production, neither condition is true, so the button is hidden and the provider is not registered.

## Setup

Set the Convex environment variable to enable the anonymous provider:

```sh
npx convex env set ANONYMOUS_AUTH_ENABLED true
```

No other configuration is needed. Start the app as usual:

```sh
npx convex dev        # terminal 1
npm run dev            # terminal 2
```

Open the app and click "Continue as Guest" to sign in without Google OAuth.

## Notes

- Guest users have no email, name, or profile image. Some features that depend on profile data (e.g., academic profile generation) may behave differently.
- To sign in as a different anonymous user, clear your browser's localStorage and refresh the page. Each guest login creates a separate user identity.
- This is intended for development and testing only. Do not enable it in production deployments.
