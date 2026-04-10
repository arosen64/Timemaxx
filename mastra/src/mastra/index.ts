import { Mastra } from "@mastra/core";
import { chatAgent } from "./agents/chatAgent";
import { supervisorAgent, clarifierAgent } from "./agents/supervisorAgent";
import { supervisorWorkflow } from "./workflows/supervisorWorkflow";

export const mastra = new Mastra({
  agents: { chatAgent, supervisorAgent, clarifierAgent },
  workflows: { supervisorWorkflow },
});
