---
name: frontend-design
description: UI/UX design guidance for clean, minimal interfaces. Use when designing new UI, reviewing design decisions, implementing layouts, choosing colors or spacing, working with dark mode or CSS variables, adding animations, hardening frontend code for production, fixing race conditions, lazy-loading libraries, or asking about Tailwind spacing, visual hierarchy, accessibility, and robustness patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Design Guide

Design philosophy and visual guidelines for this project.

## Related Skills

- **[frontend-components](../frontend-components/SKILL.md)** — Component patterns and shadcn/ui usage
- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization

---

## Quick Reference

| Topic          | File                                             | Description                                       |
| -------------- | ------------------------------------------------ | ------------------------------------------------- |
| **Reference**  | [reference.md](reference.md)                     | Visual hierarchy, motion, a11y                    |
| **AI Chat**    | [AI-CHAT-PATTERNS.md](AI-CHAT-PATTERNS.md)       | AI chat-specific UI patterns                      |
| **Robustness** | [ROBUSTNESS-PATTERNS.md](ROBUSTNESS-PATTERNS.md) | Race conditions, lazy loading, dependency hygiene |

---

## Design Philosophy

- **Clarity over cleverness** — Users should understand the interface instantly
- **Quiet confidence** — Design that doesn't need to shout
- **Strategic delight** — Wow moments at key interactions, restraint elsewhere
- **User-first decisions** — Usability drives aesthetics, never the reverse

---

## Semantic Tokens

Always use CSS variable-based tokens instead of hardcoded colors. They automatically adapt to light and dark mode.

### Backgrounds

| Token            | Usage              | Example                   |
| ---------------- | ------------------ | ------------------------- |
| `bg-background`  | Page background    | Main content area         |
| `bg-card`        | Elevated surfaces  | Cards, dialogs            |
| `bg-muted`       | Subtle backgrounds | Sidebar, tags             |
| `bg-accent`      | Hover/focus states | List item hover           |
| `bg-primary`     | Primary actions    | Buttons, user bubbles     |
| `bg-secondary`   | Secondary UI       | Assistant bubbles, badges |
| `bg-destructive` | Dangerous actions  | Delete buttons            |

### Text

| Token                   | Usage           | Example                |
| ----------------------- | --------------- | ---------------------- |
| `text-foreground`       | Primary text    | Headings, body text    |
| `text-muted-foreground` | Secondary text  | Descriptions, metadata |
| `text-primary`          | Emphasis, links | CTAs, active states    |

### Borders

| Token           | Usage              |
| --------------- | ------------------ |
| `border-border` | Default borders    |
| `border-input`  | Form input borders |
| `ring-ring`     | Focus indicators   |

---

## Spacing

Use Tailwind's standard spacing scale consistently. Avoid arbitrary values.

| Scale | Value | Common Use                         |
| ----- | ----- | ---------------------------------- |
| `1`   | 4px   | Icon margins, tight inline spacing |
| `2`   | 8px   | Icon gaps, compact lists           |
| `3`   | 12px  | Small element padding              |
| `4`   | 16px  | Default padding, standard gaps     |
| `6`   | 24px  | Card padding, section gaps         |
| `8`   | 32px  | Large section spacing              |

```tsx
// Related items — tight
<div className="space-y-2">

// Between form fields — standard
<div className="space-y-4">

// Between sections — generous
<div className="space-y-8">
```

---

## Typography

| Class       | Size | Use Case               |
| ----------- | ---- | ---------------------- |
| `text-xs`   | 12px | Fine print, timestamps |
| `text-sm`   | 14px | Helper text, labels    |
| `text-base` | 16px | Body text (default)    |
| `text-lg`   | 18px | Subheadings            |
| `text-2xl`  | 24px | Page titles            |

### Recommended Combinations

```tsx
<h2 className="text-2xl font-bold">           // Page title
<h2 className="text-lg font-semibold">        // Section heading
<p className="text-sm">                        // Body text
<p className="text-sm text-muted-foreground">  // Helper / secondary
<label className="text-sm font-medium">        // Label
```

---

## Quality Checklist

- [ ] Can a new user understand the interface in 5 seconds?
- [ ] Is the primary action obvious and prominent?
- [ ] Is there clear visual hierarchy (headings, spacing, color)?
- [ ] Are interactive elements obviously clickable?
- [ ] Have loading, error, and empty states been considered?
- [ ] Is there visual feedback for all interactions?
- [ ] Are focus states visible for keyboard navigation?
- [ ] Are semantic HTML elements used correctly?
- [ ] Do all colors use semantic tokens (not hardcoded)?
- [ ] Does it work in both light and dark mode?

---

## Detailed Documentation

- [reference.md](reference.md) — Visual hierarchy, motion, accessibility, anti-patterns
- [AI-CHAT-PATTERNS.md](AI-CHAT-PATTERNS.md) — AI chat-specific UI patterns (layout, messages, input, scrolling)
- [ROBUSTNESS-PATTERNS.md](ROBUSTNESS-PATTERNS.md) — Dependency hygiene, race condition protection, lazy loading, stale closures, key-based remounting, async handler patterns
