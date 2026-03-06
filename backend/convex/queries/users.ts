import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get the current logged-in user
export const getCurrUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Check if the current user has completed onboarding
export const isOnboardingComplete = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return user.onboardingComplete === true;
  },
});