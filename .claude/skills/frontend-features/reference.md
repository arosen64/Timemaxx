# Features Reference

## Example: Chats Feature

```plaintext
chats/
├── types/
│   └── chat.ts                # Zod schemas + ChatType
├── store/
│   └── chat.ts                # $chats observable + CRUD functions
├── hooks/
│   ├── use-query-chats.ts     # List all chats
│   ├── use-query-chat.ts      # Get single chat by ID
│   ├── use-mutation-chats.ts  # Create chat
│   └── use-mutation-chat.ts   # Update/delete chat
├── components/
│   ├── chat-list.tsx           # Renders list of chats
│   ├── add-chat-form.tsx       # Form for creating
│   └── edit-chat-form.tsx      # Form for editing
└── pages/
    ├── list-chats-page.tsx     # Chat list + new chat button
    ├── add-chat-page.tsx       # Create chat page
    └── edit-chat-page.tsx      # Edit chat page
```

## Example: Messages Feature

```plaintext
messages/
├── types/
│   └── message.ts             # Zod schemas + MessageType
├── store/
│   └── message.ts             # $messages observable + CRUD functions
├── hooks/
│   ├── use-query-messages.ts  # List messages by chatId
│   ├── use-query-message.ts   # Get single message by ID
│   ├── use-mutation-messages.ts # Create message
│   └── use-mutation-message.ts  # Update/delete message
├── components/
│   ├── message.tsx            # Single message bubble
│   ├── message-list.tsx       # Scrollable message list
│   └── message-input.tsx      # Textarea + send button
└── pages/
    └── messages-page.tsx      # Full messages view
```

---

## File Naming Conventions

| Type       | Convention            | Example              |
| ---------- | --------------------- | -------------------- |
| Components | kebab-case `.tsx`     | `chat-list.tsx`      |
| Hooks      | `use-` prefix `.ts`   | `use-query-chats.ts` |
| Types      | kebab-case `.ts`      | `chat.ts`            |
| Stores     | feature name `.ts`    | `chat.ts`            |
| Pages      | `-page` suffix `.tsx` | `edit-chat-page.tsx` |
| Utilities  | kebab-case `.ts`      | `utils.ts`           |

---

## Import Patterns

### Path Alias

`@/` maps to `src/`. Use it for all imports outside the current feature. Use relative imports within the same feature:

```typescript
// Cross-feature or shared (use @/)
import { Button } from "@/components/ui/button";
import type { ChatType } from "@/chats/types/chat";

// Within same feature (use relative)
import { useQueryChat } from "./use-query-chat";
import { addChat } from "../store/chat";
```

### Import Order

Four groups, separated by blank lines:

```typescript
// 1. React and built-in modules
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { useSelector } from "@legendapp/state/react";
import { toast } from "sonner";

// 3. Absolute path imports (@/)
import { Button } from "@/components/ui/button";
import type { ChatType } from "@/chats/types/chat";

// 4. Relative imports (same feature)
import { useQueryChat } from "./use-query-chat";
import { updateChat } from "../store/chat";
```

### Cross-Feature Imports

When one feature needs another's store (e.g., cascade deletes):

```typescript
// chats/hooks/use-mutation-chat.ts
import { updateChat, removeChat } from "@/chats/store/chat";
import { removeMessagesByChatId } from "@/messages/store/message";
```

Navigation uses Wouter's `useLocation` hook:

```typescript
import { useLocation } from "wouter";

const [, setLocation] = useLocation();
setLocation(`/chats/${chatId}/messages`);
```
