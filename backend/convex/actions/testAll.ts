"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

export const testAll = action({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 Starting full system test...");

    const userId: Id<"users"> = await ctx.runMutation(api.mutations.users.createUser, {
      googleId: "test-google-id",
      email: "test@example.com",
      preferredWorkHours: [
        { startHour: 9, endHour: 12 },
        { startHour: 13, endHour: 17 },
      ],
      focusBlockLength: 60,
      onboardingComplete: false,
    });

    console.log("✅ User created:", userId);

    const user = await ctx.runQuery(
      api.queries.users.getUserByGoogleId,
      { googleId: "test-google-id" }
    );

    console.log("✅ User fetched:", user);

    const taskId: Id<"tasks"> = await ctx.runMutation(api.mutations.tasks.createTask, {
      userId,
      title: "Test Task",
      description: "Testing full workflow",
      taskType: "focus",
      timeEstimate: 90,
    });

    console.log("✅ Task created:", taskId);

    const tasks = await ctx.runQuery(
      api.queries.tasks.getTasksByUser,
      { userId }
    );

    console.log("✅ Tasks fetched:", tasks);

    await ctx.runMutation(api.mutations.tasks.updateTask, {
      taskId,
      title: "Updated Task Title",
    });

    console.log("✅ Task updated");

    await ctx.runMutation(api.mutations.tasks.deleteTask, {
      taskId,
    });

    console.log("✅ Task deleted");

    return {
      success: true,
      userId,
    };
  },
});