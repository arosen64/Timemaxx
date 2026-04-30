import { useState, useEffect, useRef, useMemo } from "react";
import type { Id } from "../../../../backend/convex/_generated/dataModel";
import type { AllDayEvent } from "../../../../backend/convex/actions/fetchCalendarEvents";
import type { LayoutEvent } from "./overlapLayout";
import type { StudyBlockOnGrid } from "./TimeGrid";
import ScheduleBlockConflict from "./ScheduleBlockConflict";
import {
  TOTAL_SLOTS,
  SLOT_HEIGHT,
  DAYS_FULL,
  slotLabel,
  isoDateString,
  isToday,
  minutesFromMidnight,
  getTextColorClass,
} from "./utils";

type WorkHoursRow = { day: string; available: number[]; blocked: number[] };

function getSlotState(grid: WorkHoursRow[] | null, dayName: string, slot: number) {
  const row = grid?.find((r) => r.day === dayName);
  if (!row) return "none";
  if (row.available?.includes(slot)) return "preferred";
  if (row.blocked?.includes(slot)) return "unavailable";
  return "none";
}

function slotBgClass(
  state: "preferred" | "unavailable" | "none",
  isHighlighted: boolean,
  isAssignMode: boolean
) {
  if (isHighlighted) return "bg-teal/60 cursor-pointer hover:bg-teal/80";
  if (state === "preferred") return isAssignMode ? "bg-teal/20" : "bg-teal/40";
  if (state === "unavailable") return "bg-slate-blue";
  return "bg-white";
}

interface MobileDayViewProps {
  days: Date[];
  workHoursGrid: WorkHoursRow[] | null;
  studyBlocksByDay: Record<string, StudyBlockOnGrid[]>;
  allDayEventsByDay: Record<string, AllDayEvent[]>;
  layoutByDay: Record<string, LayoutEvent[]>;
  highlightedSlots: Set<string>;
  isAssignMode: boolean;
  calendarConnected: boolean;
  /** Called when navigating before the first day of the current week window */
  onPrevBoundary: () => void;
  /** Called when navigating after the last day of the current week window */
  onNextBoundary: () => void;
  onSlotClick: (dateStr: string, slot: number) => void;
  onMoveBlock: (studyBlockId: Id<"studyBlocks">) => void;
  onAutoReschedule: () => void;
  gridRef: React.RefObject<HTMLDivElement>;
}

