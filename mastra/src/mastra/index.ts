import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { estimationAgent } from "./agents/estimationAgent";
import { syllabusAgent } from "./agents/syllabusAgent";
import { transcriptAgent } from "./agents/transcriptAgent";

import { chatWorkflow } from "./workflows/chatWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";
import { syllabusOcrWorkflow } from "./workflows/syllabusOcrWorkflow";
import { syllabusParseWorkflow } from "./workflows/syllabusParseWorkflow";
import { transcriptOcrWorkflow } from "./workflows/transcriptOcrWorkflow";
import { transcriptParseWorkflow } from "./workflows/transcriptParseWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, estimationAgent, syllabusAgent, transcriptAgent },
  workflows: { chatWorkflow, estimationWorkflow, syllabusOcrWorkflow, syllabusParseWorkflow, transcriptOcrWorkflow, transcriptParseWorkflow },
});
