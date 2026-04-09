// _mastraChat.ts
import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { ConvexStorage } from "@convex-dev/mastra/storage";
import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";

// Initialize Mastra storage with your Convex components
const storage = new ConvexStorage((components as any).mastra);

// Initialize Mastra AI agent with Google Gemini model
const chatAgent = new Agent({
  name: "TimeMaxx AI",
  instructions: `You are TimeMaxx AI, a helpful study planning assistant embedded in the TimeMaxx app.
You help JHU students manage their study schedules, tasks, deadlines, and workload.
Be concise, friendly, and specific. If you don't have enough context to answer precisely,
say so clearly rather than guessing.`,
  model: google("gemini-2.0-flash"),
});

// Define Mastra-powered Convex action
export const chat = internalAction({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    // Attach the Convex context to Mastra storage
    storage.ctx = ctx as any;

    // Generate response using the Mastra agent
    const response = await chatAgent.generate([
      { role: "user", content: args.message },
    ]);

    // Return text directly
    return response.text;
  },
});