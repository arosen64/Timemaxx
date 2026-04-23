import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { syllabusAgent } from "./agents/syllabusAgent";
import { courseAgent } from "./agents/courseAgent";
import { chatWorkflow } from "./workflows/chatWorkflow";
import { syllabusOcrWorkflow } from "./workflows/syllabusOcrWorkflow";
import { syllabusParseWorkflow } from "./workflows/syllabusParseWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, syllabusAgent, courseAgent },
  workflows: { chatWorkflow, syllabusOcrWorkflow, syllabusParseWorkflow },
});
