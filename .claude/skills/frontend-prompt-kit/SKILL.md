---
name: frontend-prompt-kit
description: Working with prompt-kit AI chat components. Use when adding new prompt-kit components, customizing existing ones, troubleshooting prompt-kit issues, or asking about available AI UI primitives (messages, chat containers, markdown, code blocks, loaders, prompt inputs, etc.).
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - "Bash(npx shadcn@latest add *)"
  - "Bash(npm install *)"
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

# prompt-kit Guide

How to work with prompt-kit components in this project.

## Related Skills

- **[frontend-components](../frontend-components/SKILL.md)** — General component patterns and shadcn/ui usage
- **[frontend-design](../frontend-design/SKILL.md)** — Visual design and layout patterns

---

## What is prompt-kit?

Copy-paste UI primitives for AI chat interfaces, built on Tailwind and shadcn/ui. Like shadcn, components are owned locally — copied into `src/components/prompt-kit/` and modified freely. No npm dependency on prompt-kit itself.

---

## Critical: Installation Does NOT Work via CLI

The CLI and docs site aggressively rate-limit automated requests. Do not attempt:

- `npx shadcn@latest add "https://prompt-kit.com/c/..."` — registry returns 429
- `curl https://www.prompt-kit.com/docs/...` or `llms.txt` — blocked (429)

---

## How to Add a New prompt-kit Component

### Step 1: Get the source from GitHub

The source of truth is the GitHub repository. Fetch the raw file:

```
https://raw.githubusercontent.com/ibelick/prompt-kit/main/components/prompt-kit/{component-name}.tsx
```

Available components in the repo (as of last check):

| Component         | File                    | Description                              |
| ----------------- | ----------------------- | ---------------------------------------- |
| chat-container    | `chat-container.tsx`    | Auto-scrolling chat wrapper              |
| code-block        | `code-block.tsx`        | Syntax-highlighted code with copy button |
| loader            | `loader.tsx`            | 12 loading animation variants            |
| markdown          | `markdown.tsx`          | Memoized markdown renderer               |
| message           | `message.tsx`           | Message bubble with avatar and actions   |
| prompt-input      | `prompt-input.tsx`      | Auto-resizing textarea with actions      |
| prompt-suggestion | `prompt-suggestion.tsx` | Clickable suggestion pills               |
| scroll-button     | `scroll-button.tsx`     | Scroll-to-bottom floating button         |
| reasoning         | `reasoning.tsx`         | Collapsible AI reasoning display         |
| response-stream   | `response-stream.tsx`   | Client-side streaming text simulation    |
| file-upload       | `file-upload.tsx`       | Drag-and-drop file upload                |
| tool              | `tool.tsx`              | Tool call visualization                  |
| source            | `source.tsx`            | Source citation display                  |
| jsx-preview       | `jsx-preview.tsx`       | JSX string renderer                      |
| chain-of-thought  | `chain-of-thought.tsx`  | Chain of thought display                 |
| feedback-bar      | `feedback-bar.tsx`      | User feedback component                  |
| image             | `image.tsx`             | Image display component                  |
| steps             | `steps.tsx`             | Step-by-step display                     |
| system-message    | `system-message.tsx`    | System message display                   |
| text-shimmer      | `text-shimmer.tsx`      | Shimmer text effect                      |
| thinking-bar      | `thinking-bar.tsx`      | Thinking indicator bar                   |

### Step 2: Copy to `src/components/prompt-kit/`

Place the file in `src/components/prompt-kit/{component-name}.tsx`.

### Step 3: Clean up and adapt

Every component pulled from prompt-kit needs these adaptations:

#### Import paths

Original uses `@/components/ui/*` and `@/lib/utils` — these match the project structure. Check for:

- **Internal prompt-kit references**: e.g., `import { Markdown } from "./markdown"` — fine if the dependency component exists, otherwise pull that too.
- **Missing shadcn/ui components**: If it imports from `@/components/ui/avatar` and that doesn't exist, install with `npx shadcn@latest add avatar`.

#### `"use client"` directive

Original components include `"use client"` for Next.js. Unnecessary in this Vite + React setup but harmless — leave it or remove it. Be consistent with existing components.

#### App-specific adaptations

Some components may need deeper changes to integrate with our app:

- **code-block.tsx**: The local version imports `useTheme` from `@/hooks/use-theme` to switch Shiki themes based on light/dark mode. The original does not have this.
- **message.tsx**: The local version adjusts base styling classes (e.g., adding `prose prose-neutral break-words whitespace-normal`).
- **scroll-button.tsx**: Imports `buttonVariants` from our extracted `@/components/ui/button-variants` module.

#### Dependencies

Check for missing npm dependencies:

| Component      | Dependencies                                              |
| -------------- | --------------------------------------------------------- |
| markdown       | `react-markdown`, `remark-gfm`, `remark-breaks`, `marked` |
| code-block     | `shiki`                                                   |
| chat-container | `use-stick-to-bottom`                                     |
| scroll-button  | `use-stick-to-bottom`                                     |
| jsx-preview    | `react-jsx-parser`                                        |

#### Keyframe animations

Some components (especially `loader.tsx`) require custom CSS keyframes. Add them to `src/styles/index.css`. Check the source for `animate-[...]` class patterns and ensure corresponding `@keyframes` exist.

---

## Currently Installed Components

These prompt-kit components are already in the project at `src/components/prompt-kit/`:

- `chat-container.tsx` — Auto-scrolling chat wrapper using `use-stick-to-bottom`
- `code-block.tsx` — Syntax-highlighted code blocks with Shiki and copy button
- `loader.tsx` — Loading animation variants (typing, dots, shimmer, etc.)
- `markdown.tsx` — Memoized markdown rendering with GFM support
- `message.tsx` — Message bubbles with avatar, markdown content, and action tooltips
- `prompt-input.tsx` — Auto-resizing textarea with submit and action slots
- `prompt-suggestion.tsx` — Clickable prompt suggestion pills with highlight mode
- `scroll-button.tsx` — Floating scroll-to-bottom button for chat containers

---

## Using prompt-kit Components

Import from `@/components/prompt-kit/*`:

```typescript
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/prompt-kit/message";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/prompt-kit/chat-container";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/prompt-kit/prompt-input";
import { Markdown } from "@/components/prompt-kit/markdown";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "@/components/prompt-kit/code-block";
import { Loader } from "@/components/prompt-kit/loader";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";
import { PromptSuggestion } from "@/components/prompt-kit/prompt-suggestion";
```

---

## Reference Documentation

The docs site is not accessible programmatically, so this skill folder contains manually copied documentation:

| File                                   | Description                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| [prompt-kit-llm.md](prompt-kit-llm.md) | Component overview, API reference, props tables, and usage examples |

---

## Checklist for Adding a New prompt-kit Component

- [ ] Fetch source from GitHub raw URL (not the CLI or docs site)
- [ ] Place in `src/components/prompt-kit/{name}.tsx`
- [ ] Verify import paths resolve (`@/components/ui/*`, `@/lib/utils`, sibling `./` imports)
- [ ] Install any missing shadcn/ui dependencies (`npx shadcn@latest add {component}`)
- [ ] Install any missing npm dependencies
- [ ] Add required CSS keyframes to `src/styles/index.css` if needed
- [ ] Adapt styling to match the app's conventions (see existing components for reference)
- [ ] Test in both light and dark mode
