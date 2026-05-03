import { CalendarIcon, SpinnerIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import Button from "../ui/Button";
import { MAX_OFFSET_DAYS } from "./utils";

type Props = {
  days: Date[];
  weekOffset: number;
  isFetchingEvents: boolean;
  calendarConnected: boolean;
  hasCalendarIndicator: boolean;
  isExporting: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onExport: () => void;
  onOpenSelector: () => void;
};

export default function ScheduleHeader({
  days,
  weekOffset,
  isFetchingEvents,
  calendarConnected,
  hasCalendarIndicator,
  isExporting,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onExport,
  onOpenSelector,
}: Props) {
  return (
    <div className="flex items-center justify-between mb-4 rounded-xl bg-white border border-border px-4 py-3 lg:px-6 lg:py-4">
      <h1 className="font-heading text-lg font-bold text-navy lg:text-xl">Schedule</h1>

      <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
        <button
          type="button"
          onClick={onPrevWeek}
          disabled={weekOffset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeftIcon size={14} />
        </button>
        <span className="min-w-[130px] text-center font-body text-xs font-medium text-navy lg:min-w-[148px] lg:text-sm">
          {days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" – "}
          {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <button
          type="button"
          onClick={onNextWeek}
          disabled={weekOffset + 7 >= MAX_OFFSET_DAYS}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next week"
        >
          <ChevronRightIcon size={14} />
        </button>
        {weekOffset !== 0 && (
          <button
            type="button"
            onClick={onGoToToday}
            className="flex h-8 items-center justify-center rounded-lg border border-border bg-white px-2.5 font-heading text-xs font-semibold text-slate-blue transition hover:bg-bg-gray lg:px-3"
          >
            Today
          </button>
        )}
        {isFetchingEvents && <SpinnerIcon color="#4E6A8C" size={14} />}
      </div>

      <div className="flex items-center gap-2">
        {calendarConnected && (
          <Button
            variant="secondary"
            onClick={onExport}
            disabled={isExporting}
            icon={
              isExporting ? (
                <SpinnerIcon color="#4E6A8C" size={14} />
              ) : (
                <CalendarIcon color="#4E6A8C" size={14} />
              )
            }
            className="h-11 min-w-[44px] sm:h-9 sm:min-w-0 px-2 sm:px-3 text-xs lg:px-4 lg:text-sm"
            aria-label="Export to Google Calendar"
          >
            <span className="hidden sm:inline">
              {isExporting ? "Exporting…" : "Export to GCal"}
            </span>
          </Button>
        )}
        {calendarConnected && (
          <button
            type="button"
            onClick={onOpenSelector}
            className={`flex items-center gap-2 rounded-lg px-3 h-11 sm:h-9 min-w-[44px] sm:min-w-0 font-heading text-xs font-semibold text-white transition hover:opacity-90 lg:px-4 lg:text-sm ${hasCalendarIndicator ? "bg-info-bg text-navy" : "bg-navy"}`}
            aria-label="Select calendars"
          >
            <CalendarIcon color="#86C8BC" size={14} />
            <span className="hidden sm:inline">Calendars</span>
            {hasCalendarIndicator && (
              <span className="flex h-2 w-2 rounded-full bg-sky-blue" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
