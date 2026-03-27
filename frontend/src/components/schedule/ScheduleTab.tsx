import { useRef, useEffect, useState, useMemo } from 'react'
import { useQuery, useAction, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { CalendarEntry, TimedEvent, AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import { CalendarIcon, SpinnerIcon, WarningIcon } from '../icons'
import TimeGrid from './TimeGrid'
import CalendarSelectorPopup from './CalendarSelectorPopup'
import { computeOverlapLayout } from './overlapLayout'
import { offsetDate, isoDateString, minutesFromMidnight, SLOT_HEIGHT, MAX_OFFSET_DAYS } from './utils'

type WorkHoursRow = { day: string; available: number[]; blocked: number[] }

type CalendarData = {
  calendarList: CalendarEntry[]
  timedEvents: TimedEvent[]
  allDayEvents: AllDayEvent[]
  error: boolean
}

export default function ScheduleTab() {
  const scheduleData = useQuery(api.queries.calendar.getScheduleData)
  const saveSelectedCalendarsMutation = useMutation(api.mutations.calendar.saveSelectedCalendars)
  const fetchCalendarEventsAction = useAction(api.actions.fetchCalendarEvents.fetchCalendarEvents)

  const [weekOffset, setWeekOffset] = useState(0)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [isFetchingEvents, setIsFetchingEvents] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => offsetDate(weekOffset + i)),
    [weekOffset]
  )
  const startDateStr = useMemo(() => isoDateString(days[0]), [days])
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const calendarConnected = scheduleData?.calendarConnected ?? false
  const workHoursGrid = (scheduleData?.workHoursGrid ?? null) as WorkHoursRow[] | null
  const selectedCalendarIds = scheduleData?.selectedCalendarIds ?? null

  // Fetch calendar events when tab mounts or the week changes
  useEffect(() => {
    if (!calendarConnected) return
    let cancelled = false
    setIsFetchingEvents(true)
    fetchCalendarEventsAction({ startDate: startDateStr, timezone })
      .then((data) => { if (!cancelled) setCalendarData(data) })
      .catch(() => {
        if (!cancelled) setCalendarData({ calendarList: [], timedEvents: [], allDayEvents: [], error: true })
      })
      .finally(() => { if (!cancelled) setIsFetchingEvents(false) })
    return () => { cancelled = true }
  }, [calendarConnected, startDateStr, timezone, fetchCalendarEventsAction])

  // Scroll to current time on first render
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    el.scrollTop = Math.max(0, (minutesFromMidnight(new Date()) / 30) * SLOT_HEIGHT - 120)
  }, [])

  const timedEventsByDay = useMemo(() => {
    const map: Record<string, TimedEvent[]> = {}
    for (const e of calendarData?.timedEvents ?? []) {
      ;(map[e.start.slice(0, 10)] ??= []).push(e)
    }
    return map
  }, [calendarData])

  const allDayEventsByDay = useMemo(() => {
    const map: Record<string, AllDayEvent[]> = {}
    for (const e of calendarData?.allDayEvents ?? []) {
      ;(map[e.date] ??= []).push(e)
    }
    return map
  }, [calendarData])

  const layoutByDay = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeOverlapLayout>> = {}
    for (const day of days) {
      const key = isoDateString(day)
      result[key] = computeOverlapLayout(timedEventsByDay[key] ?? [])
    }
    return result
  }, [days, timedEventsByDay])

  async function handleToggleCalendar(calId: string) {
    const current = selectedCalendarIds ?? []
    const next = current.includes(calId) ? current.filter((id) => id !== calId) : [...current, calId]
    await saveSelectedCalendarsMutation({ selectedCalendarIds: next })
    const data = await fetchCalendarEventsAction({ startDate: startDateStr, timezone })
    setCalendarData(data)
  }

  const hasIndicator = calendarConnected && (!selectedCalendarIds || selectedCalendarIds.length === 0)

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">

      {/* Week navigation + calendar selector button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 7)}
            disabled={weekOffset === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="min-w-[130px] text-center font-heading text-sm font-semibold text-navy">
            {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 7)}
            disabled={weekOffset + 7 >= MAX_OFFSET_DAYS}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next week"
          >
            ›
          </button>
          {isFetchingEvents && <SpinnerIcon color="#4E6A8C" size={14} />}
        </div>

        {/* Hidden when no calendar is connected (task 5.9) */}
        {calendarConnected && (
          <button
            type="button"
            onClick={() => setSelectorOpen((o) => !o)}
            className={`relative flex items-center gap-2 rounded-lg border px-3 h-8 font-heading text-sm font-semibold transition ${
              hasIndicator
                ? 'border-sky-blue bg-info-bg text-info-emphasis'
                : 'border-border bg-white text-slate-blue hover:bg-bg-gray'
            }`}
            aria-label="Select calendars"
          >
            <CalendarIcon color="currentColor" size={14} />
            Calendars
            {hasIndicator && (
              <span className="flex h-2 w-2 rounded-full bg-sky-blue" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {calendarData?.error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-urgent-red-light bg-urgent-red-light px-4 py-2 text-sm text-urgent-red">
          <WarningIcon size={14} color="#CF4520" />
          Calendar events unavailable — showing work hours only.
        </div>
      )}

      <TimeGrid
        days={days}
        workHoursGrid={workHoursGrid}
        layoutByDay={layoutByDay}
        allDayEventsByDay={allDayEventsByDay}
        calendarConnected={calendarConnected}
        gridRef={gridRef}
      />

      {selectorOpen && (
        <CalendarSelectorPopup
          calendars={calendarData?.calendarList ?? []}
          selectedIds={selectedCalendarIds ?? []}
          onToggle={handleToggleCalendar}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </div>
  )
}
