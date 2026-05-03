/**
 * RAG Retrieval Eval (estimationAgent)
 *
 * Validates that the estimation agent uses chat-retrieval context in the same
 * shape the app sends (`<chat_history> ... </chat_history>`), specifically in
 * `reasoningTrace.chats`.
 *
 * Scorer:
 *   - rag-chat-grounding-scorer (custom):
 *     - parses structured JSON output from estimationAgent
 *     - inspects `reasoningTrace.chats`
 *     - checks expected retrieval signals are present
 */

import { createScorer, runEvals } from "@mastra/core/evals";
import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { estimationAgent } from "../mastra/agents/estimationAgent";

type MessagePart = { type: string; text?: string };
type AgentMessage = { role: string; content: unknown };

type RagGroundTruth = {
  scenario: "uses_retrieved_chat" | "no_chat_context";
  requiredAny: string[];
  requiredAll?: string[];
  forbidden?: string[];
};

function extractTextFromMessage(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return JSON.stringify(content);

  const obj = content as Record<string, unknown>;
  if (Array.isArray(obj.parts)) {
    return (obj.parts as MessagePart[])
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ");
  }

  return JSON.stringify(content);
}

function parseEstimationOutput(
  output: ScorerRunOutputForAgent
): { estimatedMinutes?: number; reasoningTrace?: Record<string, string> } | null {
  const text = Array.isArray(output)
    ? (output as AgentMessage[])
        .filter((m) => m.role === "assistant")
        .map((m) => extractTextFromMessage(m.content))
        .join(" ")
        .trim()
    : String(output).trim();

  try {
    return JSON.parse(text) as {
      estimatedMinutes?: number;
      reasoningTrace?: Record<string, string>;
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as {
        estimatedMinutes?: number;
        reasoningTrace?: Record<string, string>;
      };
    } catch {
      return null;
    }
  }
}

