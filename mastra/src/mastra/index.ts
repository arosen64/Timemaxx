import { Mastra } from "@mastra/core";
import { chatAgent } from "./agents/chatAgent";

export const mastra = new Mastra({
  agents: { chatAgent },
});
