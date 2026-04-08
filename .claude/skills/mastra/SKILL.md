---
name: mastra
description: Mastra AI agent framework. Use when creating agents, adding tools, building workflows, configuring Mastra storage or memory, running the Mastra dev server, deploying Mastra to production, debugging agent issues, or asking about Mastra APIs and patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash(npx mastra *)
  - Bash(pnpm run dev:mastra)
  - Bash(cd mastra && pnpm install)
  - mcp__mastra__mastraDocs
  - mcp__mastra__searchMastraDocs
  - mcp__mastra__listMastraPackages
  - mcp__mastra__getMastraExports
  - mcp__mastra__getMastraExportDetails
  - mcp__mastra__readMastraDocs
  - mcp__mastra__getMastraHelp
  - mcp__mastra__mastraMigration
---

# Mastra Framework

[Mastra](https://mastra.ai/) is a TypeScript framework for building AI agents. You define agents (LLM + instructions + tools + memory) as code and Mastra gives you an HTTP server that exposes streaming endpoints for each agent.

## Mastra Documentation MCP

This project has a Mastra documentation MCP server configured in `.mcp.json` (`@mastra/mcp-docs-server`). It provides access to Mastra's official docs, API references, migration guides, and local package type definitions directly inside Claude Code.

**The MCP is disabled by default** to save tokens. It is configured in `.mcp.json` but not enabled in `.claude/settings.json` (`enabledMcpjsonServers` is empty).

When you need to work with Mastra APIs, look up types, or check documentation:

1. Ask the user to enable the Mastra MCP: "The Mastra documentation MCP is available but not currently enabled. Run `/mcp` in Claude Code and connect the `mastra` server to give me access to Mastra's docs and API references. This will help me give you accurate, version-matched answers."
2. Once enabled, use the `mcp__mastra__*` tools to look up APIs, read docs, and search for examples.
3. Always prefer the MCP tools over web searches for Mastra-specific questions — they return version-matched content from your installed packages.

Key MCP tools:

| Tool                     | Use for                                         |
| ------------------------ | ----------------------------------------------- |
| `getMastraHelp`          | Overview of all available doc tools             |
| `listMastraPackages`     | Discover installed `@mastra/*` packages         |
| `getMastraExports`       | List all exports from a package                 |
| `getMastraExportDetails` | Full type definitions for a specific export     |
| `readMastraDocs`         | Read topic-based guides from installed packages |
| `searchMastraDocs`       | Search across all local package docs            |
| `mastraDocs`             | Browse official remote docs by path             |
| `mastraMigration`        | Migration guides for version upgrades           |

---

## Core Concepts

| Concept      | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| **Agent**    | An LLM with a system prompt, optional tools, and optional memory          |
| **Tool**     | A function an agent can call, defined with Zod schemas for input/output   |
| **Workflow** | Multi-step orchestration with suspend/resume support (human-in-the-loop)  |
| **Memory**   | Conversation history and optional semantic recall, persisted to storage   |
| **Storage**  | Pluggable backend (LibSQL for local dev, Turso/PostgreSQL for production) |

---

## Standard Project Structure

The Mastra CLI expects the entry file at `src/mastra/index.ts` by default:

```plaintext
src/mastra/
├── index.ts           # Mastra instance — registers agents, workflows, storage
├── agents/            # Agent definitions
├── tools/             # Tool definitions
├── workflows/         # Workflow definitions
└── lib/               # Shared utilities (model helpers, storage config)
```

If the Mastra code lives in a subdirectory (e.g., `mastra/`), it has its own `package.json` and `node_modules`.

---

## Creating an Agent

```typescript
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai"; // or any Vercel AI SDK provider

export const myAgent = new Agent({
  id: "my-agent",
  name: "My Agent",
  instructions: "You are a helpful assistant that...",
  model: openai("gpt-4o"), // any AI SDK-compatible model
  tools: {
    /* optional tools */
  },
});
```

Register it in the Mastra instance:

```typescript
import { Mastra } from "@mastra/core";
import { myAgent } from "./agents/myAgent";

export const mastra = new Mastra({
  agents: { myAgent },
});
```

---

## Creating a Tool

Tools are functions agents can call. They are defined with Zod schemas and can access other agents via the execution context.

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const myTool = createTool({
  id: "my-tool",
  description: "Does something useful",
  inputSchema: z.object({
    query: z.string().describe("The input query"),
  }),
  execute: async (inputData, context) => {
    // Access other agents: context.mastra.getAgent("agentName")
    return { result: `Processed: ${inputData.query}` };
  },
});
```

Add the tool to an agent's `tools` object.

---

## CLI Commands

| Command            | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `npx mastra dev`   | Start the dev server (default port 4111) with Studio |
| `npx mastra build` | Build a standalone Node.js HTTP server               |
| `npx mastra init`  | Initialize a new Mastra project                      |

The dev server provides a Studio UI at `http://localhost:4111` for testing agents interactively.

---

## Deployment Options

Three options, from simplest to most control:

| Option                 | Description                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Mastra Cloud**       | Managed hosting at [cloud.mastra.ai](https://cloud.mastra.ai). Deploys from your GitHub repo.                 |
| **Netlify Functions**  | Add `@mastra/deployer-netlify`. Swap local LibSQL to remote storage (e.g., Turso). Subject to timeout limits. |
| **Standalone Node.js** | `npx mastra build` produces a plain Node.js server. Deploy to Railway, Render, Fly.io, etc.                   |

For Netlify Functions and standalone, swap local file-based storage (`file:local.db`) to a remote provider like [Turso](https://turso.tech/) for production.

---

## Common Environment Variables

| Variable             | Description                                       |
| -------------------- | ------------------------------------------------- |
| `OPENROUTER_API_KEY` | API key if using OpenRouter as the model provider |
| `OPENAI_API_KEY`     | API key if using OpenAI directly                  |
| `ANTHROPIC_API_KEY`  | API key if using Anthropic directly               |
| `EXA_API_KEY`        | API key for Exa web search (if using Exa tools)   |

The specific keys depend on which model provider and tools the project uses. Check the project's `.env.example` for the required variables.

---

## Project-Specific Integration

This skill covers Mastra as a framework. For how Mastra integrates with this specific project (backend connectivity, streaming architecture, specific agents and tools), check:

- The project's Mastra guide if one exists (e.g., `guides/mastra.md`)
- The Mastra entry file (usually `src/mastra/index.ts` or `mastra/src/mastra/index.ts`)
- The project's `.env.example` files for required environment variables
