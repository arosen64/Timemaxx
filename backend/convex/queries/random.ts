import { query } from "../_generated/server";

export const listRandoms = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("randoms").order("desc").take(20);
  },
});