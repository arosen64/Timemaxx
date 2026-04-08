---
name: feature-spec
description: Write feature specification documents (SPEC.md). Use when creating a new feature spec, documenting feature requirements, defining feature scope and boundaries, or when the user asks to write or create a spec for a feature.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Feature Specification Guide

Write SPEC.md documents that define feature intent, scope, behaviors, and dependencies.

## Related Skills

- **[frontend-features](../frontend-features/SKILL.md)** — Feature directory structure and organization

---

## When to Use

- Starting a new feature (spec-first development)
- Documenting an existing feature
- Clarifying feature boundaries before implementation
- Creating a source of truth for testing

---

## SPEC.md Template

Create `SPEC.md` in the feature's root directory (`src/{feature-name}/SPEC.md`):

```markdown
# {Feature Name}

## Purpose

2-3 sentences explaining WHY this feature exists and what problem it solves.
Focus on user value, not technical implementation.

## Scope

**Does:**

- Bullet list of what this feature handles
- Be specific and concrete
- Each item should be verifiable

**Does NOT:**

- Explicit boundaries (what this feature is NOT responsible for)
- Clarifies ownership between features
- Prevents scope creep

## Key Behaviors

Plain language descriptions of expected behaviors. Each becomes a test case:

1. When [trigger], [expected result]
2. If [condition], then [outcome]
3. Given [context], when [action], then [result]

Focus on observable behaviors, not implementation details.

## Dependencies

List features and stores this feature relies on:

- `feature-name` - what we use from it
- `$storeName` - store dependency and what data is consumed
- External: `library-name` - third-party dependency

## Known Gaps

Honest accounting of current limitations:

- Things that don't work yet
- Intentional simplifications
- Deferred functionality
- Edge cases not handled

## Files

Brief description of key files (for complex features only):

| File             | Purpose                       |
| ---------------- | ----------------------------- |
| `component.tsx`  | Main UI component             |
| `use-feature.ts` | Core hook with business logic |
```

---

## Writing Guidelines

### Purpose Section

- Answer "why does this exist?" not "what does it do?"
- Focus on the user problem being solved
- Keep to 2-3 sentences maximum

**Good:** "Lets users manage multiple independent conversations with separate message histories, so they can organize topics without losing context."

**Bad:** "Stores chat objects in a Legend-State observable with CRUD operations and localStorage persistence."

### Scope Section

- Be concrete and verifiable
- Use active voice ("Handles X", "Validates Y")
- The "Does NOT" list is equally important as "Does"

**Good Does:**

- Validates API key exists before sending messages
- Preserves message ordering within a chat
- Shows error toast for failed API calls

**Bad Does:**

- Manages messages
- Handles errors
- Works with the API

### Key Behaviors

- Write as testable assertions
- One behavior per line
- Use Given/When/Then format for complex behaviors

**Good:**

1. When user sends a message, it appears in the chat immediately as a user bubble
2. If API key is missing, shows error toast without sending the request
3. Given a new chat titled "New Chat", when first assistant response completes, auto-generates a title

**Bad:**

1. Sending messages works
2. Handles missing API key
3. Titles get generated

### Dependencies

- Only list direct dependencies
- Note what specifically is used from each dependency
- Include both internal features and external packages

### Known Gaps

- Be honest about limitations
- Include both bugs and intentional omissions
- Note if gap is planned for future work

---

## File Location

```plaintext
src/{feature-name}/
├── SPEC.md              # Feature specification
├── types/
├── store/
├── hooks/
├── components/
└── pages/
```

---

## Checklist

Before finalizing a SPEC.md:

- [ ] Purpose explains WHY, not just WHAT
- [ ] Scope "Does" items are concrete and verifiable
- [ ] Scope "Does NOT" clarifies boundaries with other features
- [ ] Key Behaviors can each become a test case
- [ ] Dependencies are accurate and specific
- [ ] Known Gaps are honest about limitations
- [ ] No implementation details (those belong in code)
- [ ] Another developer could understand feature scope from this alone
