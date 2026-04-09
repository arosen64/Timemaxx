import { Hono } from "hono";
import { MastraClient } from "@mastra/client-js";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type HonoEnv = {
  Bindings: {
    ctx: ActionCtx;
    userId: Id<"users">;
  };
};

const chatApp = new Hono<HonoEnv>();

chatApp.post("/api/chat", async (c) => {
  const { ctx, userId } = c.env;

  const body = await c.req.json<{ message?: string }>();
  const message = body.message?.trim();
  if (!message) {
    return c.json({ error: "Bad Request" }, 400);
  }

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    role: "user",
    content: message,
  });

  const mastraUrl = process.env.MASTRA_URL!;
  const client = new MastraClient({ baseUrl: mastraUrl });
  const agent = client.getAgent("chatAgent");
  const result = await agent.generate({ messages: [{ role: "user", content: message }] });
  const aiText = result.text ?? "";

  await ctx.runMutation(internal.mutations.chatMessages.saveMessage, {
    userId,
    role: "assistant",
    content: aiText,
  });

  return c.json({ text: aiText });
});

export default chatApp;
