---
name: frontend-components
description: Component patterns and UI library usage. Use when creating components, using shadcn/ui, implementing theming, working with cn() or Tailwind, using lucide-react icons, showing toasts, working with forms, or asking about component organization and patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Components Guide

Patterns for creating components and using the UI library.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization (components live in `{feature}/components/`)
- **[frontend-hooks](../frontend-hooks/SKILL.md)** — Hooks that components consume
- **[frontend-design](../frontend-design/SKILL.md)** — Visual design and layout patterns
- **[frontend-prompt-kit](../frontend-prompt-kit/SKILL.md)** — AI chat UI primitives (message, chat container, markdown, etc.)

---

## Quick Reference

| Topic         | File                         | Description                        |
| ------------- | ---------------------------- | ---------------------------------- |
| **Reference** | [reference.md](reference.md) | Common patterns from this codebase |

---

## Component Location

| Type        | Location                     | Purpose                                |
| ----------- | ---------------------------- | -------------------------------------- |
| **Feature** | `src/{feature}/components/`  | Feature-specific UI                    |
| **Page**    | `src/{feature}/pages/`       | Route entry points (thin wrappers)     |
| **Shared**  | `src/components/`            | Reusable across features               |
| **UI**      | `src/components/ui/`         | shadcn/ui primitives                   |
| **AI UI**   | `src/components/prompt-kit/` | prompt-kit AI chat primitives          |
| **Layout**  | `src/layout/`                | Page structure (header, sidebar shell) |

---

## shadcn/ui Components

shadcn/ui components are copy-pasted into `src/components/ui/`. They're your code — modify freely. Import from `@/components/ui/*`:

```typescript
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

Button variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`. Sizes: `default`, `sm`, `lg`, `icon`.

To add new shadcn/ui components: `npx shadcn@latest add <component>`.

---

## Class Merging with `cn()`

Use `cn()` from `@/lib/utils` to merge Tailwind classes conditionally:

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "base-classes px-4 py-2",
  isActive && "bg-secondary font-medium",
  className,  // allow override from props
)}>
```

---

## Icons

Use `lucide-react` for icons. Standard size is `h-4 w-4`:

```typescript
import { Settings, Send, Plus, Trash2, Sun, Moon } from "lucide-react";

<Settings className="h-4 w-4" />

<Button size="icon" variant="ghost">
  <Settings className="h-4 w-4" />
</Button>
```

---

## Toasts

Use `sonner` for toast notifications. Toasts are typically called from mutation hooks, not directly from components:

```typescript
import { toast } from "sonner";

toast.success("Chat created successfully");
toast.error("Error creating chat", {
  description: "Please try again later",
});
```

The `<Toaster>` is mounted once in `main.tsx` with `richColors` and `position="top-center"`.

---

## Theming

The theme system uses CSS variables + a `dark` class on `<html>`. Three modes: `light`, `dark`, `system`.

### How It Works

1. **`src/store/theme.ts`** — Legend-State observable stores the user's choice
2. **`src/hooks/use-theme.tsx`** — `useTheme()` hook exposes `{ theme, setTheme }`
3. **`src/App.tsx`** — `useEffect` applies the correct class to `<html>`
4. **`src/styles/index.css`** — CSS variables for `:root` (light) and `.dark` (dark)

### Theme-Aware Styling

Use CSS variables, not hardcoded colors:

```tsx
<div className="bg-background text-foreground">
<div className="bg-primary text-primary-foreground">
<div className="bg-secondary text-secondary-foreground">
<div className="text-muted-foreground">

// dark: prefix for explicit overrides
<div className="bg-white dark:bg-gray-900">
```

### Key CSS Variables

| Variable                         | Usage                           |
| -------------------------------- | ------------------------------- |
| `background/foreground`          | Page background and text        |
| `primary/primary-foreground`     | Buttons, user message bubbles   |
| `secondary/secondary-foreground` | Secondary UI, assistant bubbles |
| `muted/muted-foreground`         | Disabled text, placeholders     |
| `destructive`                    | Delete buttons, error states    |
| `border`                         | Borders, dividers               |
| `input`                          | Input field borders             |
| `ring`                           | Focus rings                     |

---

## Checklist for New Components

- [ ] Create in appropriate directory (feature, shared, or layout)
- [ ] Define typed props interface
- [ ] Use `React.FC<Props>` with `const` declaration
- [ ] Accept `className` prop when root element can be styled by parents
- [ ] Use `cn()` to merge base classes with `className` prop
- [ ] Use CSS variables (`bg-primary`, `text-muted-foreground`) not hardcoded colors
- [ ] Use `lucide-react` for icons at `h-4 w-4` standard size
- [ ] Consume data through hooks, not by importing stores directly
- [ ] Default export for feature components

---

## Detailed Documentation

- [reference.md](reference.md) — Common component patterns from this codebase (page, form, list, message, input, composite)
