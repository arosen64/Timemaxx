import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { courseAgent } from "./agents/courseAgent";
import { scheduleAgent } from "./agents/scheduleAgent";
import { estimationAgent } from "./agents/estimationAgent";

import { chatWorkflow } from "./workflows/chatWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, courseAgent, scheduleAgent, estimationAgent },
  workflows: { chatWorkflow, estimationWorkflow },
});
