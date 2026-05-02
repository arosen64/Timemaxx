# Mastra AI Agent Server Setup

This guide explains how to configure the Mastra AI agent server for local development. Each developer needs to do this once.

## Why This Is Needed

The Mastra server powers the AI chat assistant ("Maxx"). It runs as a separate process that Convex calls over HTTP. It requires an Anthropic API key to run the Claude-based agents.

## Step 1: Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Navigate to **API Keys** and click **Create Key**
4. Copy the generated key

## Step 2: Create `mastra/.env`

In the `mastra/` directory, create a `.env` file (it is gitignored — never commit it):

```
ANTHROPIC_API_KEY=your_key_here
```

A template is provided at `mastra/.env.example`.

## Step 3: Start the Mastra Server

```bash
cd mastra
npm run dev
```

The server starts on `http://localhost:4111`. You should see output confirming the agents are registered.

## Step 4: Expose via ngrok

Convex cannot reach `localhost`, so you need a public tunnel. See `guides/ngrok-setup.md` for the full walkthrough. In short:

```bash
ngrok http 4111
npx convex env set MASTRA_URL https://<your-tunnel>.ngrok-free.app/mastra
```

## Step 5: Point Convex `SITE_URL` at your local frontend

The Convex backend uses `SITE_URL` to build the `Access-Control-Allow-Origin` header for the chat HTTP route (and for OAuth redirects). If `SITE_URL` is set to a deployed URL (e.g. `https://timemaxx.netlify.app`) on the dev deployment you connect to, your local frontend at `http://localhost:5173` will be blocked by CORS the moment you send a chat message — typical browser console output:

```
Access to fetch at 'https://<your-deployment>.convex.site/api/chat' from origin
'http://localhost:5173' has been blocked by CORS policy: ...
'Access-Control-Allow-Origin' header has a value 'https://timemaxx.netlify.app'
that is not equal to the supplied origin.
```

Fix it once on your dev deployment:

```bash
npx convex env set SITE_URL http://localhost:5173
```

Verify it is set:

```bash
npx convex env list
```

> Only run this against your **dev** Convex deployment. The CD workflow sets `SITE_URL` to the deployed frontend URL on the prod deployment automatically — do not overwrite that.

## Notes

- `mastra/.env` is gitignored — each developer sets their own key
- If `ANTHROPIC_API_KEY` is missing or invalid, the chat assistant will return errors
- The ngrok URL changes every session (free tier) — update `MASTRA_URL` in Convex each time you restart ngrok
- If the chat widget closes itself the moment you send a message and the browser console shows a CORS error, re-run the `SITE_URL` command from Step 5
