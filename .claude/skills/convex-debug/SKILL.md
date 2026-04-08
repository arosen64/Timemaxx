---
name: convex-debug
description: Debugging and troubleshooting Convex backends. Use when debugging Convex functions, troubleshooting Convex errors, enabling Convex MCP, looking up Convex documentation, inspecting deployment logs, checking Convex status, or asking about Convex API reference.
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# Convex Debugging & Troubleshooting

Workflow and resources for diagnosing issues in Convex backends.

## Related Skills

- **[convex-functions](../convex-functions/SKILL.md)** — Query, mutation, and action patterns
- **[convex-schema](../convex-schema/SKILL.md)** — Schema design, validators, indexes
- **[convex-architecture](../convex-architecture/SKILL.md)** — File organization, domain structure
- **[convex-http](../convex-http/SKILL.md)** — HTTP endpoints, SSE streaming, CORS
- **[convex-testing](../convex-testing/SKILL.md)** — Unit testing with convex-test

---

## Convex MCP Server

The project includes a Convex MCP server (configured in `.mcp.json`) that provides 12 tools for inspecting and managing the deployment. MCP is **disabled by default** to save tokens. When you need these tools, ask the user to enable the Convex MCP server via `/mcp`.

### Available MCP Tools

| Tool                          | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `mcp__convex__status`         | Get deployment info (dev/prod URLs, dashboard links)                    |
| `mcp__convex__tables`         | List all tables with inferred and declared schemas                      |
| `mcp__convex__data`           | Read paginated data from a table                                        |
| `mcp__convex__runOneoffQuery` | Run a sandboxed read-only query (great for ad-hoc investigation)        |
| `mcp__convex__functionSpec`   | Get metadata for all deployed functions (args, returns, visibility)     |
| `mcp__convex__run`            | Execute any Convex function (query, mutation, or action)                |
| `mcp__convex__logs`           | Fetch recent execution logs; use `status: "failure"` to see only errors |
| `mcp__convex__insights`       | Health insights: OCC conflicts, resource limit issues (last 72 hours)   |
| `mcp__convex__envList`        | List all environment variables                                          |
| `mcp__convex__envGet`         | Get a specific environment variable                                     |
| `mcp__convex__envSet`         | Set an environment variable                                             |
| `mcp__convex__envRemove`      | Remove an environment variable                                          |

### Usage Pattern

1. Call `mcp__convex__status` first to get the `deploymentSelector` for the dev deployment
2. Pass that selector to subsequent tool calls
3. Default to the development deployment (`kind: "ownDev"`) unless debugging production

---

## Documentation Resources

When you need to look up Convex APIs, patterns, or features, fetch the official LLM-friendly documentation:

1. **Entry point** — Fetch `https://docs.convex.dev/llms.txt` first. It provides a structured overview and links to detailed pages.
2. **Full reference** — If you need more detail, fetch `https://docs.convex.dev/llms-full.txt` for comprehensive documentation.

Use `WebFetch` to retrieve these URLs with a targeted prompt describing what you're looking for.

---

## Convex Rules Reference

The file [convex-rules.md](convex-rules.md) in this skill directory contains official Convex guidelines covering:

- Function syntax (queries, mutations, actions, HTTP endpoints)
- Validator types and usage
- Schema design patterns
- Query and mutation best practices
- Scheduling (crons, `runAfter`)
- File storage
- Full examples (chat app)

**Always consult this file before fetching external docs** — it may already have the answer.

---

## Debugging Workflow

When troubleshooting a Convex issue, follow this checklist in order:

1. **Check logs via MCP** — Call `mcp__convex__logs` with `status: "failure"` to see recent errors and stack traces. If MCP isn't enabled, ask the user to enable it via `/mcp`.
2. **Check insights** — Call `mcp__convex__insights` for OCC conflicts and resource limit warnings.
3. **Consult the rules file** — Read [convex-rules.md](convex-rules.md) for the correct API patterns.
4. **Fetch documentation** — Use `WebFetch` on `https://docs.convex.dev/llms.txt` with a prompt describing the issue.
5. **Search the web** — Use `WebSearch` for recent issues, changelogs, or community solutions.
6. **Inspect data** — Use `mcp__convex__data` or `mcp__convex__runOneoffQuery` to check actual database state.
7. **Review function specs** — Use `mcp__convex__functionSpec` to verify deployed function signatures match expectations.

### Common Issues

| Symptom                                 | Likely Cause                                | Check                                                 |
| --------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| "Write outside of transaction" in tests | Missing fake timers for scheduled functions | Add `vi.useFakeTimers()`                              |
| OCC retry errors                        | Mutations conflicting on same document      | `mcp__convex__insights` for OCC data                  |
| Function not found                      | Deployment out of sync                      | `mcp__convex__functionSpec` to see deployed functions |
| Auth errors                             | Missing or misconfigured auth wrapper       | Verify `queryWithAuth`/`mutationWithAuth` usage       |
| Slow queries                            | Missing index, full table scan              | `mcp__convex__insights` for resource limit warnings   |
