import type { CalendarEntry } from "../../../../backend/convex/functions/fetchCalendarEvents";
import { XIcon } from "../icons";

interface CalendarSelectorPopupProps {
  calendars: CalendarEntry[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export default function CalendarSelectorPopup({
  calendars,
  selectedIds,
  onToggle,
  onClose,
}: CalendarSelectorPopupProps) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Floating panel — top-right, below the header */}
      <div
        className="absolute right-10 top-[72px] w-72 rounded-xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-heading text-sm font-semibold text-navy">Select Calendars</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-blue hover:bg-bg-gray"
            aria-label="Close calendar selector"
          >
            <XIcon size={12} color="currentColor" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {calendars.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-blue">No calendars found.</p>
          ) : (
            calendars.map((cal) => (
              <label
                key={cal.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-bg-gray"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(cal.id)}
                  onChange={() => onToggle(cal.id)}
                  className="h-4 w-4 accent-sky-blue"
                />
                <span className="truncate text-sm text-navy">{cal.summary}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
