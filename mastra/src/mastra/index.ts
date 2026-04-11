import { Mastra } from "@mastra/core";
import { supervisorAgent, clarifierAgent, entityClarifierAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { supervisorWorkflow } from "./workflows/supervisorWorkflow";
import { taskWorkflow } from "./workflows/taskWorkflow";

export const mastra = new Mastra({
  agents: { supervisorAgent, clarifierAgent, entityClarifierAgent, taskAgent },
  workflows: { supervisorWorkflow, taskWorkflow },
});
