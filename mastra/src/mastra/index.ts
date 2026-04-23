import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { courseAgent } from "./agents/courseAgent";
import { scheduleAgent } from "./agents/scheduleAgent";
import { chatWorkflow } from "./workflows/chatWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, courseAgent, scheduleAgent },
  workflows: { chatWorkflow },
});
