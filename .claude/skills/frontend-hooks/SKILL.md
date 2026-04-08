---
name: frontend-hooks
description: React hook patterns for data access and mutations. Use when creating a hook, writing a query hook, writing a mutation hook, implementing useQuery or useMutation, adding toast feedback, or asking about hook naming, return shapes, and conventions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Hooks Guide

Patterns for writing React hooks in the frontend codebase.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization (hooks live in `{feature}/hooks/`)
- **[frontend-types](../frontend-types/SKILL.md)** — Types that hooks consume
- **[frontend-state](../frontend-state/SKILL.md)** — Stores that hooks wrap

---

## Quick Reference

| Topic         | File                         | Description                          |
| ------------- | ---------------------------- | ------------------------------------ |
| **Reference** | [reference.md](reference.md) | All four hook patterns with examples |

---

## The Role of Hooks

Hooks are a thin bridge between the store layer and React components. Components never import stores directly — they use hooks. This means you can swap how data is stored without touching components.

```plaintext
Store ($chats, addChat, ...)  →  Hook (useQueryChats)  →  Component (<ChatList>)
```

---

## Hook Location

Hooks live in their feature's `hooks/` directory:

```plaintext
src/
├── chats/hooks/
│   ├── use-query-chats.ts       # List all chats
│   ├── use-query-chat.ts        # Get single chat by ID
│   ├── use-mutation-chats.ts    # Create chat
│   └── use-mutation-chat.ts     # Update/delete chat
└── messages/hooks/
    ├── use-query-messages.ts    # List messages by chatId
    ├── use-query-message.ts     # Get single message by ID
    ├── use-mutation-messages.ts # Create message
    └── use-mutation-message.ts  # Update/delete message
```

---

## Naming Convention

| Hook                 | Scope      | Purpose                    |
| -------------------- | ---------- | -------------------------- |
| `use-query-chats`    | Collection | List all / filter          |
| `use-query-chat`     | Single     | Get one by ID              |
| `use-mutation-chats` | Collection | Create (returns new ID)    |
| `use-mutation-chat`  | Single     | Update / delete (takes ID) |

**Plural** = operates on the collection (list, create).
**Singular** = operates on one item (get, update, delete).

---

## Return Shapes

### Query hooks:

```typescript
{
  data: T,          // Array for collection, object for single
  loading: boolean, // Always false with localStorage (forward-compatible)
  error: boolean,   // Always false with localStorage (forward-compatible)
}
```

### Collection mutation hooks:

```typescript
{
  add: (input: CreateType) => Promise<string | null>,  // Returns new ID or null
}
```

### Single-item mutation hooks:

```typescript
{
  edit: (updates: UpdateType) => Promise<boolean>,  // Returns success
  delete: () => Promise<boolean>,                   // Returns success
}
```

---

## Checklist for New Hooks

- [ ] Create in `{feature}/hooks/`
- [ ] Name with `use-query-*` or `use-mutation-*` prefix
- [ ] Plural for collection hooks, singular for single-item hooks
- [ ] Query hooks: subscribe with `useSelector` from `@legendapp/state/react`, return `{ data, loading, error }`
- [ ] Mutation hooks: wrap in try/catch, show toasts via `sonner`
- [ ] Mutation hooks: return `async` functions (forward-compatible with backends)
- [ ] Export named function (not default export)

---

## Detailed Documentation

- [reference.md](reference.md) — All four hook patterns with complete code from this codebase
