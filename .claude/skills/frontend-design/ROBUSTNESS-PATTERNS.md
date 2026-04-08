# Frontend Robustness Patterns

Production-hardening patterns for React frontends. These prevent common runtime failures from race conditions, stale closures, unnecessary bundle weight, and mismanaged dependencies.

---

## Prefer Owning Small Utilities Over Adding Dependencies

Before adding a library, check if it solves a problem you can handle with a few lines of code — especially when the library is tied to a framework you're not using. A dependency that brings coupling, version churn, and bundle weight for something trivial is worse than owning it.

**Example:** The Sonner toast library accepted a `theme` prop from `next-themes`. Rather than pulling in `next-themes` (a Next.js-specific package) just to feed Sonner a resolved `"light"` or `"dark"` string, resolve the theme ourselves with `window.matchMedia("(prefers-color-scheme: dark)")` and pass it directly.

### When to Own vs Depend

| Own it                                                                | Depend on it                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The library is framework-specific and you're on a different framework | The library solves a genuinely hard problem (crypto, date math, accessibility) |
| You only need one small function from a large package                 | You'd need to maintain significant logic and edge cases yourself               |
| The library adds coupling to a framework or ecosystem you don't use   | The library is well-maintained and framework-agnostic                          |

---

## Race Condition Protection for Async Operations

Streaming, fetch calls, and any async work can produce stale callbacks when the user navigates away or triggers a new request. Use a **request ID ref** to invalidate stale callbacks.

### Pattern

```typescript
const abortControllerRef = useRef<AbortController | null>(null);
const requestIdRef = useRef(0);

// Cleanup on unmount — invalidate pending callbacks and abort.
useEffect(() => {
  return () => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };
}, []);

const sendMessage = useCallback(
  async (content: string): Promise<boolean> => {
    // Abort any in-flight request before starting a new one.
    if (abortControllerRef.current) {
      requestIdRef.current += 1;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void streamChat({
      onChunk: (accumulated) => {
        if (requestIdRef.current !== requestId) return; // Stale — ignore
        setStreamingContent(accumulated);
      },
      onFinish: (fullText) => {
        if (requestIdRef.current !== requestId) return;
        // ... commit result
      },
      onError: (err) => {
        if (requestIdRef.current !== requestId) return;
        // ... handle error
      },
    });

    return true;
  },
  [chatId],
);
```

### Rules

| Rule                                                       | Why                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Every callback checks `requestIdRef.current !== requestId` | Prevents state updates from orphaned requests                   |
| Abort previous request before starting a new one           | Avoids concurrent streams fighting over state                   |
| Cleanup effect increments ID and aborts on unmount         | Prevents updates after component unmounts                       |
| Use `void streamChat()` (fire-and-forget), not `await`     | Lets the caller return immediately; callbacks handle the result |

---

## Stale Closure Prevention

In async callbacks (streaming `onFinish`, `.then()` chains), re-read mutable state from the store at the point of use. Closure captures go stale when state changes between the start and end of an async operation.

```typescript
// Bad — uses stale closure capture
onFinish: (fullText) => {
  if (chat.title === "New Chat") {
    updateChat({ ...chat, title: newTitle }); // `chat` may be outdated
  }
};

// Good — re-reads from store
onFinish: (fullText) => {
  const latestChat = $chats.get().find((c) => c._id === chatId);
  if (latestChat && latestChat.title === "New Chat") {
    updateChat({ ...latestChat, title: newTitle });
  }
};
```

---

## Lazy-Loading Heavy Libraries

Large libraries like syntax highlighters (shiki ~2MB) should be dynamically imported, not bundled at the top level.

```typescript
// Bad — top-level import, always in main bundle
import { codeToHtml } from "shiki";

// Good — dynamic import, code-split into separate chunk
useEffect(() => {
  let cancelled = false;

  async function highlight() {
    if (!code) {
      setHighlightedHtml("<pre><code></code></pre>");
      return;
    }

    try {
      const { codeToHtml } = await import("shiki");
      const html = await codeToHtml(code, { lang: language, theme });
      if (!cancelled) {
        setHighlightedHtml(html);
      }
    } catch {
      // Keep plaintext fallback when syntax highlighting cannot load.
      if (!cancelled) {
        setHighlightedHtml(null);
      }
    }
  }

  void highlight();

  return () => {
    cancelled = true;
  };
}, [code, language, theme]);
```

### Rules

- Use a `cancelled` flag in the cleanup function to prevent state updates after unmount.
- Always provide a fallback (plaintext rendering) when the dynamic import fails.
- Use `void` prefix to acknowledge the floating promise from the async IIFE.

---

## Key-Based Remounting for Route Changes

When a routed component must fully reset between parameter changes (new chat, new document, etc.), use `key={routeParam}` to force React to unmount and remount:

```tsx
// Bad — same component instance reused, state leaks between chats
<MessagesPage chatId={page.params.id} />

// Good — fresh instance per chat, clean state guaranteed
<MessagesPage key={page.params.id} chatId={page.params.id} />
```

Use this when the component has local state or effects that depend on the route parameter. Avoids manual cleanup logic.

---

## Async Handler Return Values

Mutation functions should return success/failure so callers can decide side effects (e.g., clearing input only after success):

```typescript
// Hook returns Promise<boolean>
const sendMessage = useCallback(
  async (content: string): Promise<boolean> => {
    if (!settings.geminiApiKey) {
      toast.error("API key not configured");
      return false;
    }
    // ... send logic
    return true;
  },
  [chatId],
);

// Caller uses the return value
const handleSend = async (content: string) => {
  const accepted = await sendMessage(content);
  if (accepted) {
    setInputValue(""); // Only clear on success
  }
};
```

The prop type should accommodate both sync and async handlers:

```typescript
onSend: (content: string) => void | Promise<void>;
```

Use `void onSend(trimmed)` to acknowledge intentionally unhandled promises.

---

## Checklist

- [ ] Async operations (streaming, fetch) use request ID refs to invalidate stale callbacks?
- [ ] Async callbacks re-read store state instead of using closure captures?
- [ ] Heavy libraries (shiki, etc.) are dynamically imported with `await import()`?
- [ ] Async effects have cancellation guards in cleanup functions?
- [ ] Routed components use `key={param}` when they need fresh state per route?
- [ ] Mutation functions return success/failure for caller-side decisions?
- [ ] No unnecessary dependencies for things you can own in a few lines?
