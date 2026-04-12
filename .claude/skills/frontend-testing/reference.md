# Frontend Testing Reference

Complete code examples for every test pattern used in this project.

## Test Setup (`src/test/setup.ts`)

```typescript
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Full localStorage stub (jsdom's proxy-based storage lacks full Storage API)
const store: Record<string, string> = {};
const localStorageStub: Storage = {
  getItem(key: string) {
    return key in store ? store[key] : null;
  },
  setItem(key: string, value: string) {
    store[key] = String(value);
  },
  removeItem(key: string) {
    delete store[key];
  },
  clear() {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  key(index: number) {
    return Object.keys(store)[index] ?? null;
  },
  get length() {
    return Object.keys(store).length;
  },
};
vi.stubGlobal("localStorage", localStorageStub);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

let uuidCounter = 0;
vi.stubGlobal(
  "crypto",
  new Proxy(globalThis.crypto ?? {}, {
    get(target, prop) {
      if (prop === "randomUUID") {
        return () => `test-uuid-${++uuidCounter}`;
      }
      return Reflect.get(target, prop);
    },
  }),
);

afterEach(() => {
  cleanup();
  localStorage.clear();
  uuidCounter = 0;
});
```

## Test Helpers (`src/test/helpers.ts`)

```typescript
import type { ChatType } from "@/chats/types/chat";
import type { MessageType } from "@/messages/types/message";

export function createTestChat(overrides: Partial<ChatType> = {}): ChatType {
  return {
    _id: crypto.randomUUID(),
    title: "Test Chat",
    _creationTime: Date.now(),
    ...overrides,
  };
}

export function createTestMessage(
  overrides: Partial<MessageType> = {},
): MessageType {
  return {
    _id: crypto.randomUUID(),
    chatId: "chat-1",
    role: "user",
    content: "Hello",
    _creationTime: Date.now(),
    ...overrides,
  };
}
```

## Store Test Pattern

```typescript
import { $chats, addChat, updateChat, removeChat, clearChats } from "../chat";
import { createTestChat } from "@/test/helpers";
import { chatSchema } from "@/chats/types/chat";

beforeEach(() => {
  $chats.set([]);
});

describe("chat store", () => {
  it("addChat appends a chat", () => {
    const chat = createTestChat({ _id: "c1", title: "First" });
    addChat(chat);
    expect($chats.get()).toHaveLength(1);
    expect($chats.get()[0]).toEqual(chat);
  });

  it("updateChat with non-existent ID is a no-op", () => {
    const chat = createTestChat({ _id: "c1", title: "Only" });
    addChat(chat);
    updateChat(createTestChat({ _id: "nope", title: "Ghost" }));
    expect($chats.get()).toHaveLength(1);
    expect($chats.get()[0].title).toBe("Only");
  });

  it("Zod decode filters invalid items", () => {
    function decodeChats(value: unknown) {
      if (!Array.isArray(value)) return [];
      return value.reduce<unknown[]>((acc, item) => {
        const result = chatSchema.safeParse(item);
        if (result.success) acc.push(result.data);
        return acc;
      }, []);
    }
    const raw = [
      createTestChat({ _id: "c1", title: "Valid" }),
      { _id: "c2" }, // missing title
    ];
    expect(decodeChats(raw)).toHaveLength(1);
  });

  it("persistence roundtrip", () => {
    addChat(createTestChat({ _id: "c1", title: "Persisted" }));
    const raw = localStorage.getItem("chats");
    const parsed = JSON.parse(raw!);
    expect(parsed[0].title).toBe("Persisted");
  });
});
```

## Hook Test: Query

```typescript
import { renderHook } from "@testing-library/react";
import { $chats } from "@/chats/store/chat";
import { useQueryChats } from "../use-query-chats";
import { createTestChat } from "@/test/helpers";

beforeEach(() => {
  $chats.set([]);
});

it("returns chats when populated", () => {
  $chats.set([createTestChat({ _id: "c1", title: "First" })]);
  const { result } = renderHook(() => useQueryChats());
  expect(result.current.data).toHaveLength(1);
});
```

## Hook Test: Mutation

