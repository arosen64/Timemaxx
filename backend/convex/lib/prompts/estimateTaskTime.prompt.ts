// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export interface TimeEstimatePromptArgs {
  title: string;
  taskType: string;
  description: string;
  courseInfo?: string;
  courseContext?: string;
  taskContext?: string;
  chatContext?: string;
  profileContext?: string;
}

export function buildTimeEstimatePrompt(args: TimeEstimatePromptArgs): string {
  const sections: string[] = [];

  sections.push(`<task_details>
Title: ${args.title}
Type: ${args.taskType}
Description: ${args.description}
${args.courseInfo ? `Course: ${args.courseInfo}` : ""}
</task_details>`);

  if (args.courseContext) {
    sections.push(`<course_context>
${args.courseContext}
</course_context>`);
  }

  if (args.taskContext) {
    sections.push(`<task_history>
${args.taskContext}
</task_history>`);
  }

  if (args.chatContext) {
    sections.push(`<chat_history>
${args.chatContext}
</chat_history>`);
  }

  if (args.profileContext) {
    sections.push(`<student_profile>
${args.profileContext}
</student_profile>`);
  }

  return `Estimate the study time in minutes for this task. Use all available context to produce an accurate estimate, then provide a reasoning trace for each context category.\n\n${sections.join("\n\n")}`;
}
