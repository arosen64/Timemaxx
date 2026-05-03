# Mastra Eval Suite Guide

This guide explains how to run the eval suite, understand the existing stubs, and add your own test cases.

## Overview

The eval suite lives in `mastra/src/evals/`. It uses [`@mastra/evals`](https://mastra.ai/docs/evals/overview) to score agent outputs against expected results. Each eval file targets a specific agent and area of behavior.

| File | Agent Under Test | Scorers |
|------|-----------------|---------|
| `chat-tool-calls.eval.ts` | `taskAgent`, `courseAgent`, `scheduleAgent`, `feedbackAgent` | Custom `actionType` / `intent` scorer |
| `supervisor-routing.eval.ts` | `supervisorAgent` | Trajectory accuracy, tool call accuracy |
| `entity-clarification.eval.ts` | `supervisorAgent` | Answer similarity, completeness |
| `time-estimate-range.eval.ts` | `estimationAgent` | Custom numeric range scorer |
| `rag-retrieval.eval.ts` | `taskAgent` | Context relevance, faithfulness, hallucination, context precision |
| `academic-profile.eval.ts` | `academicProfileAgent` | Completeness, faithfulness, answer similarity |

## Prerequisites

- `ANTHROPIC_API_KEY` set in `mastra/.env` (required for LLM judge scorers)
- Dependencies installed: `cd mastra && npm install`

## Running All Evals

```bash
cd mastra
npm run eval
```

Evals with no test cases yet print a skip message and move on. Only populated stubs make API calls.

## Adding Test Cases to Your Stub

Open your assigned eval file and add objects to the `testData` array. Each object is one test case.

### Agent evals (most files)

```ts
const testData = [
  {
    input: "What tasks do I have due tomorrow?",
    groundTruth: "You have 2 tasks due tomorrow: ...", // for similarity/faithfulness scorers
    expectedTrajectory: {                              // for trajectory scorers
      steps: [{ name: "getTasks", stepType: "tool_call" as const }],
      ordering: "relaxed" as const,
    },
  },
];
```

- `input` — the user message sent to the agent
- `groundTruth` — the expected answer (used by answer similarity and faithfulness scorers)
- `expectedTrajectory` — the expected sequence of tool calls or agent handoffs

### Chat tool calls eval (custom actionType / intent scorer)

The subagents (`taskAgent`, `courseAgent`, `scheduleAgent`, `feedbackAgent`) use structured JSON
output instead of Mastra `createTool()` calls. The built-in trajectory and tool-call scorers
don't apply here. Instead, `chat-tool-calls.eval.ts` uses two custom scorers that parse a named
field from the assistant's JSON response and compare it to a `groundTruth` string:

```ts
const testData = [
  // taskAgent — checks `actionType` field
  { input: "...", groundTruth: "create_task" },
  { input: "...", groundTruth: "update_task" },

  // feedbackAgent — checks `intent` field (no actionType in this agent)
  { input: "...", groundTruth: "task_feedback" },
];
```

Valid `actionType` values per agent:
- `taskAgent`: `create_task` | `update_task` | `delete_task` | `read_task`
- `courseAgent`: `add_course` | `drop_course` | `update_course` | `view_courses`
- `scheduleAgent`: `schedule_task` | `schedule_block` | `import_google_calendar`
- `feedbackAgent` (uses `intent`): `task_feedback` | `class_difficulty` | `unknown`

For operations that require a resolved entity (update, delete, read, drop, schedule), craft
the `input` as a full context string so the agent sees a `resolvedTaskId` or `resolvedCourseId`:

```ts
const input = `Today (ISO date): 2026-04-15

<conversation_history>
user: Update the due date of my CHEM Essay to April 25.
</conversation_history>

<resolved_task_context>
resolvedTaskId: task_eval_001
title: CHEM Essay
taskType: Essay
dueDateIso: 2026-04-20
</resolved_task_context>

<resolved_course_context>
none
</resolved_course_context>

<turn_directive>
Continue the current flow.
</turn_directive>`;
```

For `create_task`, simulate the second turn of the conversation (after the agent has gathered
all required fields and asked about subtasks) so it sets `readyToExecute = true`:

```ts
const input = `Today (ISO date): 2026-04-15

<conversation_history>
user: Create a task: CHEM Essay, Essay type, due 2026-04-20, no class.
assistant: {"message":"Should I generate AI subtasks?...","actionType":"none",...}
user: No subtasks.
</conversation_history>
...`;
```

### Time estimate eval (custom scorer)

```ts
const testData = [
  {
    input: "Write a 5-page essay on climate change",
    groundTruth: { minHours: 2, maxHours: 6 },
  },
];
```

The custom scorer parses the numeric estimate from the agent's response and checks it falls within `[minHours, maxHours]`. Update `extractHoursFromOutput` in the file if the agent's output format changes.

### RAG retrieval eval

```ts
const testData = [
  {
    input: "What did the syllabus say about the midterm format?",
    groundTruth: "The midterm is closed-book, 60 minutes, multiple choice.",
  },
];
```

Also implement `contextExtractor` in the scorer options to return the chunks the agent retrieved:

```ts
contextExtractor: (input, output) => {
  // parse retrieved chunks from the agent's output or tool call results
  return ["chunk 1 text", "chunk 2 text"];
},
```

## Scorer Reference

### Code-based (no API calls, instant)

| Scorer | What it checks |
|--------|---------------|
| `createToolCallAccuracyScorerCode` | Whether the expected tool was called, and optionally in the right order |
| `createTrajectoryAccuracyScorerCode` | Whether the full sequence of steps matches the expected trajectory |
| `createCompletenessScorer` | Whether all elements from the input appear in the output |

### LLM-based (requires `ANTHROPIC_API_KEY`, costs tokens)

| Scorer | What it checks |
|--------|---------------|
| `createAnswerSimilarityScorer` | Semantic similarity between output and ground truth |
| `createFaithfulnessScorer` | Whether the output is grounded in provided context |
| `createHallucinationScorer` | Whether the output contains fabricated claims |
| `createContextRelevanceScorerLLM` | Whether retrieved context chunks are relevant to the query |
| `createContextPrecisionScorer` | Whether high-relevance chunks are ranked before low-relevance ones |

All scorers return a score between 0 and 1. Higher is better.

## Scores Interpretation

```
--- Running: academic-profile ---
  Summary: 2 item(s) evaluated, scores: {
    "completeness-scorer": { "avg": 0.85, ... },
    "faithfulness-scorer": { "avg": 0.92, ... },
    ...
  }
```

- Scores near **1.0** — the agent is behaving as expected for these cases
- Scores near **0.0** — the agent is missing required behavior; investigate the `onItemComplete` output for details

## Scope

Each eval file is owned by one team member who is responsible for replacing the stub with real test cases. The `index.ts` entry point discovers and runs all files automatically — no changes needed there when adding cases to an existing file.

To add a **new** eval file:
1. Create `mastra/src/evals/<name>.eval.ts` following the pattern of an existing stub
2. Export a `run<Name>Eval()` function
3. Import and add it to the `evals` array in `index.ts`
