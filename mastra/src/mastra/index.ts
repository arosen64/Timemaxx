import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { estimationAgent } from "./agents/estimationAgent";

import { chatWorkflow } from "./workflows/chatWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, estimationAgent },
  workflows: { chatWorkflow, estimationWorkflow },
});
