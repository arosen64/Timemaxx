import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Kept separate from `chatChunks.ts` so `ai/embeddings` does not circular-import `internal` through that module. */
export const patchChatChunkEmbedding = internalMutation({
  args: {
    chatChunkId: v.id("chatChunks"),
    embedding: v.array(v.float64()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.chatChunkId);
    if (!row) {
      return null;
    }
    await ctx.db.patch(args.chatChunkId, { embedding: args.embedding });
    return null;
  },
});
