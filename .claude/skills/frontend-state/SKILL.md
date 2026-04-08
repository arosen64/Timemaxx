---
name: frontend-state
description: State management with Legend-State. Use when creating a store, using observable, implementing localStorage persistence, safe decoding, validating persisted data, adding computed values, deciding where state should live, or asking about store patterns and naming conventions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend State Management Guide

Patterns for state management using Legend-State observables.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization (stores live in `{feature}/store/`)
- **[frontend-types](../frontend-types/SKILL.md)** — Types that stores are built on
- **[frontend-hooks](../frontend-hooks/SKILL.md)** — Hooks that consume stores

---

## Quick Reference

| Topic         | File                         | Description                                          |
| ------------- | ---------------------------- | ---------------------------------------------------- |
| **Reference** | [reference.md](reference.md) | CRUD table, computed values, debug logging, template |

---

## When to Use What

| State Type                    | Solution                                   | Example               |
| ----------------------------- | ------------------------------------------ | --------------------- |
| **Persisted entity data**     | `createPersistedObservable` (Legend-State) | Chats, messages       |
| **Persisted user preference** | `createPersistedObservable` (Legend-State) | Theme setting         |
| **Global UI state**           | `observable` (Legend-State)                | Sidebar open/closed   |
| **Component local state**     | `useState` (React)                         | Form inputs, toggles  |
| **Derived/computed state**    | `observable(() => ...)` (Legend-State)     | Filtered list, counts |

If state needs to survive a page refresh, use `createPersistedObservable`. If it's global but ephemeral, use `observable`. If it's local to one component, use `useState`.

---

## State Location

Stores live in their feature's `store/` directory. The shared `createPersistedObservable` utility lives in `src/store/`:

```plaintext
src/
├── store/
│   ├── persisted-observable.ts  # createPersistedObservable utility
│   └── theme.ts                 # Shared theme store
├── chats/store/
│   └── chat.ts                  # $chats observable + CRUD functions
├── messages/store/
│   └── message.ts               # $messages observable + CRUD functions
└── settings/store/
    └── settings.ts              # $settings observable + CRUD functions
```

---

## The Store Pattern

Every entity store follows the same shape — a `createPersistedObservable` holding an array, a **safe decoder**, plus plain functions to mutate it:

```typescript
import { createPersistedObservable } from "@/store/persisted-observable";
import { chatSchema, type ChatType } from "@/chats/types/chat";

function decodeChats(value: unknown): ChatType[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChatType[]>((acc, item) => {
    const result = chatSchema.safeParse(item);
    if (result.success) {
      acc.push(result.data);
    }
    return acc;
  }, []);
}

export const $chats = createPersistedObservable<ChatType[]>(
  "chats",
  [],
  decodeChats,
);

export function addChat(newChat: ChatType) {
  $chats.set([...$chats.get(), newChat]);
}

export function updateChat(updatedChat: ChatType) {
  const chats = $chats
    .get()
    .map((chat) => (chat._id === updatedChat._id ? updatedChat : chat));
  $chats.set(chats);
}

export function removeChat(chatId: string) {
  const chats = $chats.get().filter((chat) => chat._id !== chatId);
  $chats.set(chats);
}

export function clearChats() {
  $chats.set([]);
}
```

**Never skip the decode function.** localStorage is user-editable and can become malformed (schema changes, manual edits, corruption). See [Safe Decoding](#safe-decoding) below for all three patterns.

---

## The Abstraction Boundary

The store is the **only place that knows where data comes from**. Everything above — hooks, components, pages — talks to the store through its exported functions. Swap the store internals and everything above still works.

```plaintext
┌──────────────────────────────────────────────┐
│  Pages / Components / Hooks               │  ← Don't know about localStorage
├──────────────────────────────────────────────┤
│  Store ($chats, addChat, removeChat, ...) │  ← The abstraction boundary
├──────────────────────────────────────────────┤
│  createPersistedObservable → localStorage │  ← Swappable
└──────────────────────────────────────────────┘
```

---

## Safe Decoding

Every persisted observable needs a custom decode function that validates data with Zod and falls back to defaults on failure. Three patterns depending on the data shape:

### Array Entities

Use `reduce` + `safeParse` to keep valid items and silently drop invalid ones:

```typescript
function decodeChats(value: unknown): ChatType[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChatType[]>((acc, item) => {
    const result = chatSchema.safeParse(item);
    if (result.success) {
      acc.push(result.data);
    }
    return acc;
  }, []);
}
```

### Single Objects

Return the default value on validation failure:

```typescript
function decodeSettings(value: unknown): SettingsType {
  const result = settingsSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  return defaultSettings;
}
```

### Scalar Values (Enums, Primitives)

Validate manually when a Zod schema is overkill:

```typescript
function decodeTheme(value: unknown): Theme {
  if (value === "dark" || value === "light" || value === "system") {
    return value;
  }
  return "system";
}
```

---

## The Persistence Utility

`createPersistedObservable` in `src/store/persisted-observable.ts` handles the persistence plumbing:

1. Reads from localStorage on init
2. Validates with the decode function
3. Creates an `observable` with the validated value
4. Subscribes to `.onChange` to write back to localStorage

```typescript
import { observable, type Observable } from "@legendapp/state";

export function createPersistedObservable<T>(
  name: string,
  initial: T,
  decode: (value: unknown) => T,
): Observable<T> {
  let initialValue = initial;
  try {
    const stored = localStorage.getItem(name);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      initialValue = decode(parsed);
    }
  } catch {
    // Fallback to initial value
  }

  const obs = observable<T>(initialValue);

  obs.onChange(({ value }) => {
    localStorage.setItem(name, JSON.stringify(value));
  });

  return obs;
}
```

---

## Checklist for New Store

- [ ] Create in `{feature}/store/{entity}.ts`
- [ ] Use `createPersistedObservable` for data that should survive refresh
- [ ] Use `observable` for ephemeral global state
- [ ] Prefix observable names with `$` (`$chats`, `$messages`)
- [ ] Write a safe decode function (never skip validation)
- [ ] Export plain functions for mutations (`addChat`, `removeChat`)
- [ ] Components consume stores through hooks, never import stores directly

---

## Detailed Documentation

- [reference.md](reference.md) — CRUD function table, plain observable, computed values, store file template
