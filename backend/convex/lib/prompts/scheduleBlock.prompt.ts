import { z } from "zod";
import type { ScoreBreakdown } from "../scoreSlots";

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

export const batchSlotSelectionResponseSchema = z.object({
  selections: z
    .array(z.number().int().min(0))
    .describe("Array of chosen slot indices, one per block in the same order as the input"),
  overallSkipReason: z
    .string()
    .nullable()
    .describe(
      "A single ≤30-word user-facing sentence explaining why some blocks could not be scheduled, if any blocks have cannotSchedule: true. Null when all blocks have candidates."
    ),
});

export type BatchSlotSelectionResponse = z.infer<typeof batchSlotSelectionResponseSchema>;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export interface ScheduleBlockSlot {
  startMs: number;
  startISO: string;
  previousEventTitle: string | null;
  minutesSincePreviousEvent: number | null;
  nextEventTitle: string | null;
  minutesUntilNextEvent: number | null;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Batch prompt (one call for multiple blocks)
// ---------------------------------------------------------------------------

export interface BatchScheduleBlockEntry {
  taskTitle: string;
  dueDate: number;
  recommendedStart?: number;
  candidates: ScheduleBlockSlot[];
  cannotSchedule?: boolean;
}

export function buildBatchScheduleBlockPrompt(
  blocks: BatchScheduleBlockEntry[],
  productivityTraits: unknown
): string {
  const sections: string[] = [];

  if (productivityTraits) {
    sections.push(`<productivity_preferences>
${JSON.stringify(productivityTraits, null, 2)}
</productivity_preferences>`);
  }

  const blocksJson = blocks.map((b, bi) => ({
    blockIndex: bi,
    taskTitle: b.taskTitle,
    dueDate: new Date(b.dueDate).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    ...(b.recommendedStart !== undefined
      ? { doNotScheduleBefore: new Date(b.recommendedStart).toISOString() }
      : {}),
    ...(b.cannotSchedule
      ? { cannotSchedule: true, candidates: [] }
      : {
          candidates: b.candidates.map((s, si) => ({
            index: si,
            startTime: s.startISO,
            dayOfWeek: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
              new Date(s.startMs)
            ),
            ...(s.score !== undefined ? { score: s.score, scoreBreakdown: s.scoreBreakdown } : {}),
            previousEventTitle: s.previousEventTitle,
            minutesSincePreviousEvent: s.minutesSincePreviousEvent,
            nextEventTitle: s.nextEventTitle,
            minutesUntilNextEvent: s.minutesUntilNextEvent,
          })),
        }),
  }));

  sections.push(`<blocks>
${JSON.stringify(blocksJson, null, 2)}
</blocks>`);

  return `Select the best slot index for each study block. If any blocks have cannotSchedule: true, set overallSkipReason to a single ≤30-word user-facing sentence explaining why those blocks could not be scheduled. Otherwise set overallSkipReason to null.\n\n${sections.join("\n\n")}`;
}
