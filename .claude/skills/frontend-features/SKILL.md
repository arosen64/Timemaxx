---
name: frontend-features
description: Creating and structuring frontend feature modules. Use when adding a new feature, refactoring feature structure, organizing code by feature, implementing feature-first organization, or asking about feature directory structure, file layout, or import patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Features Guide

Patterns for creating and organizing feature modules in the frontend codebase.

## Related Skills

- **[frontend-types](../frontend-types/SKILL.md)** — Type definitions and Zod schemas
- **[frontend-state](../frontend-state/SKILL.md)** — State management with Legend-State
- **[frontend-hooks](../frontend-hooks/SKILL.md)** — Hook patterns for data and logic
- **[frontend-components](../frontend-components/SKILL.md)** — UI component patterns
- **[frontend-routing](../frontend-routing/SKILL.md)** — Routing and navigation
- **[frontend-design](../frontend-design/SKILL.md)** — Visual design and theming
- **[feature-spec](../feature-spec/SKILL.md)** — Writing SPEC.md documents for features

---

## Quick Reference

| Topic         | File                         | Description                                    |
| ------------- | ---------------------------- | ---------------------------------------------- |
| **Reference** | [reference.md](reference.md) | Feature examples, file naming, import patterns |

---

## Project Layout

Code is organized **by feature, not by type**. All code for "chats" lives together in `src/chats/`.

```plaintext
src/
├── chats/                # Chat feature
│   ├── types/
│   ├── store/
│   ├── hooks/
│   ├── components/
│   └── pages/
├── messages/             # Messages feature
│   ├── types/
│   ├── store/
│   ├── hooks/
│   ├── components/
│   └── pages/
├── components/           # Shared components (used across features)
│   ├── ui/               # shadcn/ui primitives (button, tooltip, etc.)
│   ├── theme-toggle.tsx
│   └── tooltip-button.tsx
├── hooks/                # Shared hooks
├── store/                # Shared stores
├── types/                # Shared types
├── lib/                  # Shared utilities
├── config/               # App configuration
├── layout/               # Layout components (header, sidebar shell)
├── styles/               # Global CSS
├── App.tsx               # Root component
└── main.tsx              # Entry point
```

---

## Feature Structure

Each feature follows the `types/ → store/ → hooks/ → components/ → pages/` pipeline. Each layer depends only on the layers before it. Create only what you need:

| Directory     | Purpose                  | When to Create                          |
| ------------- | ------------------------ | --------------------------------------- |
| `types/`      | Zod schemas and types    | Almost always — defines the data shape  |
| `store/`      | Legend-State observables | When the feature manages its own state  |
| `hooks/`      | Custom React hooks       | When components need data or logic      |
| `components/` | React components         | Always — features need UI               |
| `pages/`      | Route page components    | When the feature has navigable views    |
| `lib/`        | Utilities, helpers       | When you need pure functions, constants |

---

## Key Principles

1. **Feature-first colocation** — All code for a feature lives in one directory
2. **Direct imports, no barrel files** — Import from specific files, not `index.ts` at feature root
3. **Pipeline order** — `types/ → store/ → hooks/ → components/ → pages/` — each layer depends only on the layers before it

---

## When to Put Code in Shared

**Put in shared (`src/components/`, `src/hooks/`, etc.) when:**

- Used by 3+ features
- Truly generic (no feature-specific logic)
- Stable API unlikely to change with any single feature

**Keep in the feature when:**

- Used by 1-2 features
- Contains feature-specific logic
- Likely to evolve with the feature

When in doubt, keep it in the feature.

---

## Checklist for New Features

- [ ] Create `src/{feature-name}/` directory
- [ ] Add only the subdirectories you need
- [ ] Define data shapes in `types/` with Zod schemas
- [ ] Create store in `store/` if the feature has its own state
- [ ] Create hooks in `hooks/` for data access and mutations
- [ ] Create components in `components/`
- [ ] Add page components in `pages/` if the feature has routes
- [ ] Add `<Route>` inside `<Switch>` in `src/App.tsx` if adding routes
- [ ] Update `src/App.tsx` if adding new pages
- [ ] Do NOT create `index.ts` at feature root

---

## Detailed Documentation

- [reference.md](reference.md) — Feature examples, file naming conventions, import patterns
