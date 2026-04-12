import { CalendarIcon, SpinnerIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons'
import Button from '../ui/Button'
import { MAX_OFFSET_DAYS } from './utils'

type Props = {
  days: Date[]
  weekOffset: number
  isFetchingEvents: boolean
  calendarConnected: boolean
  hasCalendarIndicator: boolean
  isExporting: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
  onExport: () => void
  onOpenSelector: () => void
}

export default function ScheduleHeader({
  days,
  weekOffset,
  isFetchingEvents,
  calendarConnected,
  hasCalendarIndicator,
  isExporting,
  onPrevWeek,
  onNextWeek,
  onExport,
  onOpenSelector,
}: Props) {
  return (
    <div className="flex items-center justify-between mb-4 rounded-xl bg-white border border-border px-6 py-4">
      <h1 className="font-heading text-xl font-bold text-navy">Schedule</h1>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevWeek}
          disabled={weekOffset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeftIcon size={14} />
        </button>
        <span className="min-w-[148px] text-center font-body text-sm font-medium text-navy">
          {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
        {isFetchingEvents && <SpinnerIcon color="#4E6A8C" size={14} />}
      </div>

      <div className="flex items-center gap-2">
        {calendarConnected && (
          <Button
            variant="secondary"
            onClick={onExport}
            disabled={isExporting}
            icon={isExporting ? <SpinnerIcon color="#4E6A8C" size={14} /> : <CalendarIcon color="#4E6A8C" size={14} />}
            className="h-9 px-4 text-sm"
          >
            {isExporting ? 'Exporting…' : 'Export to GCal'}
          </Button>
        )}
        {calendarConnected ? (
          <button
            type="button"
            onClick={onOpenSelector}
            className={`flex items-center gap-2 rounded-lg px-4 h-9 font-heading text-sm font-semibold text-white transition hover:opacity-90 ${hasCalendarIndicator ? 'bg-info-bg text-navy' : 'bg-navy'}`}
            aria-label="Select calendars"
          >
            <CalendarIcon color="#86C8BC" size={14} />
            Calendars
            {hasCalendarIndicator && (
              <span className="flex h-2 w-2 rounded-full bg-sky-blue" aria-hidden="true" />
            )}
          </button>
        ) : (
          <div className="w-[110px]" />
        )}
      </div>
    </div>
  )
}
