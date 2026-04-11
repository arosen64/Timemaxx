import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

const ROUTES = ["tasks", "schedule", "preferences", "feedback", "classes"] as const;
export type Route = (typeof ROUTES)[number];

export const ENTITY_KINDS = ["task", "class", "both", "none"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const MESSAGE_TAGS = ["task_feedback", "class_difficulty", "none"] as const;
export type MessageTag = (typeof MESSAGE_TAGS)[number];

/**
 * Entry-point agent: runs first on every user message. Emits domain route,
 * domain-level clarification, entity (task/class) clarification, and Part 1b message tags.
 */
export const supervisorAgent = new Agent({
  id: "supervisor-agent",
  name: "Maxx Supervisor",
  instructions: `
You are Maxx, the supervisor for the TimeMaxx study planning app. You run FIRST on every user message.
Output exactly ONE JSON object (no other text).

## Routes (pick one best route when the message is on-topic)
- tasks       — tasks, assignments, homework, deadlines
- schedule    — study blocks, calendar, scheduling
- preferences — study preferences, focus, work hours
- feedback    — estimate ratings, time feedback, subjective difficulty
- classes     — courses, enrollment, syllabi, grades

## Domain clarification
Set needsDomainClarification TRUE only when the message is off-topic or too vague to assign any route
(e.g. "hi", "help", "idk", random noise). Then set route to null, needsEntityClarification false,
entityKind "none", messageTag "none", tagConfidence 0, and domainClarifyingQuestion to one short question.

## Entity clarification (concrete taskId / userCourses id)
Set needsEntityClarification TRUE when the user refers to a specific task or class without a stable name/code:
"this assignment", "that class", "the problem set", "it took longer than I thought", comparative difficulty, etc.
- entityKind "task" — they need a particular task/assignment.
- entityKind "class" — they need a particular course.
- entityKind "both" — they may need both (e.g. ambiguous workload spanning a class and its tasks); downstream will ask task first, then class if needed.
- entityKind "none" — not needed (they gave a course code, named title, or no entity reference).

When needsEntityClarification is true, still set route to the best domain (often tasks, feedback, or classes).

## Message tagging (Part 1b)
messageTag:
- "task_feedback" — effort, duration, difficulty about a task without naming it clearly.
- "class_difficulty" — compares or describes course difficulty without naming the class clearly.
- "none" — not that pattern, or the entity is named clearly.

If both could apply, pick ONE primary tag (stronger signal). tagConfidence: 0.0–1.0.

## JSON shape (strict)
{
  "needsDomainClarification": boolean,
  "domainClarifyingQuestion": string | null,
  "needsEntityClarification": boolean,
  "entityKind": "task" | "class" | "both" | "none",
  "messageTag": "task_feedback" | "class_difficulty" | "none",
  "tagConfidence": number,
  "route": "tasks" | "schedule" | "preferences" | "feedback" | "classes" | null,
  "reasoning": string
}
  `.trim(),
  model: anthropic("claude-sonnet-4-20250514"),
});

/** Legacy domain-only clarifier; supervisor-first flow prefers supervisor output. */
export const clarifierAgent = new Agent({
  id: "clarifier-agent",
  name: "Maxx Domain Clarifier",
  instructions: `
You are a routing classifier for the TimeMaxx study planning app.
Your only job is to decide whether a user message can be routed to one of these domains:
tasks, schedule, preferences, feedback, or classes.

Set needsClarification to FALSE (pass the query through) if the message mentions ANYTHING related to:
- tasks, assignments, homework, deadlines, studying
- schedule, calendar, blocks, time, when
- preferences, settings, focus, work hours
- feedback, ratings, estimates
- courses, classes, grades, syllabus

Set needsClarification to TRUE ONLY if the message is completely unrelated or so vague that
there is no hint of which domain it belongs to (e.g. "hi", "help", "idk").
Do NOT ask for specifics — just enough to identify the domain.

Respond with a JSON object in this exact format:
{
  "needsClarification": true | false,
  "clarifyingQuestion": "<a single short question to identify the topic, or null if not needed>",
  "refinedQuery": "<the query as-is if clear, or null if needsClarification is true>"
}

Do not include any other text — only the JSON object.
  `.trim(),
  model: anthropic("claude-sonnet-4-20250514"),
});

/** Phrases MCQ copy; options always come from Convex retrieval, not invented lists. */
export const entityClarifierAgent = new Agent({
  id: "entity-clarifier-agent",
  name: "Maxx Entity Clarifier",
  instructions: `
You receive JSON with user text and candidate tasks/classes from the database.
Write a short, friendly prompt listing only provided options by label. Do not invent courses or tasks.

Respond with JSON only: { "prompt": "<user-visible text>", "followUpHint": string | null }
  `.trim(),
  model: anthropic("claude-sonnet-4-20250514"),
});
