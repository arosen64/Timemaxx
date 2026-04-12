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

## Notes

- `mastra/.env` is gitignored — each developer sets their own key
- If `ANTHROPIC_API_KEY` is missing or invalid, the chat assistant will return errors
- The ngrok URL changes every session (free tier) — update `MASTRA_URL` in Convex each time you restart ngrok
