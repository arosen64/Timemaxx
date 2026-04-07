# Gemini API Key Setup

This guide explains how to get a Google Gemini API key and configure it for local development. Each developer needs to do this once for their own Convex deployment.

## Why This Is Needed

Several AI features call the Google Gemini API from Convex actions: subtask generation, syllabus parsing, transcript analysis, and academic profile generation. The API key is stored as a server-side environment variable in your Convex deployment — it is never committed to the repo or exposed to the frontend.

> **Note:** Task and subtask time estimation uses OpenAI (GPT-4o mini), not Gemini. See the [OpenAI API Key Setup](openai-api-key-setup.md) guide for that key.

## Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the generated key

## Step 2: Set the Key in Your Convex Deployment

Run the following command in the project root:

```bash
npx convex env set GEMINI_API_KEY your_key_here
```

This stores the key in your personal Convex dev deployment. You can verify it was set with:

```bash
npx convex env list
```

## Notes

- Each developer has their own Convex dev deployment, so everyone must set this key individually
- The key is **not** stored in `.env.local` — that file is for frontend (Vite) variables only
- If the key is missing, subtask generation, syllabus parsing, and transcript analysis will be unavailable — task creation itself will still succeed
