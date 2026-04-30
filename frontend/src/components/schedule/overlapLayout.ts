import type { TimedEvent } from "../../../../backend/convex/actions/fetchCalendarEvents";

export interface LayoutEvent {
  event: TimedEvent;
  left: number; // fraction 0–1 within the day column
  width: number; // fraction 0–1
}

/**
 * Assigns fractional left/width to each event so overlapping events sit
 * side-by-side (Google Calendar style).
 */
export function computeOverlapLayout(events: TimedEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  const result: LayoutEvent[] = sorted.map((e) => ({ event: e, left: 0, width: 1 }));
  const groups: number[][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const si = new Date(sorted[i].start).getTime();
    const ei = new Date(sorted[i].end).getTime();
    let placed = false;
    for (const group of groups) {
      if (
        group.some((j) => {
          const sj = new Date(sorted[j].start).getTime();
          const ej = new Date(sorted[j].end).getTime();
          return si < ej && ei > sj;
        })
      ) {
        group.push(i);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([i]);
  }

  for (const group of groups) {
    const n = group.length;
    group.forEach((idx, pos) => {
      result[idx].width = 1 / n;
      result[idx].left = pos / n;
    });
  }
  return result;
}
