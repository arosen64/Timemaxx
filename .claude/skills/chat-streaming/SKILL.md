---
name: chat-streaming
description: End-to-end AI chat streaming architecture. Use when working on SSE streaming, the streaming-to-persisted handoff, Legend-State merge layer, optimistic messages, crash recovery, tool call streaming, or asking about how streaming AI responses flow from server to screen.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# AI Chat Streaming Architecture

The end-to-end flow of streaming AI responses from server to screen, including the dual-channel architecture, Legend-State merge layer, and crash recovery.

## Related Skills

- **[convex-http](../convex-http/SKILL.md)** — HTTP endpoints, Hono, SSE, CORS
- **[frontend-state](../frontend-state/SKILL.md)** — Legend-State patterns
- **[frontend-hooks](../frontend-hooks/SKILL.md)** — Hook conventions

## Authoritative Documentation

For the full design rationale, trade-offs, and alternative approaches considered, see:
**[docs/ai-chat-streaming-architecture.md](../../../docs/ai-chat-streaming-architecture.md)**

---

## Quick Reference

| File                             | Role                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| `convex/http_chat.ts`            | Server-side streaming: AI SDK, SSE, batched DB flush           |
| `convex/messages_internals.ts`   | Internal mutations for streaming lifecycle                     |
| `src/messages/store/messages.ts` | Legend-State merge layer (persisted + streaming + optimistic)  |
| `src/messages/hooks/use-chat.ts` | Core streaming hook: SSE consumer, abort, handoff              |
| `src/lib/sse.ts`                 | SSE client: parses events, dispatches callbacks                |
| [patterns.md](patterns.md)       | Server flush, SSE consumer, tool calls, crash recovery details |

---

## Dual-Channel Architecture

Two simultaneous data channels feed into a single Legend-State store, which is the sole source of truth for the UI.

```plaintext
                           AI Provider (OpenRouter)
                                 |
                                 | token stream
                                 v
                          Convex HTTP Action
                               /    \
                              /      \
             SSE (token-by-token)    DB flush (batched, periodic)
                    |                       |
                    v                       v
               Client SSE              Convex DB
                consumer                    |
                    |                       | reactive subscription
                    v                       v
               Legend-State    <--- merge --->    Legend-State
              (streaming)                       (persisted)
                    \                     /
                     v                   v
                  UI renders max(streaming, persisted)
```

**Channel 1 (SSE):** Fast path. Tokens appear on screen within milliseconds. Ephemeral — lost on disconnect.

**Channel 2 (Convex DB):** Durable path. Server flushes accumulated text to DB at controlled intervals. Convex reactive queries push updates to client. Always behind or equal to SSE.

---

## Legend-State Merge Layer

`src/messages/store/messages.ts` holds three layers of state per chat:

```plaintext
ChatMessageState {
  persisted: MessageType[]           — from Convex reactive query
  streaming: StreamingState          — from SSE consumer
  optimistic: Record<clientId, msg>  — local-first user messages
}
```

### Merged View (what the UI sees)

`getMergedMessages(chatId)` produces the final message list:

1. Start with `persisted` messages
2. While streaming, filter out the in-progress placeholder (matched by `messageId`) to avoid showing an empty DB row alongside the streaming overlay
3. Append any remaining `optimistic` messages (not yet reconciled)
4. Sort by `_creationTime`

### Streaming State

```plaintext
StreamingState {
  isStreaming: boolean       — true while SSE is active
  content: string            — accumulated text from SSE
  messageId: string | null   — server-assigned ID (from "message-created" event)
  toolCalls: ToolCallPart[]  — tool calls received during streaming
}
```

---

## Streaming-to-Persisted Handoff

The handoff eliminates flash/gap artifacts when transitioning from streaming to persisted state:

```plaintext
1. SSE sends [DONE]
2. Server has already called completeStreamingMessage (final DB flush)
3. Client receives [DONE] via onDone callback
4. Client polls: wait until persisted messages include one matching
   messageId with isComplete !== false (50ms interval, 5s timeout)
5. Once confirmed → clearStreaming(chatId)
6. UI seamlessly shows persisted message (identical content)
```

The key insight: streaming state is NOT cleared until the persisted version is confirmed ready. This prevents the flash of disappearing content.

---

## User Message Local-First Flow

User messages use optimistic insertion with clientId reconciliation:

```plaintext
1. User presses Send
2. Generate clientId = crypto.randomUUID()
3. addOptimisticMessage(chatId, clientId, message)  — instant UI
4. Call Convex mutation to persist (includes clientId)
5. Convex reactive query delivers persisted message
6. syncPersistedMessages() sees clientId match → removes optimistic copy
```

The optimistic message appears immediately. When the server version arrives via Convex subscription, the optimistic copy is silently replaced.

---

## Additional Patterns

- **Server-side flush:** Tokens buffered and flushed to DB every 200ms / 100 chars (~5 writes/sec). Three lifecycle mutations: `createStreamingMessage`, `updateStreamingContent`, `completeStreamingMessage`.
- **SSE consumer:** `streamChatSSE()` in `src/lib/sse.ts` — callback-based, handles line parsing, multi-line data, sentinel detection, and AbortSignal cancellation.
- **Tool call streaming:** SSE interleaves `text-delta`, `tool-call`, and `tool-result` events. Tool calls accumulate in `streaming.toolCalls`. Server caps loops with `stepCountIs(5)`.
- **Crash recovery:** Server continues flushing to DB regardless of client state. On reconnect, Convex reactive subscription resumes automatically. Content is never lost.
- **Auto-title:** After first assistant response in a "New Chat", generates title from first 6 messages via `streamText()`. Best-effort — errors silently caught.

See [patterns.md](patterns.md) for full details on each pattern.

---

## Key Invariants

1. **SSE is always ahead of or equal to DB** — the client never sees DB content that SSE hasn't delivered
2. **Streaming state cleared only after persisted is ready** — prevents handoff artifacts
3. **Server saves regardless of client state** — crash recovery is built in
4. **One writer per message** — no conflict resolution needed
5. **clientId reconciliation is idempotent** — duplicate Convex subscription updates are harmless
