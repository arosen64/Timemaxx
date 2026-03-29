# SIS API Key Setup

This guide explains how to configure the SIS API key for your personal Convex deployment.

## Why This Is Needed

The onboarding course lookup flow uses a backend Convex action that calls the SIS API.  
The key must be stored as a server-side Convex environment variable (never in frontend code).

## Step 1: Set the Key in Your Convex Deployment

Run this in the project root:

```bash
npx convex env set SIS_API_KEY your_sis_api_key_here
```

If you need a SIS API key, please contact a member of the team via Slack/Email.

## Step 2: Verify It Was Set

```bash
npx convex env list
```

Confirm `SIS_API_KEY` appears in the output.

## Notes

- Each developer needs to set this key in their own Convex dev deployment
- Do not commit keys into `README.md`, source code, or tracked config files

## Production CD setup (one-time)

For production deploys, store the SIS key in GitHub Actions and let CD write it to production Convex:

1. In GitHub, go to **Settings -> Secrets and variables -> Actions -> New repository secret**
2. Add:
   - Name: `SIS_API_KEY`
   - Value: `<your production SIS API key>`

The CD workflow sets `SIS_API_KEY` in Convex on deploy.
