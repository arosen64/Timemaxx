# Docs

Project-level documents for planning, process, and decision-making. These are living documents — update them as the project evolves.

## Planning & Process

| Document                                                | What it covers                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Product Requirements](./product-requirements.md)       | What the product does and why — functional and non-functional requirements, roadmap |
| [Team Agreement](./team-agreement.md)                   | Team roles, communication norms, and working agreements                      |
| [Iteration Plan Template](./iteration-plan-template.md) | Template for planning iteration work — goals, tasks, and acceptance criteria |
| [Iteration 1 Plan](./iteration-1-plan.md)               | Requirements, task breakdown, architecture decisions, and assignees for Iteration 1 |
| [Iteration 2 Plan](./iteration-2-plan.md)               | Requirements, task breakdown, architecture decisions, and assignees for Iteration 2 |
| [Iteration 3 Plan](./iteration-3-plan.md)               | Requirements, task breakdown, architecture decisions, and assignees for Iteration 3 |
| [Iteration 4 Plan](./iteration-4-plan.md)               | Requirements, task breakdown, architecture decisions, and assignees for Iteration 4 |

## Topic Deep-Dives

| Document                                                | What it covers                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Prompt Injection Prevention](./prompt-injection-prevention.md) | Defense-in-depth strategy for Gemini-facing actions: role separation, XML delimiters, sanitization, length limits, Zod-validated output |
| [Anonymous Sign-In](./anonymous-sign-in.md)             | Dev-only "Continue as Guest" login (`ANONYMOUS_AUTH_ENABLED`) for testing without Google OAuth |

For setup walkthroughs (API keys, OAuth, ngrok, CI/CD, testing, scheduling algorithm, retrieval debug, Mastra eval suite) see [`guides/README.md`](../guides/README.md).
