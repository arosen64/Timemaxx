---
name: frontend-types
description: TypeScript type definitions and Zod schemas. Use when defining new types, creating Zod schemas, adding a new entity, following the 3-schema pattern, or asking about type naming conventions, import patterns, or schema organization.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Types Guide

Patterns for TypeScript type definitions in the frontend codebase.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization (types live in `{feature}/types/`)
- **[frontend-hooks](../frontend-hooks/SKILL.md)** — Hooks consume these types
- **[frontend-state](../frontend-state/SKILL.md)** — Stores are typed with these schemas

---

## Quick Reference

| Topic         | File                         | Description                                |
| ------------- | ---------------------------- | ------------------------------------------ |
| **Reference** | [reference.md](reference.md) | Real codebase examples and import patterns |

---

## Type Location

Types live in their feature's `types/` directory. One file per entity:

```plaintext
src/
├── chats/types/
│   └── chat.ts          # Chat schemas + types
├── messages/types/
│   └── message.ts       # Message schemas + types
└── types/
    └── theme.ts         # Shared types (used across features)
```

---

## The 3-Schema Pattern

Every entity follows the same layered schema pattern:

```typescript
import { z } from "zod";

// 1. Create schema — what the user provides
export const createChatSchema = z.object({
  title: z.string().min(1),
});

// 2. Update schema — partial of create (all fields optional)
export const updateChatSchema = createChatSchema.partial();

// 3. Full entity schema — extends create with system fields
export const chatSchema = createChatSchema.extend({
  _id: z.string(),
  _creationTime: z.number(),
});

// Inferred types
export type CreateChatType = z.infer<typeof createChatSchema>;
export type UpdateChatType = z.infer<typeof updateChatSchema>;
export type ChatType = z.infer<typeof chatSchema>;
```

- `createSchema` — what the user controls. Used in forms and mutation hooks.
- `updateSchema` — all fields optional. Used for partial edits.
- `entitySchema` — adds system fields (`_id`, `_creationTime`). The full stored object.

Each field is defined once. Update and entity schemas derive from create.

---

## Naming Conventions

| Pattern                | Usage            | Example                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `create{Entity}Schema` | Create input     | `createChatSchema`, `createMessageSchema` |
| `update{Entity}Schema` | Update input     | `updateChatSchema`, `updateMessageSchema` |
| `{entity}Schema`       | Full entity      | `chatSchema`, `messageSchema`             |
| `Create{Entity}Type`   | Create type      | `CreateChatType`, `CreateMessageType`     |
| `Update{Entity}Type`   | Update type      | `UpdateChatType`, `UpdateMessageType`     |
| `{Entity}Type`         | Full entity type | `ChatType`, `MessageType`                 |

Always use the `Type` suffix to distinguish types from components or variables.

---

## Conventions

- **Zod schemas** for entities and validated data. **Interfaces** for component props and function signatures.
- Use `import type` for type-only imports.
- `_id` and `_creationTime` are system fields (prefixed with `_`). Assigned by the store layer, never in create/update schemas.

---

## Checklist for New Types

- [ ] Create file in `{feature}/types/{entity}.ts`
- [ ] Define `create{Entity}Schema` with user-provided fields
- [ ] Derive `update{Entity}Schema` via `.partial()`
- [ ] Extend to `{entity}Schema` with `_id` and `_creationTime`
- [ ] Export all three schemas and their inferred types
- [ ] Use `Type` suffix on all type names

---

## Detailed Documentation

- [reference.md](reference.md) — Real codebase example (messages) and import patterns