export default function MobileDayView({
  days,
  workHoursGrid,
  studyBlocksByDay,
  allDayEventsByDay,
  layoutByDay,
  highlightedSlots,
  isAssignMode,
  calendarConnected,
  onPrevBoundary,
  onNextBoundary,
  onSlotClick,
  onMoveBlock,
  onAutoReschedule,
  gridRef,
}: MobileDayViewProps) {
  const todayIndex = days.findIndex((d) => isToday(d));
  const [dayIndex, setDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (minutesFromMidnight(new Date()) / 30) * SLOT_HEIGHT - 120);
  }, []);

  // Keep gridRef in sync so ScheduleTab's scroll-to-now effect also works
  useEffect(() => {
    if (gridRef && "current" in gridRef) {
      (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = scrollRef.current;
    }
  }, [gridRef]);

  const activeDay = days[dayIndex];
  const dateStr = isoDateString(activeDay);
  const jsDay = activeDay.getDay();
  const dayName = DAYS_FULL[jsDay === 0 ? 6 : jsDay - 1];
  const isTodayActive = isToday(activeDay);
  const nowTopPx = isTodayActive ? (minutesFromMidnight(now) / 30) * SLOT_HEIGHT : null;

  const allDayEvents = allDayEventsByDay[dateStr] ?? [];
  const studyBlocks = studyBlocksByDay[dateStr] ?? [];
  const layout = layoutByDay[dateStr] ?? [];

  const hasHighlightedSlotsToday = useMemo(() => {
    if (!isAssignMode) return false;
    for (let s = 0; s < TOTAL_SLOTS; s++) {
      if (highlightedSlots.has(`${dateStr}:${s}`)) return true;
    }
    return false;
  }, [isAssignMode, dateStr, highlightedSlots]);

  function handlePrev() {
    if (dayIndex > 0) {
      setDayIndex(dayIndex - 1);
    } else {
      onPrevBoundary();
      setDayIndex(6);
    }
  }

  function handleNext() {
    if (dayIndex < days.length - 1) {
      setDayIndex(dayIndex + 1);
    } else {
      onNextBoundary();
      setDayIndex(0);
    }
  }

  const dateLabel = activeDay.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border bg-white overflow-hidden">
      {/* Nav header */}
      <div className="flex items-center justify-between px-3 h-12 shrink-0 border-b border-border bg-white">
        <button
          type="button"
          onClick={handlePrev}
          className="flex items-center justify-center w-8 h-8 rounded-md text-navy hover:bg-bg-gray transition"
          aria-label="Previous day"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span
          className={`font-heading text-[15px] font-bold ${isTodayActive ? "text-navy" : "text-slate-blue"}`}
        >
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center justify-center w-8 h-8 rounded-md text-navy hover:bg-bg-gray transition"
          aria-label="Next day"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* No-slots nudge — shown when assign mode is active but this day has nothing available */}
      {isAssignMode && !hasHighlightedSlotsToday && (
        <div className="flex items-center gap-2 border-b border-teal/30 bg-teal/10 px-3 py-2 font-body text-[11px] text-navy">
          <span>No available slots today — use</span>
          <span className="font-semibold">← →</span>
          <span>to find an open time.</span>
        </div>
      )}

      {/* All-day row */}
      {calendarConnected && (
        <div
          className="flex shrink-0 border-b border-border bg-bg-gray/50"
          style={{ minHeight: 28 }}
        >
          <div className="flex items-center justify-end pr-1.5 shrink-0" style={{ width: 48 }}>
            <span className="font-body text-[9px] leading-none text-light-blue">all-day</span>
          </div>
          <div className="flex flex-1 flex-wrap gap-1 border-l border-border px-1 py-1">
            {allDayEvents.map((e) => (
              <span
                key={e.id}
                title={e.summary}
                className="inline-block max-w-full truncate rounded bg-info-bg px-1.5 py-0.5 font-body text-[10px] font-medium text-info-emphasis"
              >
                {e.summary}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}>
          {/* Slot rows */}
          {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
            const state = getSlotState(workHoursGrid, dayName, slot);
            const slotKey = `${dateStr}:${slot}`;
            const isHighlighted = highlightedSlots.has(slotKey);
            return (
              <div
                key={slot}
                className="absolute flex w-full"
                style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              >
                <div
                  className="flex shrink-0 items-start justify-end border-b border-border/50 bg-white pr-1.5 pt-px font-body text-[10px] leading-none text-light-blue"
                  style={{ width: 48, height: SLOT_HEIGHT }}
                >
                  {slotLabel(slot)}
                </div>
                <div
                  className={`flex-1 border-b border-l border-border/50 ${slotBgClass(state, isHighlighted, isAssignMode)}`}
                  style={{ height: SLOT_HEIGHT }}
                  onClick={isHighlighted ? () => onSlotClick(dateStr, slot) : undefined}
                />
              </div>
            );
          })}

          {/* Timed calendar event overlays */}
          {layout.map(({ event, left, width }) => {
            const startDt = new Date(event.start);
            const endDt = new Date(event.end);
            const durationMin = Math.max(15, (endDt.getTime() - startDt.getTime()) / 60000);
            const topPx = (minutesFromMidnight(startDt) / 30) * SLOT_HEIGHT;
            const heightPx = (durationMin / 30) * SLOT_HEIGHT;
            return (
              <div
                key={event.id}
                className="absolute overflow-hidden rounded border-l-2 border-sky-blue bg-info-bg px-1 py-0.5"
                style={{
                  top: topPx,
                  height: Math.max(heightPx, SLOT_HEIGHT),
                  left: `calc(48px + (100% - 48px) * ${left})`,
                  width: `calc((100% - 48px) * ${width} - 2px)`,
                }}
                title={event.summary}
              >
                <span className="block truncate font-body text-[10px] font-semibold leading-tight text-info-emphasis">
                  {event.summary}
                </span>
                <span className="block font-body text-[9px] text-sky-blue">
                  {new Date(event.start).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}

          {/* Current time indicator */}
          {nowTopPx !== null && (
            <>
              <div
                className="pointer-events-none absolute z-20 h-2.5 w-2.5 rounded-full bg-urgent-red"
                style={{ top: nowTopPx - 5, left: 43 }}
              />
              <div
                className="pointer-events-none absolute z-20 bg-urgent-red"
                style={{ top: nowTopPx - 1, height: 2, left: 48, right: 0 }}
              />
            </>
          )}

          {/* Study block overlays */}
          {studyBlocks.map((block) => {
            const startDt = new Date(block.startTime);
            const topPx = (minutesFromMidnight(startDt) / 30) * SLOT_HEIGHT;
            const heightPx = Math.max((block.studyBlockLength / 30) * SLOT_HEIGHT, SLOT_HEIGHT);
            const isConflicted = block.isConflicted ?? false;
            const compactBlock = heightPx <= SLOT_HEIGHT;
            return (
              <div
                key={block._id}
                className="group absolute"
                style={{ top: topPx, height: heightPx, left: 48, right: 2, zIndex: 5 }}
                draggable={false}
              >
                {block.courseName && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy px-2 py-1 font-body text-[10px] text-white shadow-md group-hover:block">
                    {block.courseName}
                  </div>
                )}
                {isConflicted ? (
                  <ScheduleBlockConflict
                    title={block.title}
                    studyBlockId={block._id}
                    startTime={block.startTime}
                    studyBlockLength={block.studyBlockLength}
                    onMove={onMoveBlock}
                    onAutoReschedule={onAutoReschedule}
                  />
                ) : (
                  <div
                    className={`flex h-full min-h-0 flex-col justify-start overflow-hidden rounded px-2 ${
                      compactBlock ? "gap-0 py-0.5" : "gap-0.5 py-1.5"
                    } ${block.courseColor ? "" : "bg-navy"}`}
                    style={block.courseColor ? { backgroundColor: block.courseColor } : undefined}
                  >
                    <span
                      className={`block min-w-0 shrink-0 truncate font-heading text-[11px] font-semibold leading-tight ${block.courseColor ? getTextColorClass(block.courseColor) : "text-white"}`}
                    >
                      {block.title}
                    </span>
                    <span className="block min-w-0 shrink-0 truncate font-body text-[9px] leading-tight text-sky-blue">
                      {startDt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{" "}
                      · {block.studyBlockLength} min
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
