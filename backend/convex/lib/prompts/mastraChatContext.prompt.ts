// ---------------------------------------------------------------------------
// Mastra chat context builders (variable user content — XML-wrapped)
// Convex HTTP builds these strings and sends them to Mastra workflows as the
// user turn; agent system prompts live in mastra/src/mastra/lib/prompts/.
// ---------------------------------------------------------------------------

export function buildTaskAgentContextPrompt(params: {
  todayIso: string;
  historyText: string;
  resolvedTaskContext: string;
  resolvedCourseContext: string;
  continueNote: string;
}): string {
  return `Today (ISO date): ${params.todayIso}

<conversation_history>
${params.historyText}
</conversation_history>

<resolved_task_context>
${params.resolvedTaskContext}
</resolved_task_context>

<resolved_course_context>
${params.resolvedCourseContext}
</resolved_course_context>

<turn_directive>
${params.continueNote}
</turn_directive>`;
}

export function buildFeedbackAgentContextPrompt(params: {
  todayIso: string;
  historyText: string;
  resolvedTaskContext: string;
  resolvedCourseContext: string;
  continueNote: string;
}): string {
  return buildTaskAgentContextPrompt(params);
}

export function buildPreferencesAgentContextPrompt(params: {
  historyText: string;
  latestUserMessage: string;
}): string {
  return `<conversation_history>
${params.historyText}
</conversation_history>

<latest_user_message>
${params.latestUserMessage}
</latest_user_message>

<turn_directive>
Acknowledge what they want to change and direct them to the Preferences page.
</turn_directive>`;
}
