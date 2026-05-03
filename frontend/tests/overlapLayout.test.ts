import { computeOverlapLayout } from "../src/components/schedule/overlapLayout";
import type { TimedEvent } from "../../backend/convex/functions/fetchCalendarEvents";

function makeEvent(start: string, end: string, id = `${start}-${end}`): TimedEvent {
  return {
    id,
    summary: id,
    start,
    end,
  } as TimedEvent;
}

describe("computeOverlapLayout", () => {
  it("returns an empty array when given no events", () => {
    expect(computeOverlapLayout([])).toEqual([]);
  });

  it("gives a single event the full column width", () => {
    const ev = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z");
    const layout = computeOverlapLayout([ev]);
    expect(layout).toHaveLength(1);
    expect(layout[0]).toMatchObject({ left: 0, width: 1 });
    expect(layout[0].event).toBe(ev);
  });

  it("places non-overlapping events at full width", () => {
    const a = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z", "a");
    const b = makeEvent("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", "b");
    const layout = computeOverlapLayout([a, b]);
    expect(layout.map((l) => l.width)).toEqual([1, 1]);
    expect(layout.map((l) => l.left)).toEqual([0, 0]);
  });

  it("splits two overlapping events evenly side by side", () => {
    const a = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T10:30:00Z", "a");
    const b = makeEvent("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", "b");
    const layout = computeOverlapLayout([a, b]);
    expect(layout).toHaveLength(2);
    expect(layout.map((l) => l.width)).toEqual([0.5, 0.5]);
    expect(layout.map((l) => l.left)).toEqual([0, 0.5]);
  });

  it("splits three mutually overlapping events into thirds", () => {
    const a = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T11:00:00Z", "a");
    const b = makeEvent("2026-01-01T09:30:00Z", "2026-01-01T10:30:00Z", "b");
    const c = makeEvent("2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z", "c");
    const layout = computeOverlapLayout([a, b, c]);
    expect(layout.map((l) => l.width)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(layout.map((l) => l.left)).toEqual([0, 1 / 3, 2 / 3]);
  });

  it("sorts events by start time before laying out", () => {
    const later = makeEvent("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", "later");
    const earlier = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T09:30:00Z", "earlier");
    const layout = computeOverlapLayout([later, earlier]);
    expect(layout[0].event.id).toBe("earlier");
    expect(layout[1].event.id).toBe("later");
  });

  it("treats touching boundaries as non-overlapping", () => {
    const a = makeEvent("2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z", "a");
    const b = makeEvent("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", "b");
    const layout = computeOverlapLayout([a, b]);
    expect(layout.every((l) => l.width === 1)).toBe(true);
  });
});
