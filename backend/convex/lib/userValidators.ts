import { v } from "convex/values";
import { DAYS_OF_WEEK, YEARS } from "../../../shared/userEnums";

const [d0, d1, ...dRest] = DAYS_OF_WEEK.map((d) => v.literal(d));
export const dayOfWeekValidator = v.union(d0, d1, ...dRest);

const [y0, y1, ...yRest] = YEARS.map((y) => v.literal(y));
export const yearValidator = v.union(y0, y1, ...yRest);

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
