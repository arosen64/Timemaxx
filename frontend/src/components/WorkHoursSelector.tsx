import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { DAYS_OF_WEEK } from "../../../shared/userEnums";
import { WorkHoursData } from "../types";

const DAYS_FULL = DAYS_OF_WEEK;
const DAYS_SHORT = DAYS_FULL.map((d) => d.slice(0, 3));
const TOTAL_SLOTS = 48; // 30-min increments across 24 hours

type DragAction = "paint" | "erase";

function slotToLabel(slot: number): string {
  const hours = Math.floor(slot / 2);
  const ampm = hours < 12 ? "am" : "pm";
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}${ampm}`;
}

function initSlots(data: WorkHoursData) {
  return Object.fromEntries(
    DAYS_FULL.map((day) => [day, new Set<number>(data[day]?.blocked ?? [])])
  );
}

function slotsToData(slots: Record<string, Set<number>>): WorkHoursData {
  return Object.fromEntries(
    DAYS_FULL.map((day) => [day, { blocked: [...slots[day]].sort((a, b) => a - b) }])
  );
}

export const DEFAULT_WORK_HOURS: WorkHoursData = Object.fromEntries(
  DAYS_FULL.map((day) => [day, { blocked: [] }])
);

interface WorkHoursSelectorProps {
  data: WorkHoursData;
  onChange: (data: WorkHoursData) => void;
  readOnly?: boolean;
}

export default function WorkHoursSelector({
  data,
  onChange,
  readOnly = false,
}: WorkHoursSelectorProps) {
  const [slots, setSlots] = useState(() => initSlots(data));
  const dragRef = useRef<{ active: boolean; action: DragAction }>({
    active: false,
    action: "paint",
  });

  useEffect(() => {
    const handleMouseUp = () => {
      dragRef.current.active = false;
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const isOwnUpdate = useRef(false);

  useEffect(() => {
    if (isOwnUpdate.current) {
      isOwnUpdate.current = false;
      return;
    }
    setSlots(initSlots(data));
  }, [data]);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const applyToSlot = useCallback(
    (day: string, slot: number, action: DragAction) => {
      const prev = slotsRef.current;
      const blocked = new Set(prev[day]);
      if (action === "paint") blocked.add(slot);
      else blocked.delete(slot);
      const next = { ...prev, [day]: blocked };
      setSlots(next);
      isOwnUpdate.current = true;
      onChange(slotsToData(next));
    },
    [onChange]
  );

  const handleMouseDown = (day: string, slot: number) => {
    const action: DragAction = slots[day].has(slot) ? "erase" : "paint";
    dragRef.current = { active: true, action };
    applyToSlot(day, slot, action);
  };

  const handleMouseEnter = (day: string, slot: number) => {
    if (!dragRef.current.active) return;
    applyToSlot(day, slot, dragRef.current.action);
  };

  const getCellClass = (day: string, slot: number): string => {
    if (slots[day].has(slot))
      return readOnly ? "bg-slate-blue" : "bg-slate-blue hover:bg-slate-blue/80";
    return readOnly ? "bg-white" : "bg-white hover:bg-bg-gray";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {readOnly ? (
          <span className="flex items-center gap-1.5 font-body text-sm text-slate-blue">
            <span className="inline-block h-3 w-3 rounded-sm bg-slate-blue" /> Never work
          </span>
        ) : (
          <>
            <span className="font-body text-sm text-slate-blue">
              Click or drag to mark <span className="font-semibold text-navy">never-work</span>{" "}
              hours
            </span>
            <span className="ml-auto font-body text-xs text-light-blue">
              Click a painted cell to erase it
            </span>
          </>
        )}
      </div>

      {/* Mobile hint */}
      {!readOnly && (
        <p className="font-body text-xs text-light-blue sm:hidden">
          Best used on a larger screen — scroll horizontally to see all days.
        </p>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[480px] select-none overflow-hidden">
          {/* Sticky day header */}
          <div
            className="grid border-b border-border bg-bg-gray"
            style={{ gridTemplateColumns: "2.5rem repeat(7, 1fr)" }}
          >
            <div />
            {DAYS_SHORT.map((day) => (
              <div
                key={day}
                className="py-2 text-center font-body text-xs font-semibold text-slate-blue"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Slot rows */}
          <div>
            <div className="grid" style={{ gridTemplateColumns: "2.5rem repeat(7, 1fr)" }}>
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                <Fragment key={slot}>
                  {/* Time label every 2 hours */}
                  <div className="flex h-4 items-start justify-end pr-1.5 pt-px font-body text-[10px] leading-none text-light-blue">
                    {slot % 2 === 0 ? slotToLabel(slot) : ""}
                  </div>
                  {/* One cell per day */}
                  {DAYS_FULL.map((day) => (
                    <div
                      key={day}
                      className={`h-4 border-b border-r border-border/50 transition-colors ${
                        readOnly ? "cursor-default" : "cursor-crosshair"
                      } ${getCellClass(day, slot)}`}
                      onMouseDown={
                        readOnly
                          ? undefined
                          : (e) => {
                              e.preventDefault();
                              handleMouseDown(day, slot);
                            }
                      }
                      onMouseEnter={readOnly ? undefined : () => handleMouseEnter(day, slot)}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