```typescript
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { $chats } from "@/chats/store/chat";
import { useMutationChats } from "../use-mutation-chats";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  $chats.set([]);
});

it("add() creates a chat and returns its ID", async () => {
  const { result } = renderHook(() => useMutationChats());
  let chatId: string | null = null;
  await act(async () => {
    chatId = await result.current.add({ title: "New Chat" });
  });
  expect(chatId).toBe("test-uuid-1");
  expect($chats.get()).toHaveLength(1);
});
```

## Hook Test: use-chat (Streaming)

```typescript
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { $chats } from "@/chats/store/chat";
import { $messages } from "@/messages/store/message";
import { $settings } from "@/settings/store/settings";
import { useChat } from "../use-chat";
import { createTestChat } from "@/test/helpers";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/ai", () => ({
  streamChat: vi.fn(),
  generateChatTitle: vi.fn(),
}));

const { streamChat } = await import("@/lib/ai");
const mockStreamChat = vi.mocked(streamChat);

beforeEach(() => {
  vi.clearAllMocks();
  $chats.set([]);
  $messages.set([]);
  $settings.set({ displayName: "", geminiApiKey: "" });
});

it("sendMessage returns false without API key", async () => {
  const { result } = renderHook(() => useChat("chat-1"));
  let success = false;
  await act(async () => {
    success = await result.current.sendMessage("Hello");
  });
  expect(success).toBe(false);
});

it("assistant message saved on finish", async () => {
  $settings.set({ displayName: "", geminiApiKey: "test-key" });
  $chats.set([createTestChat({ _id: "chat-1", title: "Test" })]);
  mockStreamChat.mockImplementation(async (opts) => {
    opts.onFinish?.("Response text");
  });
  const { result } = renderHook(() => useChat("chat-1"));
  await act(async () => {
    await result.current.sendMessage("Hello");
  });
  const assistantMsg = $messages.get().find((m) => m.role === "assistant");
  expect(assistantMsg!.content).toBe("Response text");
});
```

## Component Test Pattern

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SettingsForm from "../settings-form";

it("calls onSubmit with trimmed values", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <SettingsForm
      initialValues={{ displayName: "Alice", geminiApiKey: "key" }}
      onSubmit={onSubmit}
    />,
  );
  const nameInput = screen.getByLabelText("Display Name");
  await user.clear(nameInput);
  await user.type(nameInput, "  Bob  ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onSubmit).toHaveBeenCalledWith({
    displayName: "Bob",
    geminiApiKey: "key",
  });
});
```

## AI Library Test Pattern

```typescript
import { vi } from "vitest";
import { generateChatTitle, streamChat } from "../ai";

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

const { streamText } = await import("ai");
const mockStreamText = vi.mocked(streamText);

function createMockTextStream(chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
  };
}

it("generateChatTitle returns title", async () => {
  mockStreamText.mockReturnValue(
    Promise.resolve(createMockTextStream(["Hello"])) as never,
  );
  const title = await generateChatTitle({
    apiKey: "key",
    messages: [{ role: "user", content: "Hi" }],
  });
  expect(title).toBe("Hello");
});
```

## Playwright E2E Pattern

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("create and view a chat", async ({ page }) => {
  await page.getByRole("button", { name: /new chat/i }).click();
  await page.getByPlaceholder("Chat title").fill("My Chat");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/chats\/.*\/messages/);
});
```

## Agentic E2E Workflow Examples

### Plan tests for a feature

Use the `playwright-test-plan` prompt template:

```plaintext
Create test plan for "chat management" functionality of my app.

- Seed file: `e2e/seed.spec.ts`
- Test plan: `playwright-specs/chat.plan.md`
```

### Generate tests from a plan

Use the `playwright-test-generate` prompt template:

```plaintext
Generate tests for bullet 1.1 from `playwright-specs/chat.plan.md`.
```

### Fix failing tests

Use the `playwright-test-heal` prompt template:

```plaintext
Run all E2E tests and fix the failing ones.
```

### Full pipeline (plan + generate + heal)

Use the `playwright-test-coverage` prompt template:

```plaintext
Task: chat management
Seed file: e2e/seed.spec.ts
Test plan file: playwright-specs/chat.plan.md
```

This runs the planner, then generates each test case one by one, then heals any failures.

## Common Mock Setup for Components

Components that use Radix UI tooltips, sonner toasts, or the router need these mocks:

```typescript
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", mockSetLocation],
}));

vi.mock("@/layout/sidebar-context", () => ({
  useSidebar: () => ({ closeSidebar: vi.fn() }),
}));
```
