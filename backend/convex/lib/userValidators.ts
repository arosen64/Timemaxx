import { v } from "convex/values";

export const dayOfWeekValidator = v.union(
  v.literal("Monday"),
  v.literal("Tuesday"),
  v.literal("Wednesday"),
  v.literal("Thursday"),
  v.literal("Friday"),
  v.literal("Saturday"),
  v.literal("Sunday")
);

export const workHoursRowValidator = v.object({
  day: dayOfWeekValidator,
  blocked: v.array(v.number()),
});

export const productivityTraitsValidator = v.object({
  timeOfDay: v.optional(v.array(v.string())),
  dayOfWeek: v.optional(v.array(dayOfWeekValidator)),
  workSessionStyle: v.optional(v.array(v.string())),
  deadlineBehavior: v.optional(v.array(v.string())),
});
