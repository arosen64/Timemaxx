# Google Calendar Connection Setup

One-time setup per developer to enable Google Calendar integration in your personal Convex deployment.

## 1) Add redirect URIs in Google Cloud Console

Open **Google Cloud Console -> APIs & Services -> Credentials -> OAuth client** and add both redirect URIs:

- `https://<your-deployment>.convex.site/api/auth/callback/google`
- `https://<your-deployment>.convex.site/api/calendar/callback`

Replace `<your-deployment>` with your personal Convex deployment subdomain.

## 2) Set the token encryption secret in Convex

Run:

```bash
npx convex env set CALENDAR_TOKEN_SECRET $(openssl rand -hex 32)
```

This creates and stores a strong secret used to encrypt/decrypt calendar OAuth tokens.

## 3) Add yourself as an OAuth test user

In **Google Cloud Console -> APIs & Services -> OAuth consent screen -> Audience -> Add users**, add your Google account email.

Without this, sign-in and calendar authorization may be blocked in testing mode.
