# Types Reference

## Real Example: Messages Entity

From `src/messages/types/message.ts`:

```typescript
import { z } from "zod";

export const createMessageSchema = z.object({
  chatId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const updateMessageSchema = createMessageSchema.partial();

export const messageSchema = createMessageSchema.extend({
  _id: z.string(),
  _creationTime: z.number(),
});

export type CreateMessageType = z.infer<typeof createMessageSchema>;
export type UpdateMessageType = z.infer<typeof updateMessageSchema>;
export type MessageType = z.infer<typeof messageSchema>;
```

---

## Import Patterns

```typescript
// Type-only import (erased at runtime)
import type { ChatType } from "@/chats/types/chat";
import type { CreateMessageType } from "@/messages/types/message";

// Mixed — when you need both the schema and the type
import { createChatSchema } from "@/chats/types/chat";
import type { CreateChatType } from "@/chats/types/chat";
```
