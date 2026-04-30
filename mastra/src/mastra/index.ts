import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { courseAgent } from "./agents/courseAgent";
import { scheduleAgent } from "./agents/scheduleAgent";
import { estimationAgent } from "./agents/estimationAgent";
import { syllabusAgent } from "./agents/syllabusAgent";
import { transcriptAgent } from "./agents/transcriptAgent";
import { subtaskAgent } from "./agents/subtaskAgent";

import { chatWorkflow } from "./workflows/chatWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";
import { batchEstimationWorkflow } from "./workflows/batchEstimationWorkflow";
import { syllabusOcrWorkflow } from "./workflows/syllabusOcrWorkflow";
import { syllabusParseWorkflow } from "./workflows/syllabusParseWorkflow";
import { transcriptOcrWorkflow } from "./workflows/transcriptOcrWorkflow";
import { transcriptParseWorkflow } from "./workflows/transcriptParseWorkflow";
import { subtaskGenerationWorkflow } from "./workflows/subtaskGenerationWorkflow";

export const mastra = new Mastra({
  agents: {
    supervisorAgent,
    taskAgent,
    feedbackAgent,
    scheduleAgent,
    courseAgent,
    estimationAgent,
    syllabusAgent,
    transcriptAgent,
    subtaskAgent,
  },
  workflows: {
    chatWorkflow,
    estimationWorkflow,
    batchEstimationWorkflow,
    syllabusOcrWorkflow,
    syllabusParseWorkflow,
    transcriptOcrWorkflow,
    transcriptParseWorkflow,
    subtaskGenerationWorkflow,
  },
});
