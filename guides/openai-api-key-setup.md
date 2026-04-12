# OpenAI API Key Setup

This guide explains how to get an OpenAI API key and configure it for local development. Each developer needs to do this once for their own Convex deployment.

## Why This Is Needed

Task and subtask time estimation calls the OpenAI API (GPT-4o mini) from Convex actions. The API key is stored as a server-side environment variable in your Convex deployment — it is never committed to the repo or exposed to the frontend.

Gemini is still used for subtask generation, syllabus parsing, transcript analysis, and academic profile generation. OpenAI is used exclusively for time estimation.

## Step 1: Get an OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **Create new secret key**
4. Copy the generated key (you won't be able to see it again)

## Step 2: Add Credits

The free tier does not include API access — you need to add a small credit balance.

1. Go to [platform.openai.com/settings/billing](https://platform.openai.com/settings/billing)
2. Add a minimum credit (e.g. $5) — GPT-4o mini costs ~$0.0006 per estimation, so $5 covers thousands of calls

## Step 3: Set the Key in Your Convex Deployment

Run the following command in the project root:

```bash
npx convex env set OPENAI_API_KEY your_key_here
```

Verify it was set:

```bash
npx convex env list
```

## Notes

- Each developer has their own Convex dev deployment, so everyone must set this key individually
- The key is **not** stored in `.env.local` — that file is for frontend (Vite) variables only
- If the key is missing, time estimation will silently skip — tasks and subtasks will be created but `timeEstimate` will remain unset
