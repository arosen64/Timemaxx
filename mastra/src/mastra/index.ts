import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { preferencesAgent } from "./agents/preferencesAgent";
import { chatWorkflow } from "./workflows/chatWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, taskAgent, feedbackAgent, preferencesAgent },
  workflows: { chatWorkflow },
});
