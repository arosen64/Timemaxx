import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { preferencesAgent } from "./agents/preferencesAgent";
import { estimationAgent } from "./agents/estimationAgent";
import { supervisorWorkflow } from "./workflows/supervisorWorkflow";
import { taskWorkflow } from "./workflows/taskWorkflow";
import { feedbackWorkflow } from "./workflows/feedbackWorkflow";
import { preferencesWorkflow } from "./workflows/preferencesWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, preferencesAgent, estimationAgent },
  workflows: { supervisorWorkflow, taskWorkflow, feedbackWorkflow, preferencesWorkflow, estimationWorkflow },
});
