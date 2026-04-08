---
name: frontend-routing
description: Routing patterns with Wouter. Use when adding routes, adding a new page, implementing navigation, using useLocation or Route, working with route parameters, or asking about how pages are resolved and rendered.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Frontend Routing Guide

Patterns for routing with Wouter.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature organization (pages live in `{feature}/pages/`)
- **[frontend-components](../frontend-components/SKILL.md)** — Page component patterns

---

## Architecture

Routing is handled by Wouter's JSX components in `App.tsx`. There is no separate router configuration file — routes are declared inline as `<Route>` components.

Navigation is done via the `useLocation` hook from Wouter:

```typescript
import { useLocation } from "wouter";

const [location, setLocation] = useLocation();
setLocation("/chats/abc/messages");
```

---

## Route Definition

Routes are declared as `<Route>` components inside a `<Switch>` in `App.tsx`:

```typescript
// src/App.tsx
import { Switch, Route, useLocation } from "wouter";

function App() {
  const [location] = useLocation();

  // Derive active chat ID from URL
  const chatIdMatch = location.match(/^\/chats\/([^/]+)\/messages$/);
  const activeChatId = chatIdMatch ? chatIdMatch[1] : undefined;

  return (
    <Layout
      sidebar={<ListChatsPage activeChatId={activeChatId} />}
      content={
        <Switch>
          <Route path="/chats/:id/messages">
            {(params) => (
              <MessagesPage key={params.id} chatId={params.id} />
            )}
          </Route>
          <Route>
            <HomeEmptyState />
          </Route>
        </Switch>
      }
    />
  );
}
```

The last `<Route>` without a `path` acts as the default (home/404).

---

## Navigation

Navigate with `useLocation` hook from Wouter:

```typescript
import { useLocation } from "wouter";

const [, setLocation] = useLocation();

setLocation("/");
setLocation(`/chats/${chatId}/messages`);
```

---

## Deriving State from Routes

Use `useLocation` + regex to derive UI state like active items in a sidebar:

```typescript
const [location] = useLocation();

const chatIdMatch = location.match(/^\/chats\/([^/]+)\/messages$/);
const activeChatId = chatIdMatch ? chatIdMatch[1] : undefined;

return <ChatList activeChatId={activeChatId} />;
```

---

## Route Parameters

Route parameters are accessed via the render function pattern:

```typescript
<Route path="/chats/:id/messages">
  {(params) => <MessagesPage chatId={params.id} />}
</Route>
```

Or via `useRoute` hook:

```typescript
import { useRoute } from "wouter";

const [match, params] = useRoute("/chats/:id/messages");
if (match) {
  // params.id is available
}
```

---

## Adding a New Route

1. Create the page component in the appropriate feature's `pages/` directory

2. Add a `<Route>` inside the `<Switch>` in `App.tsx`:

   ```typescript
   <Route path="/some/path/:param">
     {(params) => <NewPage param={params.param} />}
   </Route>
   ```

3. Update derived state (e.g., `activeChatId` regex) if the new route should affect sidebar highlighting

4. Add navigation calls using `setLocation` in the appropriate components

---

## Checklist for New Routes

- [ ] Create page component in `{feature}/pages/`
- [ ] Add `<Route>` inside `<Switch>` in `App.tsx`
- [ ] Update derived state regex if needed
- [ ] Add navigation calls using `useLocation` + `setLocation`
- [ ] Update tests to mock `wouter` if components use `useLocation`
