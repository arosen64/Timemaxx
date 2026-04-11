# Gemini API Key Setup

This guide explains how to get a Google Gemini API key and configure it for local development. Each developer needs to do this once for their own Convex deployment.

## Why This Is Needed

The Gemini API is used in two places:

1. **Convex backend** — task time estimation, syllabus parsing, transcript parsing, and course embeddings. Stored as `GEMINI_API_KEY` in your Convex deployment.
2. **Mastra AI agent server** — the chat assistant uses `gemini-2.5-flash`. Stored as `GOOGLE_GENERATIVE_AI_API_KEY` in `mastra/.env`.

Both use the same key — just different variable names.

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

## Step 3: Set the Key for Mastra

Add the same key to `mastra/.env` (create the file if it doesn't exist):

```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

## Notes

- Each developer has their own Convex dev deployment, so everyone must set `GEMINI_API_KEY` individually
- `mastra/.env` is gitignored — never commit it
- If `GEMINI_API_KEY` is missing in Convex, task time estimation and embeddings will silently fail
- If `GOOGLE_GENERATIVE_AI_API_KEY` is missing in Mastra, the chat assistant will return errors
