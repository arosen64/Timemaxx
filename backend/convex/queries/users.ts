import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get the current logged-in user
export const getCurrUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    console.log("userId from getAuthUserId:", userId);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});