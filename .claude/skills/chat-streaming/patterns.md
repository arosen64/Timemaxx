# Chat Streaming Patterns Reference

Detailed patterns for server-side flushing, SSE consumption, tool call streaming, crash recovery, and auto-title generation.

---

## Server-Side Batched Flush Strategy

The server accumulates tokens and flushes to DB at controlled intervals, not on every token:

```plaintext
Configuration:
  FLUSH_INTERVAL = 200ms        — minimum time between DB writes
  MIN_FLUSH_SIZE = 100 chars    — minimum content to justify a flush

Flow:
  1. Create placeholder message (isComplete: false, content: "")
  2. Send "message-created" SSE event with messageId
  3. For each AI token:
     - Append to accumulated text
     - Send text-delta via SSE
     - If (buffer >= 100 chars AND elapsed >= 200ms): flush to DB
  4. Stream ends → final flush (isComplete: true) → send [DONE]
```

Result: ~5 DB writes/second max, typically 5-15 total writes per response.

### Streaming Lifecycle Mutations

| Mutation                   | When Called        | What It Does                            |
| -------------------------- | ------------------ | --------------------------------------- |
| `createStreamingMessage`   | Before first token | Creates placeholder (isComplete: false) |
| `updateStreamingContent`   | Periodic flush     | Patches content field                   |
| `completeStreamingMessage` | Stream ends        | Patches content + sets isComplete: true |

---

## SSE Consumer Pattern

`src/lib/sse.ts` provides `streamChatSSE()` — a callback-based SSE consumer:

```plaintext
streamChatSSE({
  siteUrl, token, chatId, model, signal,
  onChunk(accumulated)      — text-delta: update streaming content
  onDone(fullText)          — [DONE]: trigger handoff
  onError(error)            — [ERROR]: show toast, clear streaming
  onToolCall(data)          — tool-call: add to toolCalls array
  onToolResult(data)        — tool-result: update tool call with result
  onMessageCreated(data)    — message-created: store messageId
})
```

The consumer handles:

- SSE line parsing (event/data lines, blank line = end of event)
- Multi-line data reassembly (joins with "\n")
- [DONE] and [ERROR] sentinel detection
- AbortSignal for cancellation

---

## Tool Call / Result Streaming

During multi-step tool use, the SSE stream interleaves text and tool events:

```plaintext
SSE event flow:
  message-created → { messageId }
  text-delta      → "Let me check the weather..."
  tool-call       → { toolCallId, toolName: "getLocation", args: { city: "Baltimore" } }
  tool-result     → { toolCallId, toolName: "getLocation", result: { lat, lon } }
  tool-call       → { toolCallId, toolName: "getCurrentWeather", args: { lat, lon } }
  tool-result     → { toolCallId, toolName: "getCurrentWeather", result: { temp, ... } }
  text-delta      → "The weather in Baltimore is..."
  [DONE]
```

Tool calls are accumulated in `streaming.toolCalls` and displayed inline during streaming. The server uses `stopWhen: stepCountIs(5)` to cap tool-use loops.

---

## Crash Recovery

If the client disconnects mid-stream:

1. **Server continues** — the AI stream runs server-side in a Convex action, independent of the SSE connection. Periodic DB flushes continue.
2. **Client reconnects** — no SSE stream to resume, but the Convex reactive subscription resumes automatically.
3. **Persisted content updates** — as DB flushes continue, the client sees paragraph-level updates via the reactive query.
4. **Final state** — `completeStreamingMessage` marks the message done. The client sees the complete response.

Content is never lost. The tradeoff: on reconnect, updates arrive at DB-flush granularity (~200ms batches) instead of token-by-token.

---

## Auto-Title Generation

After the first assistant response in a "New Chat":

```plaintext
1. Check: is title still "New Chat" AND fullText is non-empty?
2. If yes: build excerpt from first 6 messages
3. Call streamText() with a title-generation prompt
4. Save title via updateChatTitle internal mutation
5. Title generation is best-effort — errors are silently caught
```

This runs inline at the end of the streaming handler, after `[DONE]` is sent. The client sees the title update via the Convex reactive chat query.
