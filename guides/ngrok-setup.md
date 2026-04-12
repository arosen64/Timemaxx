# ngrok Setup Guide

This guide explains how to use ngrok to expose the local Mastra AI agent server so that the Convex backend can reach the agent.

## Why This Is Needed

Convex is a cloud backend. It cannot call `http://localhost` — it can only reach publicly accessible URLs. During local development, ngrok creates a secure tunnel from a public `https://` URL to your local Mastra server.

Without ngrok, the AI chat assistant will fail with a `MASTRA_URL not configured` or connection error.

## Step 1: Install ngrok

```bash
# macOS (Homebrew)
brew install ngrok

# Or download directly from https://ngrok.com/download
```

## Step 2: Create a Free ngrok Account

1. Go to [ngrok.com](https://ngrok.com) and sign up for a free account
2. Go to **Your Authtoken** in the dashboard and copy your token
3. Authenticate your local ngrok installation:

```bash
ngrok config add-authtoken your_authtoken_here
```

You only need to do this once per machine.

## Step 3: Start Mastra First

Make sure Mastra is already running before starting ngrok:

```bash
cd mastra
npm run dev   # starts on http://localhost:4111
```

## Step 4: Start the ngrok Tunnel

In a separate terminal, run:

```bash
ngrok http 4111
```

ngrok will print output like:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:4111
```

Copy the `https://` URL.

## Step 5: Set the URL in Convex

```bash
npx convex env set MASTRA_URL https://abc123.ngrok-free.app/mastra
```

> The `/mastra` path suffix is required — Mastra serves its API under that prefix.

Verify it was set:

```bash
npx convex env list
```

## Step 6: Restart Convex Dev

If `npx convex dev` was already running, restart it so it picks up the new environment variable.

## Notes

- The ngrok URL changes every time you restart ngrok (free tier). Repeat steps 4–5 each session.
- If you upgrade to a paid ngrok plan, you can set a static domain and avoid re-setting the Convex env var each time.
- `VITE_MASTRA_URL` in `frontend/.env.local` should stay as `http://localhost:4111` — the frontend calls Mastra directly and does not need the public URL.
- Never commit your ngrok authtoken or tunnel URLs to the repo.
