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
MISTRAL_API_KEY=your_key_here
MASTRA_SERVER_SECRET=your_secret_here
```

A template is provided at `mastra/.env.example`.

- `ANTHROPIC_API_KEY` — required for every chat/parsing/estimation/scheduling agent (all of them call Claude via `@ai-sdk/anthropic`).
- `MISTRAL_API_KEY` — required by `ocrWorkflow` (`mistral-ocr-latest`) which extracts text from uploaded syllabus / transcript PDFs before the parsing agents run. Get a key at [console.mistral.ai](https://console.mistral.ai/).
- `MASTRA_SERVER_SECRET` — shared secret enforced by the auth middleware. See Step 6 below for how to generate and propagate it.

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

## Step 6: Set `MASTRA_SERVER_SECRET`

The Mastra server uses a shared secret to reject unauthenticated callers. Without it, anyone who discovers the ngrok/Mastra URL can invoke workflows directly and burn LLM credits.

**Generate a secret** (any random string works — use a password manager or):

```bash
openssl rand -hex 32
```

**Set it in three places:**

1. `mastra/.env` — so the server enforces it:
   ```
   MASTRA_SERVER_SECRET=<your-secret>
   ```

2. Convex dev environment — so actions include it in requests:
   ```bash
   npx convex env set MASTRA_SERVER_SECRET <your-secret>
   ```

3. GitHub secret `MASTRA_SERVER_SECRET` — so the CD workflow sets it on the prod Convex deployment. Add it under **Settings → Secrets and variables → Actions** in the GitHub repo.

> If `MASTRA_SERVER_SECRET` is not set in `mastra/.env`, the middleware is a no-op and all requests are allowed (safe fallback for local dev without a secret).
> If it is set, requests without a matching `Authorization: Bearer <secret>` header receive a 401.

## Notes

- `mastra/.env` is gitignored — each developer sets their own key
- If `ANTHROPIC_API_KEY` is missing or invalid, the chat assistant will return errors
- The ngrok URL changes every session (free tier) — update `MASTRA_URL` in Convex each time you restart ngrok
- If the chat widget closes itself the moment you send a message and the browser console shows a CORS error, re-run the `SITE_URL` command from Step 5
