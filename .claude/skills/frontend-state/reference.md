# State Reference

## Plain Observable

For global state that doesn't need to survive a page refresh:

```typescript
import { observable } from "@legendapp/state";

export const $sidebarOpen = observable(false);
```

---

## Standard CRUD Functions

Every entity store exports these:

| Function                 | Purpose                          |
| ------------------------ | -------------------------------- |
| `add{Entity}(entity)`    | Append a new entity to the array |
| `update{Entity}(entity)` | Replace an entity by `_id`       |
| `remove{Entity}(id)`     | Filter out an entity by `_id`    |
| `clear{Entities}()`      | Reset to empty array             |

Some stores add feature-specific functions like `removeMessagesByChatId` for cascade deletes.

---

## Computed Values

Derive new values from existing observables using function syntax:

```typescript
import { observable } from "@legendapp/state";
import { $messages } from "./message";

export const $messageCount = observable(() => $messages.get().length);

export const $hasMessages = observable(() => $messages.get().length > 0);
```

Computed observables update automatically when their source observables change.

---

## Store File Template

```typescript
// 1. Imports
import { createPersistedObservable } from "@/store/persisted-observable";
import { entitySchema, type EntityType } from "../types/entity";

// 2. Safe decoder (never skip validation)
function decodeEntities(value: unknown): EntityType[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<EntityType[]>((acc, item) => {
    const result = entitySchema.safeParse(item);
    if (result.success) acc.push(result.data);
    return acc;
  }, []);
}

// 3. Observable definition
export const $entities = createPersistedObservable<EntityType[]>(
  "entities",
  [],
  decodeEntities,
);

// 4. CRUD functions
export function addEntity(entity: EntityType) { ... }
export function updateEntity(entity: EntityType) { ... }
export function removeEntity(id: string) { ... }
export function clearEntities() { ... }

// 5. Feature-specific functions (if any)
export function removeEntitiesByParentId(parentId: string) { ... }
```
