# Hook Patterns

The four hook patterns used in this codebase.

## Pattern 1: Query Collection

Lists all items, or filters by a parent ID.

```typescript
// src/chats/hooks/use-query-chats.ts
import type { ChatType } from "@/chats/types/chat";
import { useSelector } from "@legendapp/state/react";
import { $chats } from "@/chats/store/chat";

export function useQueryChats() {
  const chats = useSelector(() => $chats.get());

  return {
    data: chats as ChatType[],
    loading: false,
    error: false,
  };
}
```

With filtering by parent ID:

```typescript
// src/messages/hooks/use-query-messages.ts
export function useQueryMessages(chatId: string) {
  const messages = useSelector(() => $messages.get());
  const filtered = messages.filter((m) => m.chatId === chatId);

  return {
    data: filtered as MessageType[],
    loading: false,
    error: false,
  };
}
```

---

## Pattern 2: Query Single

Finds one item by ID. `data` is `undefined` if the item doesn't exist.

```typescript
// src/chats/hooks/use-query-chat.ts
export function useQueryChat(chatId: string) {
  const chats = useSelector(() => $chats.get());
  const chat = chats.find((c) => c._id === chatId);

  return {
    data: chat as ChatType,
    loading: false,
    error: false,
  };
}
```

---

## Pattern 3: Mutation Collection

Creates a new item. Generates `_id` and `_creationTime`, calls the store, shows a toast, returns the new ID.

```typescript
// src/chats/hooks/use-mutation-chats.ts
import { toast } from "sonner";
import type { CreateChatType } from "@/chats/types/chat";
import { addChat } from "../store/chat";

export function useMutationChats() {
  const createChat = async (chat: CreateChatType): Promise<string | null> => {
    try {
      const chatId = crypto.randomUUID();
      addChat({ ...chat, _id: chatId, _creationTime: Date.now() });
      toast.success("Chat created successfully");
      return chatId;
    } catch (error) {
      toast.error("Error creating chat", {
        description: (error as Error).message || "Please try again later",
      });
      return null;
    }
  };

  return { add: createChat };
}
```

---

## Pattern 4: Mutation Single

Updates or deletes an existing item. Uses `useQueryChat` internally for merge-updating. Handles cascade deletes for child resources.

```typescript
// src/chats/hooks/use-mutation-chat.ts
import { toast } from "sonner";
import type { UpdateChatType } from "@/chats/types/chat";
import { useQueryChat } from "./use-query-chat";
import { updateChat, removeChat } from "@/chats/store/chat";
import { removeMessagesByChatId } from "@/messages/store/message";

export function useMutationChat(chatId: string) {
  const { data: chat } = useQueryChat(chatId);

  const editChat = async (updates: UpdateChatType): Promise<boolean> => {
    try {
      if (!chat) return false;
      updateChat({ ...chat, ...updates });
      toast.success("Chat updated successfully");
      return true;
    } catch (error) {
      toast.error("Error updating chat", {
        description: (error as Error).message || "Please try again later",
      });
      return false;
    }
  };

  const deleteChat = async (): Promise<boolean> => {
    try {
      removeMessagesByChatId(chatId);
      removeChat(chatId);
      toast.success("Chat deleted successfully");
      return true;
    } catch (error) {
      toast.error("Error deleting chat", {
        description: (error as Error).message || "Please try again later",
      });
      return false;
    }
  };

  return { edit: editChat, delete: deleteChat };
}
```

---

## Summary

| Pattern             | Takes           | Returns                      | Store Functions Used                   |
| ------------------- | --------------- | ---------------------------- | -------------------------------------- |
| Query Collection    | optional filter | `{ data[], loading, error }` | `useSelector(() => $obs.get())`        |
| Query Single        | `_id`           | `{ data, loading, error }`   | `useSelector(() => $obs.get())` + find |
| Mutation Collection | nothing         | `{ add }`                    | `addEntity()`                          |
| Mutation Single     | `_id`           | `{ edit, delete }`           | `updateEntity()`, `removeEntity()`     |
