import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { syllabusAgent } from "./agents/syllabusAgent";
import { courseAgent } from "./agents/courseAgent";
import { transcriptAgent } from "./agents/transcriptAgent";
import { chatWorkflow } from "./workflows/chatWorkflow";
import { syllabusOcrWorkflow } from "./workflows/syllabusOcrWorkflow";
import { syllabusParseWorkflow } from "./workflows/syllabusParseWorkflow";
import { transcriptOcrWorkflow } from "./workflows/transcriptOcrWorkflow";
import { transcriptParseWorkflow } from "./workflows/transcriptParseWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, syllabusAgent, courseAgent, transcriptAgent },
  workflows: { chatWorkflow, syllabusOcrWorkflow, syllabusParseWorkflow, transcriptOcrWorkflow, transcriptParseWorkflow },
});
