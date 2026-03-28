import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useAction, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import type { CalendarEntry, TimedEvent, AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import { CalendarIcon, SpinnerIcon, WarningIcon } from '../icons'
import TimeGrid, { type StudyBlockOnGrid } from './TimeGrid'
import CalendarSelectorPopup from './CalendarSelectorPopup'
import { computeOverlapLayout } from './overlapLayout'
import { offsetDate, isoDateString, minutesFromMidnight, SLOT_HEIGHT, MAX_OFFSET_DAYS, DAYS_FULL } from './utils'

type WorkHoursRow = { day: string; available: number[]; blocked: number[] }

type CalendarData = {
  calendarList: CalendarEntry[]
  timedEvents: TimedEvent[]
  allDayEvents: AllDayEvent[]
  error: boolean
}

type StudyBlockWithTask = {
  _id: Id<'studyBlocks'>
  taskId: Id<'tasks'>
  title: string
  startTime: string | undefined
  studyBlockLength: number
  isConflicted: boolean | undefined
  taskTitle: string
  taskDueDate: number
}

export default function ScheduleTab() {
  const scheduleData = useQuery(api.queries.calendar.getScheduleData)
  const allStudyBlocks = useQuery(api.queries.studyBlocks.getAllStudyBlocksWithTasks) as StudyBlockWithTask[] | undefined
  const saveSelectedCalendarsMutation = useMutation(api.mutations.calendar.saveSelectedCalendars)
  const editStudyBlockTimeMutation = useMutation(api.mutations.studyBlocks.editStudyBlockTime)
  const runDetectConflictsMutation = useMutation(api.mutations.studyBlocks.runDetectConflicts)
  const autoRescheduleAction = useAction(api.actions.autoRescheduleConflicts.autoRescheduleConflicts)
  const fetchCalendarEventsAction = useAction(api.actions.fetchCalendarEvents.fetchCalendarEvents)

  const [weekOffset, setWeekOffset] = useState(0)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [isFetchingEvents, setIsFetchingEvents] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [assigningBlockId, setAssigningBlockId] = useState<Id<'studyBlocks'> | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<Id<'studyBlocks'> | null>(null)
  const [autoRescheduleMsg, setAutoRescheduleMsg] = useState<string | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)

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

  // Fetch calendar events when tab mounts or week changes
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

  // Trigger conflict detection when tab mounts and we have events + study blocks
  useEffect(() => {
    if (allStudyBlocks === undefined) return
    const hasScheduledBlocks = allStudyBlocks.some((b) => b.startTime)
    if (!hasScheduledBlocks) return

    runDetectConflictsMutation({
      timedEvents: calendarData?.timedEvents ?? [],
      workHoursGrid: workHoursGrid ?? [],
      timezone,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarData?.timedEvents, workHoursGrid])

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

  // Split study blocks into scheduled (on grid) and unscheduled (in tray)
  const { scheduledBlocks, unscheduledBlocks } = useMemo(() => {
    const scheduled: StudyBlockOnGrid[] = []
    const unscheduled: StudyBlockWithTask[] = []
    for (const b of allStudyBlocks ?? []) {
      if (b.startTime) scheduled.push(b as StudyBlockOnGrid)
      else unscheduled.push(b)
    }
    // Sort unscheduled by task due date ascending, then by block id (creation order)
    unscheduled.sort((a, b) => {
      if (a.taskDueDate !== b.taskDueDate) return a.taskDueDate - b.taskDueDate
      return a._id < b._id ? -1 : 1
    })
    return { scheduledBlocks: scheduled, unscheduledBlocks: unscheduled }
  }, [allStudyBlocks])

  // Build studyBlocksByDay for the grid
  const studyBlocksByDay = useMemo(() => {
    const map: Record<string, StudyBlockOnGrid[]> = {}
    for (const b of scheduledBlocks) {
      const dateStr = b.startTime.slice(0, 10)
      ;(map[dateStr] ??= []).push(b)
    }
    return map
  }, [scheduledBlocks])

  // Compute highlighted (eligible) slots for assign mode
  const highlightedSlots = useMemo((): Set<string> => {
    if (!assigningBlockId && !draggingBlockId) return new Set()

    const activeId = assigningBlockId ?? draggingBlockId
    const block = allStudyBlocks?.find((b) => b._id === activeId)
    if (!block) return new Set()

    const slots = new Set<string>()
    const timedEvents = calendarData?.timedEvents ?? []

    // Generate all 21 days from today
    for (let offset = 0; offset < MAX_OFFSET_DAYS; offset++) {
      const date = offsetDate(offset)
      const dateStr = isoDateString(date)
      const jsDay = date.getDay()
      const dayName = DAYS_FULL[jsDay === 0 ? 6 : jsDay - 1]
      const row = workHoursGrid?.find((r) => r.day === dayName)

      // Events for this day
      const dayEventSlots = new Set<number>()
      for (const e of timedEvents) {
        if (!e.start.startsWith(dateStr)) continue
        const startMins = minutesFromMidnight(new Date(e.start))
        const endMins = minutesFromMidnight(new Date(e.end))
        const startSlot = Math.floor(startMins / 30)
        const endSlot = Math.ceil(endMins / 30)
        for (let s = startSlot; s < endSlot; s++) dayEventSlots.add(s)
      }

      // Study blocks already on this day
      const dayBlockSlots = new Set<number>()
      for (const sb of studyBlocksByDay[dateStr] ?? []) {
        if (sb._id === activeId) continue
        const startMins = minutesFromMidnight(new Date(sb.startTime))
        const blockSlots = Math.ceil(sb.studyBlockLength / 30)
        const startSlot = Math.floor(startMins / 30)
        for (let s = startSlot; s < startSlot + blockSlots; s++) dayBlockSlots.add(s)
      }

      // How many consecutive slots the block needs
      const neededSlots = Math.ceil(block.studyBlockLength / 30)

      for (let slot = 0; slot <= 48 - neededSlots; slot++) {
        // Must not be unavailable (blocked)
        if (row?.blocked.includes(slot)) continue

        // Must not overlap any event or other block
        let conflict = false
        for (let s = slot; s < slot + neededSlots; s++) {
          if (dayEventSlots.has(s) || dayBlockSlots.has(s)) { conflict = true; break }
        }
        if (conflict) continue

        // Must be before task due date
        const slotStartMs = date.getTime() + slot * 30 * 60 * 1000
        if (slotStartMs >= block.taskDueDate) continue

        slots.add(`${dateStr}:${slot}`)
      }
    }

    return slots
  }, [assigningBlockId, draggingBlockId, allStudyBlocks, calendarData, workHoursGrid, studyBlocksByDay])

  // Cancel assign mode on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAssigningBlockId(null)
        setDraggingBlockId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSlotClick = useCallback(async (dateStr: string, slot: number) => {
    if (!assigningBlockId) return
    const slotStartMs = new Date(`${dateStr}T00:00:00`).getTime() + slot * 30 * 60 * 1000
    const isoStart = new Date(slotStartMs).toISOString()
    await editStudyBlockTimeMutation({ studyBlockId: assigningBlockId, startTime: isoStart })
    setAssigningBlockId(null)
  }, [assigningBlockId, editStudyBlockTimeMutation])

  const handleDrop = useCallback(async (dateStr: string, slot: number) => {
    if (!draggingBlockId) return
    const slotStartMs = new Date(`${dateStr}T00:00:00`).getTime() + slot * 30 * 60 * 1000
    const isoStart = new Date(slotStartMs).toISOString()
    await editStudyBlockTimeMutation({ studyBlockId: draggingBlockId, startTime: isoStart })
    setDraggingBlockId(null)
  }, [draggingBlockId, editStudyBlockTimeMutation])

  const handleMoveBlock = useCallback((studyBlockId: Id<'studyBlocks'>) => {
    setAssigningBlockId(null)
    setDraggingBlockId(studyBlockId)
  }, [])

  const handleAutoReschedule = useCallback(async () => {
    setIsRescheduling(true)
    setAutoRescheduleMsg(null)
    try {
      const result = await autoRescheduleAction({ timezone })
      if (result.unplacedCount > 0) {
        setAutoRescheduleMsg(
          `${result.unplacedCount} block${result.unplacedCount !== 1 ? 's' : ''} could not be placed and moved to the tray.`
        )
      } else {
        setAutoRescheduleMsg('All conflicts resolved.')
      }
    } catch {
      setAutoRescheduleMsg('Auto-reschedule failed. Please try again.')
    } finally {
      setIsRescheduling(false)
    }
  }, [autoRescheduleAction, timezone])

  async function handleToggleCalendar(calId: string) {
    const current = selectedCalendarIds ?? []
    const next = current.includes(calId) ? current.filter((id) => id !== calId) : [...current, calId]
    await saveSelectedCalendarsMutation({ selectedCalendarIds: next })
    const data = await fetchCalendarEventsAction({ startDate: startDateStr, timezone })
    setCalendarData(data)
    // 3.4: Trigger conflict detection after selectedCalendarIds changes
    await runDetectConflictsMutation({
      timedEvents: data.timedEvents,
      workHoursGrid: workHoursGrid ?? [],
      timezone,
    }).catch(() => {})
  }

  const hasIndicator = calendarConnected && (!selectedCalendarIds || selectedCalendarIds.length === 0)

  return (
    <div
      className="flex flex-col flex-1 min-h-0 min-w-0"
      onClick={(e) => {
        // Cancel assign mode when clicking outside the grid area
        const target = e.target as HTMLElement
        if (assigningBlockId && !target.closest('[data-grid]') && !target.closest('[data-tray]')) {
          setAssigningBlockId(null)
        }
      }}
    >
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

      {autoRescheduleMsg && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-gray px-4 py-2 text-sm text-slate-blue">
          <span>{autoRescheduleMsg}</span>
          <button
            type="button"
            onClick={() => setAutoRescheduleMsg(null)}
            className="text-light-blue hover:text-slate-blue"
          >
            ✕
          </button>
        </div>
      )}

      {assigningBlockId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-teal bg-teal/10 px-4 py-2 text-sm text-navy">
          <span className="font-semibold font-heading">Assign mode</span>
          <span className="text-slate-blue">Click a highlighted slot to assign. Press Esc to cancel.</span>
        </div>
      )}

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Main grid */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0" data-grid>
          <TimeGrid
            days={days}
            workHoursGrid={workHoursGrid}
            layoutByDay={layoutByDay}
            allDayEventsByDay={allDayEventsByDay}
            calendarConnected={calendarConnected}
            gridRef={gridRef}
            studyBlocksByDay={studyBlocksByDay}
            highlightedSlots={highlightedSlots}
            isAssignMode={assigningBlockId !== null || draggingBlockId !== null}
            onSlotClick={handleSlotClick}
            onMoveBlock={handleMoveBlock}
            onAutoReschedule={handleAutoReschedule}
            draggingBlockId={draggingBlockId}
            onDragStart={setDraggingBlockId}
            onDrop={handleDrop}
          />
        </div>

        {/* Unscheduled block tray */}
        <aside
          className="flex w-[180px] shrink-0 flex-col gap-2 overflow-y-auto"
          data-tray
        >
          <h3 className="font-heading text-xs font-semibold text-navy">Unscheduled</h3>

          {isRescheduling && (
            <div className="flex items-center gap-2 text-xs text-slate-blue">
              <SpinnerIcon color="#4E6A8C" size={12} />
              Rescheduling…
            </div>
          )}

          {unscheduledBlocks.length === 0 ? (
            <div className="rounded-lg border border-border bg-white px-3 py-3 text-[11px] text-light-blue">
              All blocks scheduled.
            </div>
          ) : (
            unscheduledBlocks.map((block) => {
              const isSelected = assigningBlockId === block._id
              return (
                <button
                  key={block._id}
                  type="button"
                  onClick={() =>
                    setAssigningBlockId((prev) => (prev === block._id ? null : block._id))
                  }
                  className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'border-teal bg-teal/10 shadow-sm'
                      : 'border-border bg-white hover:border-teal/50 hover:bg-teal/5'
                  }`}
                >
                  <span className="block truncate font-heading text-[11px] font-semibold text-navy">
                    {block.title}
                  </span>
                  <span className="text-[10px] text-slate-blue">{block.studyBlockLength} min</span>
                  <span className="text-[10px] text-light-blue truncate">{block.taskTitle}</span>
                </button>
              )
            })
          )}
        </aside>
      </div>

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
