# Dev Environment Setup

## Prerequisites
- Node.js installed
- Access to the team GitHub repo
- Access to the team Convex project (ask Anvii for an invite)

## Steps

### 1. Clone the repo
```bash
git clone <repo-url>
cd team-04
npm install
```

### 2. Connect to the team Convex project
```bash
npx convex dev --configure existing
```
Select the `timemaxx` project when prompted. This will create your `.env.local` automatically.

### 3. Set Google OAuth credentials on your personal deployment
Ask a teammate for the `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` values over Slack, then run:
```bash
npx convex env set AUTH_GOOGLE_ID=<client-id>
npx convex env set AUTH_GOOGLE_SECRET=<client-secret>
```

### 4. Generate JWT keys
```bash
npx @convex-dev/auth keygen
```
Say **No** when asked to change `SITE_URL`, and **Yes** to continue at the end.

### 5. Add Google redirect URIs
Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client → add both redirect URIs:
Or ask Maria to do this.
```
https://<your-personal-deployment>.convex.site/api/auth/callback/google
https://<your-personal-deployment>.convex.site/api/calendar/callback
```
Your personal deployment URL is in your `.env.local` as `VITE_CONVEX_SITE_URL`.

### 6. Start the dev server
```bash
npx convex dev
npm run dev
```

## Notes
- Never commit `.env.local`
- Each developer has their own personal Convex deployment
- The `JWT_PRIVATE_KEY` and `JWKS` are generated per-deployment via `keygen` — do not share these