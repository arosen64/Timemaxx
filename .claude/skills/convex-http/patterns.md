# Convex HTTP Patterns Reference

Detailed patterns for auth, CORS, URL rewriting, SSE streaming, and error handling in Convex HTTP endpoints.

---

## Auth Middleware Pattern

Auth is handled in `http.ts` before Hono sees the request:

```plaintext
1. Client sends: Authorization: Bearer <convex-auth-token>
2. httpAction calls getAuthUserId(ctx) — validates the token via @convex-dev/auth
3. If null → 401 response with CORS headers
4. If valid → userId injected into Hono env as { ctx, userId }
5. Hono handler accesses via c.env.ctx and c.env.userId
```

The Hono app type declares the env bindings:

```plaintext
type Env = {
  Bindings: {
    ctx: ActionCtx;
    userId: Id<"users">;
  };
};
```

Every Hono route handler can trust that `c.env.userId` is a valid, authenticated user.

---

## CORS Configuration

CORS headers use the `SITE_URL` environment variable (set in Convex dashboard):

```plaintext
Access-Control-Allow-Origin: <SITE_URL value>
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

- `SITE_URL` must be set as a Convex environment variable — the function throws if missing
- CORS headers are added to both the preflight (OPTIONS) and actual responses
- The `corsHeaders()` helper is called in the httpAction wrapper, which merges headers onto the Hono response

---

## URL Rewriting

Convex's `httpRouter` dispatches by full deployment URL, but Hono routes by path. The `httpAction` in `http.ts` constructs a new `Request` object so Hono's internal router sees the expected path:

```plaintext
Incoming request URL:  https://<deployment>.convex.site/api/chat
Hono expects to match: /api/chat

http.ts creates: new Request("<origin>/api/chat", { ...originalRequest })
```

This is needed because the raw `request.url` from Convex may not parse the way Hono expects. Building a fresh `Request` with an explicit path guarantees Hono's `app.fetch()` routes correctly.

---

## SSE Streaming with Hono

The chat handler uses Hono's `streamSSE()` helper to send Server-Sent Events:

```plaintext
return streamSSE(c, async (stream) => {
  // Create placeholder message in DB
  // Send "message-created" event with messageId

  // Stream AI tokens
  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        await stream.writeSSE({ data: part.text, event: "text-delta" });
        // Periodic DB flush (200ms / 100 chars)
        break;
      case "tool-call":
        await stream.writeSSE({ data: JSON.stringify({...}), event: "tool-call" });
        break;
      case "tool-result":
        await stream.writeSSE({ data: JSON.stringify({...}), event: "tool-result" });
        break;
    }
  }

  // Final DB flush (mark complete)
  // Send [DONE] signal
});
```

### SSE Event Types

| Event             | Data Format                        | Purpose                            |
| ----------------- | ---------------------------------- | ---------------------------------- |
| `message-created` | `{ messageId }`                    | Server-assigned ID for the message |
| `text-delta`      | Raw text chunk                     | Incremental AI response text       |
| `tool-call`       | `{ toolCallId, toolName, args }`   | AI requested a tool invocation     |
| `tool-result`     | `{ toolCallId, toolName, result }` | Tool execution result              |
| `text-delta`      | `[DONE]`                           | Stream complete signal             |
| `text-delta`      | `[ERROR]: <message>`               | Error during streaming             |

---

## Error Handling

The streaming handler wraps the entire stream in a try/catch:

- **On error:** Saves whatever accumulated text exists to the DB (best-effort), then sends an `[ERROR]` SSE event
- **On success:** Final DB flush marks message as `isComplete: true`, then sends `[DONE]`
- **Auth failure:** Returns JSON error before streaming starts (401/403)
- **Bad request:** Returns JSON error before streaming starts (400)
