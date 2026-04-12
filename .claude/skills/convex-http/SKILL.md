---
name: convex-http
description: Convex HTTP endpoints with Hono, SSE streaming, CORS, auth middleware. Use when creating HTTP actions, adding API routes, configuring CORS, implementing SSE streaming, setting up auth middleware in Convex, or asking about the HTTP router and Hono integration.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex HTTP Endpoints with Hono

Patterns for building HTTP endpoints inside Convex using Hono, including SSE streaming, CORS, and authentication middleware.

## Related Skills

- **[convex-architecture](../convex-architecture/SKILL.md)** — File organization, domain structure
- **[convex-functions](../convex-functions/SKILL.md)** — Queries, mutations, internal functions
- **[chat-streaming](../chat-streaming/SKILL.md)** — End-to-end streaming architecture

---

## Quick Reference

| File                       | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `convex/http.ts`           | HTTP router, auth middleware, CORS, URL rewriting |
| `convex/http_chat.ts`      | Hono app with route handlers for chat streaming   |
| [patterns.md](patterns.md) | Auth, CORS, URL rewriting, SSE streaming details  |

---

## Architecture Overview

```plaintext
Client POST /api/chat
  |
  v
Convex httpRouter (http.ts)
  |
  ├── CORS preflight (OPTIONS → 204)
  ├── Auth: getAuthUserId(ctx) → userId
  ├── URL rewrite: request.url.pathname → "/api/chat"
  ├── Bind env: { ctx, userId }
  └── Forward to Hono app (http_chat.ts)
        |
        v
      Hono route handler
        ├── Parse request body (chatId, model)
        ├── Verify chat ownership (guard)
        ├── Read message history from DB
        └── streamSSE() → AI provider → SSE to client
```

---

## Route Organization

The HTTP layer uses a two-file pattern:

1. **`http.ts`** — The Convex HTTP router. Handles auth, CORS, and URL rewriting. Acts as a gateway that forwards authenticated requests to Hono.
2. **`http_chat.ts`** — A standalone Hono app. Contains route logic, business rules, and streaming. Receives `ctx` and `userId` via Hono's `env` bindings.

This separation keeps the router thin (auth + CORS) and the handler focused (business logic).

### Adding a New Route

To add a new HTTP endpoint (e.g., `POST /api/title`):

1. Create `convex/http_title.ts` with a new Hono app
2. Import it in `http.ts`
3. Add route entries for POST and OPTIONS
4. Reuse the same auth + CORS + URL rewrite pattern from the chat handler

---

## Key Concepts

- **Auth:** `http.ts` validates the token via `getAuthUserId(ctx)` and injects `userId` into Hono's env bindings. Every Hono handler can trust `c.env.userId` is authenticated.
- **CORS:** Uses `SITE_URL` env var (must be set in Convex dashboard). `corsHeaders()` helper adds headers to both preflight and actual responses.
- **URL Rewriting:** `http.ts` constructs a new `Request` with an explicit path so Hono's internal router matches correctly against the Convex deployment URL.
- **SSE Streaming:** Uses Hono's `streamSSE()` with events: `message-created`, `text-delta`, `tool-call`, `tool-result`. `[DONE]` and `[ERROR]` are sent as `text-delta` events.
- **Error Handling:** Auth/validation errors return JSON before streaming. Streaming errors save accumulated text (best-effort) then send `[ERROR]` via SSE.

See [patterns.md](patterns.md) for full details on each pattern.

---

## Checklist for New HTTP Endpoints

- [ ] Create a new Hono app file (`convex/http_<name>.ts`)
- [ ] Type the Hono app with `Env` bindings for `ctx` and `userId`
- [ ] Import and wire up in `convex/http.ts`
- [ ] Register both POST and OPTIONS routes
- [ ] Reuse the auth + CORS + URL rewrite pattern
- [ ] Use `ctx.runQuery`/`ctx.runMutation` for DB access (actions can't use `ctx.db`)
- [ ] Use `internal.*` references for all scheduled/internal function calls
- [ ] Add CORS headers to error responses too