function buildEstimatePrompt(args: {
  title: string;
  taskType: string;
  description: string;
  courseInfo?: string;
  courseContext?: string;
  taskContext?: string;
  chatContext?: string;
  profileContext?: string;
}): string {
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

const ragChatGroundingScorer = createScorer({
  id: "rag-chat-grounding-scorer",
  description: "Checks whether reasoningTrace.chats reflects retrieved chat context usage",
})
  .analyze(({ run }) => {
    const gt = run.groundTruth as RagGroundTruth | undefined;
    if (!gt) return { score: 0 };

    const parsed = parseEstimationOutput(run.output as ScorerRunOutputForAgent);
    const chatsTrace = parsed?.reasoningTrace?.chats?.toLowerCase() ?? "";
    if (!chatsTrace) return { score: 0 };

    const hasAnyRequired = gt.requiredAny.some((needle) =>
      chatsTrace.includes(needle.toLowerCase())
    );
    const hasAllRequired = (gt.requiredAll ?? []).every((needle) =>
      chatsTrace.includes(needle.toLowerCase())
    );
    const hasForbidden = (gt.forbidden ?? []).some((needle) =>
      chatsTrace.includes(needle.toLowerCase())
    );

    if (!hasAnyRequired || !hasAllRequired || hasForbidden) return { score: 0 };

    return {
      score: 1,
      scenario: gt.scenario,
      chatsTrace,
      estimatedMinutes: parsed?.estimatedMinutes ?? null,
    };
  })
  .generateScore(({ results }) => {
    return (results.analyzeStepResult as { score: number }).score;
  });

const testData: Array<{ input: string; groundTruth: RagGroundTruth }> = [
  {
    input: buildEstimatePrompt({
      title: "BIO 110 Lab Report 3",
      taskType: "Lab Report",
      description: "Write a 4-page report with charts and discussion.",
      courseInfo: "BIO 110 - Intro Biology Lab",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: BIO 110 | Title: Intro Biology Lab | Term: Spring 2026 | Difficulty: 4/5",
      taskContext:
        'Prior tasks from this student (learn from feedback to calibrate the estimate):\n- Type: Lab Report | Title: "BIO 110 Lab Report 2" | Description: "Microscopy lab writeup" | Estimated: 150 min | Feedback: too_low (corrected to 230 min)',
      chatContext: `Relevant chat history (excerpts from prior conversations):
- (2026-03-20T15:04:00.000Z) Last BIO lab report took me around 4 hours because data analysis and chart cleanup took forever.
- (2026-03-27T19:21:00.000Z) I usually move slower on lab reports than quizzes.`,
      profileContext: JSON.stringify(
        {
          major: "Biology",
          year: "Sophomore",
          productivityTraits: ["works best in 45-minute blocks"],
        },
        null,
        2
      ),
    }),
    groundTruth: {
      scenario: "uses_retrieved_chat",
      requiredAny: ["4 hour", "lab report", "data analysis", "slower"],
      forbidden: ["no chat history", "none available"],
    },
  },
  {
    input: buildEstimatePrompt({
      title: "MATH 202 Problem Set",
      taskType: "Problem Set",
      description: "Complete 12 integral and series problems.",
      courseInfo: "MATH 202 - Calculus II",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: MATH 202 | Title: Calculus II | Term: Spring 2026 | Difficulty: 3/5",
      taskContext:
        'Prior tasks from this student (learn from feedback to calibrate the estimate):\n- Type: Problem Set | Title: "PS5" | Description: "Sequences and series" | Estimated: 90 min | Feedback: accurate',
      profileContext: JSON.stringify(
        {
          major: "Applied Math",
          year: "Junior",
          productivityTraits: ["high focus in mornings"],
        },
        null,
        2
      ),
    }),
    groundTruth: {
      scenario: "no_chat_context",
      requiredAny: ["no chat", "none", "not available", "without chat history"],
      requiredAll: ["chat"],
    },
  },
  {
    input: buildEstimatePrompt({
      title: "CS 230 Induction Homework",
      taskType: "Homework",
      description: "Solve 10 induction proofs with full written justifications.",
      courseInfo: "CS 230 - Discrete Mathematics",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: CS 230 | Title: Discrete Mathematics | Term: Spring 2026 | Difficulty: 4/5",
      taskContext:
        'Prior tasks from this student (learn from feedback to calibrate the estimate):\n- Type: Homework | Title: "Proof Worksheet 4" | Description: "Recurrence proofs" | Estimated: 110 min | Feedback: too_low (corrected to 170 min)',
      chatContext: `Relevant chat history (excerpts from prior conversations):
- (2026-03-10T14:00:00.000Z) I spent around 3 hours on last week's induction homework.
- (2026-03-11T18:20:00.000Z) Writing complete proof explanations takes me the longest.`,
      profileContext: JSON.stringify(
        {
          major: "Computer Science",
          year: "Sophomore",
          productivityTraits: ["prefers deep-work evenings"],
        },
        null,
        2
      ),
    }),
    groundTruth: {
      scenario: "uses_retrieved_chat",
      requiredAny: ["3 hour", "induction", "proof", "takes me the longest"],
      forbidden: ["no chat history", "none available"],
    },
  },
  {
    input: buildEstimatePrompt({
      title: "HIST 210 Reading Notes",
      taskType: "Reading Notes",
      description: "Read two chapters and submit bullet-point notes.",
      courseInfo: "HIST 210 - Modern Europe",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: HIST 210 | Title: Modern Europe | Term: Spring 2026 | Difficulty: 2/5",
      taskContext:
        'Prior tasks from this student (learn from feedback to calibrate the estimate):\n- Type: Reading Notes | Title: "Week 6 Notes" | Description: "Industrialization chapter notes" | Estimated: 60 min | Feedback: accurate',
      chatContext: `Relevant chat history (excerpts from prior conversations):
- (2026-03-25T17:45:00.000Z) History readings are usually straightforward for me and notes take about an hour.
- (2026-03-26T12:15:00.000Z) I can summarize these chapters quickly compared to my STEM classes.`,
      profileContext: JSON.stringify(
        {
          major: "International Studies",
          year: "Junior",
          productivityTraits: ["fast reader", "strong at summarization"],
        },
        null,
        2
      ),
    }),
    groundTruth: {
      scenario: "uses_retrieved_chat",
      requiredAny: ["about an hour", "quickly", "history readings", "summarize"],
      forbidden: ["no chat history", "none available"],
    },
  },
  {
    input: buildEstimatePrompt({
      title: "CHEM 135 Quiz Review",
      taskType: "Quiz Review",
      description: "Review notes and solve 20 practice questions before tomorrow's quiz.",
      courseInfo: "CHEM 135 - General Chemistry",
      courseContext:
        "Enrolled courses (most relevant to this task):\n- Code: CHEM 135 | Title: General Chemistry | Term: Spring 2026 | Difficulty: 3/5",
      taskContext:
        'Prior tasks from this student (learn from feedback to calibrate the estimate):\n- Type: Quiz Review | Title: "Quiz 2 prep" | Description: "Stoichiometry review" | Estimated: 95 min | Feedback: accurate',
      profileContext: JSON.stringify(
        {
          major: "Public Health",
          year: "Freshman",
          productivityTraits: ["needs frequent short breaks"],
        },
        null,
        2
      ),
    }),
    groundTruth: {
      scenario: "no_chat_context",
      requiredAny: ["no chat", "none", "not available", "without chat history"],
      requiredAll: ["chat"],
    },
  },
];

export async function runRagRetrievalEval() {
  if (testData.length === 0) {
    console.log("  (no test cases — add items to testData to run this eval)");
    return { scores: {}, summary: { totalItems: 0 } };
  }

  return runEvals({
    data: testData,
    target: estimationAgent,
    scorers: [ragChatGroundingScorer],
    onItemComplete: ({ item, scorerResults }) => {
      const result = scorerResults["rag-chat-grounding-scorer"];
      const passed = (result?.score ?? 0) === 1;
      const label = item.groundTruth.scenario;
      if (passed) {
        console.log(`    ✓  ${label}  PASS`);
        return;
      }
      console.log(`    ✗  ${label}  FAIL`);
      if (!passed) {
        console.log("    details:", JSON.stringify(result, null, 2));
      }
    },
  });
}
