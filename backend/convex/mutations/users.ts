
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const updateOnboarding = mutation({
  args: {
    preferredWorkHours: v.array(
      v.object({
        startHour: v.number(),
        endHour: v.number(),
      })
    ),
    focusBlockLength: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated: must be logged in to complete onboarding");

    if (args.preferredWorkHours.length === 0)
      throw new Error("preferredWorkHours must have at least one block");

    for (const [i, block] of args.preferredWorkHours.entries()) {
      if (!Number.isInteger(block.startHour) || block.startHour < 0 || block.startHour > 23)
        throw new Error(`preferredWorkHours[${i}].startHour "${block.startHour}" must be an integer between 0 and 23`);
      if (!Number.isInteger(block.endHour) || block.endHour < 0 || block.endHour > 23)
        throw new Error(`preferredWorkHours[${i}].endHour "${block.endHour}" must be an integer between 0 and 23`);
      if (block.startHour >= block.endHour)
        throw new Error(`preferredWorkHours[${i}]: startHour (${block.startHour}) must be before endHour (${block.endHour})`);
    }

    if (!Number.isInteger(args.focusBlockLength))
      throw new Error(`focusBlockLength "${args.focusBlockLength}" must be a whole number of minutes`);
    if (args.focusBlockLength == 0)
      throw new Error(`focusBlockLength "${args.focusBlockLength}" must be greater than 0`);

    await ctx.db.patch(userId, {
      ...args,
      onboardingComplete: true,  // ← always set on success
    });
  },
});