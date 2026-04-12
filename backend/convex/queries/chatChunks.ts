import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Batch-load chat chunks for RAG context. Preserves `chunkIds` order; drops
 * missing rows and any chunk not owned by `userId`.
 */
export const getChatChunksByIdsInternal = internalQuery({
  args: {
    userId: v.id("users"),
    chunkIds: v.array(v.id("chatChunks")),
  },
  handler: async (ctx, args) => {
    const rows = await Promise.all(args.chunkIds.map((id) => ctx.db.get(id)));
    const byId = new Map(
      rows
        .filter((r): r is NonNullable<typeof r> => r !== null && r.userId === args.userId)
        .map((r) => [r._id, r]),
    );
    return args.chunkIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => r !== undefined);
  },
});
