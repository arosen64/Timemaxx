# AI Chat UI Patterns

Design patterns specific to AI chat interfaces (ChatGPT, Claude, Gemini conventions). For general design principles (tokens, spacing, typography), see [SKILL.md](./SKILL.md).

---

## Layout

| Element             | Pattern                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Overall             | Sidebar (conversation list) + Main (active chat)                                          |
| Sidebar width       | ~260px expanded; overlay drawer on mobile                                                 |
| Content column      | Centered, `max-w-3xl` (~768px) for readable line length (45–75 chars)                     |
| Main vertical stack | Header (toolbar) → Scrollable messages (`flex-1`) → Fixed input at bottom                 |
| Mobile (<768px)     | Sidebar becomes sheet/drawer overlay; show hamburger in header; back arrow in chat header |

### Mobile Navigation (Critical)

Every AI chat app uses this pattern on mobile:

- **Viewing chat list:** Full-screen list, tap to open conversation
- **Viewing conversation:** Full-screen chat with back arrow → returns to list
- **Sidebar access:** Hamburger/menu icon in header opens drawer overlay
- Never simply hide the sidebar with no way back

---

## Messages

### Display Rules

| Role          | Style                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| **User**      | Right-aligned, subtle `bg-secondary` bubble, constrained width (`max-w-[80%]`)          |
| **Assistant** | Left-aligned, flat/transparent background, wider width (`max-w-[85%]`) for rich content |

### Differentiation (Three-Signal Approach)

Distinguish user vs. AI messages using all three signals for accessibility:

1. **Color** — Different backgrounds (bubble vs. transparent)
2. **Alignment** — User right, assistant left
3. **Iconography** — Small avatars (optional but helpful for scanning)

### Message Actions

- Show on hover (desktop), always visible on touch (mobile)
- **Assistant:** Copy, Thumbs up/down, Regenerate
- **User:** Copy, Edit
- Only show actions that are implemented — never show non-functional buttons

### Timestamps

De-emphasize. Show on hover or omit entirely. AI conversations are not time-sensitive like messaging apps.

---

## Input Area

| Pattern                | Implementation                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Textarea               | Auto-resize from 1 row up to ~240px max, then internal scroll                                                      |
| Submit                 | `Enter` to send, `Shift+Enter` for newline                                                                         |
| Send button            | Bottom-right, disabled when empty, enabled when content exists                                                     |
| Stop button            | Replace send button during streaming (square icon, destructive variant)                                            |
| Placeholder            | Action-oriented: "Ask anything..." or "Message ChatBot..."                                                         |
| Width                  | Match the message column `max-w-3xl` for visual alignment                                                          |
| Hint                   | Small text: "Enter to send, Shift+Enter for new line"                                                              |
| Unimplemented features | Hide entirely, or show disabled with "Coming soon" tooltip. Never show active buttons that toast "not implemented" |

---

## Empty States

### No conversation selected (desktop)

Show app logo, greeting, and prompt suggestion cards. Let users start chatting directly (auto-create conversation).

### Empty conversation (no messages yet)

```
[Icon or Logo]
"How can I help you today?"

[Suggestion] [Suggestion]
[Suggestion] [Suggestion]
```

- 3–4 diverse suggestions covering different capabilities (writing, analysis, coding, creative)
- Prefer inserting into textarea (user can edit) over immediate submit
- Avoid overly niche prompts — keep them broadly relatable

---

## Scrolling

| Behavior                | Rule                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Auto-scroll             | Only when user is at/near bottom. Use IntersectionObserver on a scroll anchor, not scroll math |
| User scrolled up        | Stop auto-scroll, respect their intent to read history                                         |
| Scroll-to-bottom button | Floating down-arrow, appears when not at bottom, smooth scroll on click                        |
| During streaming        | Continue auto-scroll if user was at bottom when streaming started; stop if they scroll up      |

---

## Conversation List

| Pattern              | Detail                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| Ordering             | Most recent activity first                                                      |
| Grouping             | "Today", "Yesterday", "Previous 7 Days", "This Month", "Older"                  |
| Active state         | Distinct background + left border accent                                        |
| Actions              | Edit (rename) and Delete via hover-reveal buttons or context menu               |
| Creating             | "New Chat" button at top; or auto-create when user starts typing in empty state |
| Titles               | Auto-generate from first message; allow rename later                            |
| Interactive elements | Never nest buttons inside other buttons — use sibling layout for accessibility  |

---

## Accessibility

| Requirement       | Implementation                                                                        |
| ----------------- | ------------------------------------------------------------------------------------- |
| Message container | `role="log"` + `aria-label="Conversation messages"` (implicit `aria-live="polite"`)   |
| Streaming status  | `aria-live="polite"` region announcing "Generating response..." / "Response complete" |
| Input             | `aria-label="Message input"` on textarea                                              |
| Focus management  | Move focus to input when selecting a conversation; trap focus in dialogs              |
| Keyboard          | All interactive elements reachable via Tab; Escape closes dialogs/menus               |
| Reduced motion    | Respect `prefers-reduced-motion` for all animations                                   |
| Touch targets     | Minimum 44x44px on mobile                                                             |

---

## Quality Checklist (AI Chat Specific)

- [ ] Can users navigate between chat list and conversation on mobile?
- [ ] Do messages have three-signal differentiation (color + alignment + icon)?
- [ ] Is `role="log"` set on the message container?
- [ ] Are all visible buttons functional? (No "not implemented" toasts)
- [ ] Does auto-scroll respect user intent when scrolled up?
- [ ] Is the input area aligned with the message column width?
- [ ] Do empty states include actionable prompt suggestions?
- [ ] Is Enter-to-send / Shift+Enter-for-newline discoverable?
