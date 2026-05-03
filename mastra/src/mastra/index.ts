import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisorAgent";
import { taskAgent } from "./agents/taskAgent";
import { feedbackAgent } from "./agents/feedbackAgent";
import { courseAgent } from "./agents/courseAgent";
import { scheduleAgent } from "./agents/scheduleAgent";
import { estimationAgent } from "./agents/estimationAgent";
import { syllabusAgent } from "./agents/syllabusAgent";
import { transcriptAgent } from "./agents/transcriptAgent";
import { subtaskAgent } from "./agents/subtaskAgent";
import { courseAnalystAgent } from "./agents/courseAnalystAgent";
import { academicProfileAgent } from "./agents/academicProfileAgent";

import { chatWorkflow } from "./workflows/chatWorkflow";
import { estimationWorkflow } from "./workflows/estimationWorkflow";
import { batchEstimationWorkflow } from "./workflows/batchEstimationWorkflow";
import { schedulingWorkflow } from "./workflows/schedulingWorkflow";
import { syllabusOcrWorkflow } from "./workflows/syllabusOcrWorkflow";
import { syllabusParseWorkflow } from "./workflows/syllabusParseWorkflow";
import { transcriptOcrWorkflow } from "./workflows/transcriptOcrWorkflow";
import { transcriptParseWorkflow } from "./workflows/transcriptParseWorkflow";
import { subtaskGenerationWorkflow } from "./workflows/subtaskGenerationWorkflow";
import { academicProfileWorkflow } from "./workflows/academicProfileWorkflow";

export const mastra = new Mastra({
  server: {
    middleware: [
      async (c, next) => {
        const secret = process.env.MASTRA_SERVER_SECRET;
        if (!secret) return next(); // no-op when secret is unset (local dev)
        const auth = c.req.header("Authorization");
        if (auth !== `Bearer ${secret}`) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        return next();
      },
    ],
  },
  agents: {
    supervisorAgent,
    taskAgent,
    feedbackAgent,
    scheduleAgent,
    courseAgent,
    estimationAgent,
    syllabusAgent,
    transcriptAgent,
    subtaskAgent,
    academicProfileAgent,
    courseAnalystAgent,
  },
  workflows: {
    chatWorkflow,
    estimationWorkflow,
    batchEstimationWorkflow,
    schedulingWorkflow,
    syllabusOcrWorkflow,
    syllabusParseWorkflow,
    transcriptOcrWorkflow,
    transcriptParseWorkflow,
    subtaskGenerationWorkflow,
    academicProfileWorkflow,
  },
});
