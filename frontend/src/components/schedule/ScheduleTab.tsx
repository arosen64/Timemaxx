import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useAction, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import type { CalendarEntry, TimedEvent, AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import { CalendarIcon, SpinnerIcon, WarningIcon } from '../icons'
import TimeGrid, { type StudyBlockOnGrid } from './TimeGrid'
import CalendarSelectorPopup from './CalendarSelectorPopup'
import ScheduleHeader from './ScheduleHeader'
import ClassPanel from './ClassPanel'
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
  subtaskId?: Id<'subtasks'>
  title: string
  startTime: string | undefined
  studyBlockLength: number
  isConflicted: boolean | undefined
  googleEventId?: string
  needsExport?: boolean
  taskTitle: string
  taskDueDate: number
  courseColor?: string
  courseName?: string
}

export default function ScheduleTab() {
  const scheduleData = useQuery(api.queries.calendar.getScheduleData)
  const allStudyBlocks = useQuery(api.queries.studyBlocks.getAllStudyBlocksWithTasks) as StudyBlockWithTask[] | undefined
  const saveSelectedCalendarsMutation = useMutation(api.mutations.calendar.saveSelectedCalendars)
  const editStudyBlockTimeMutation = useMutation(api.mutations.studyBlocks.editStudyBlockTime)
  const runDetectConflictsMutation = useMutation(api.mutations.studyBlocks.runDetectConflicts)
  const autoRescheduleAction = useAction(api.actions.autoRescheduleConflicts.autoRescheduleConflicts)
  const fetchCalendarEventsAction = useAction(api.actions.fetchCalendarEvents.fetchCalendarEvents)
  const exportStudyBlocksAction = useAction(api.actions.exportStudyBlocksToCalendar.exportStudyBlocksToCalendar)

  const [weekOffset, setWeekOffset] = useState(0)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [isFetchingEvents, setIsFetchingEvents] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [assigningBlockId, setAssigningBlockId] = useState<Id<'studyBlocks'> | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<Id<'studyBlocks'> | null>(null)
  const [autoRescheduleMsg, setAutoRescheduleMsg] = useState<string | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

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
      ;(map[isoDateString(new Date(e.start))] ??= []).push(e)
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
    unscheduled.sort((a, b) => {
      if (a.taskDueDate !== b.taskDueDate) return a.taskDueDate - b.taskDueDate
      return a._id < b._id ? -1 : 1
    })
    return { scheduledBlocks: scheduled, unscheduledBlocks: unscheduled }
  }, [allStudyBlocks])

  const studyBlocksByDay = useMemo(() => {
    const map: Record<string, StudyBlockOnGrid[]> = {}
    for (const b of scheduledBlocks) {
      const dateStr = isoDateString(new Date(b.startTime))
      ;(map[dateStr] ??= []).push(b)
    }
    return map
  }, [scheduledBlocks])

  const highlightedSlots = useMemo((): Set<string> => {
    if (!assigningBlockId && !draggingBlockId) return new Set()

    const activeId = assigningBlockId ?? draggingBlockId
    const block = allStudyBlocks?.find((b) => b._id === activeId)
    if (!block) return new Set()

    const slots = new Set<string>()
    const timedEvents = calendarData?.timedEvents ?? []

    for (let offset = 0; offset < MAX_OFFSET_DAYS; offset++) {
      const date = offsetDate(offset)
      const dateStr = isoDateString(date)
      const jsDay = date.getDay()
      const dayName = DAYS_FULL[jsDay === 0 ? 6 : jsDay - 1]
      const row = workHoursGrid?.find((r) => r.day === dayName)

      const dayEventSlots = new Set<number>()
      for (const e of timedEvents) {
        if (isoDateString(new Date(e.start)) !== dateStr) continue
        const startMins = minutesFromMidnight(new Date(e.start))
        const endMins = minutesFromMidnight(new Date(e.end))
        const startSlot = Math.floor(startMins / 30)
        const endSlot = Math.ceil(endMins / 30)
        for (let s = startSlot; s < endSlot; s++) dayEventSlots.add(s)
      }

      const dayBlockSlots = new Set<number>()
      for (const sb of studyBlocksByDay[dateStr] ?? []) {
        if (sb._id === activeId) continue
        const startMins = minutesFromMidnight(new Date(sb.startTime))
        const blockSlots = Math.ceil(sb.studyBlockLength / 30)
        const startSlot = Math.floor(startMins / 30)
        for (let s = startSlot; s < startSlot + blockSlots; s++) dayBlockSlots.add(s)
      }

      const neededSlots = Math.ceil(block.studyBlockLength / 30)

      for (let slot = 0; slot <= 48 - neededSlots; slot++) {
        let conflict = false
        for (let s = slot; s < slot + neededSlots; s++) {
          if (row?.blocked.includes(s) || dayEventSlots.has(s) || dayBlockSlots.has(s)) {
            conflict = true
            break
          }
        }
        if (conflict) continue

        const slotStartMs = new Date(`${dateStr}T00:00:00`).getTime() + slot * 30 * 60 * 1000
        if (slotStartMs < Date.now()) continue
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
    const activeId = assigningBlockId ?? draggingBlockId
    if (!activeId) return
    const slotStartMs = new Date(`${dateStr}T00:00:00`).getTime() + slot * 30 * 60 * 1000
    if (slotStartMs < Date.now()) return
    const isoStart = new Date(slotStartMs).toISOString()
    await editStudyBlockTimeMutation({ studyBlockId: activeId, startTime: isoStart })
    setAssigningBlockId(null)
    setDraggingBlockId(null)
  }, [assigningBlockId, draggingBlockId, editStudyBlockTimeMutation])

  const handleDrop = useCallback(async (dateStr: string, slot: number) => {
    if (!draggingBlockId) return
    const slotStartMs = new Date(`${dateStr}T00:00:00`).getTime() + slot * 30 * 60 * 1000
    if (slotStartMs < Date.now()) return
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
      setAutoRescheduleMsg(
        result.unplacedCount > 0
          ? `${result.unplacedCount} block${result.unplacedCount !== 1 ? 's' : ''} could not be placed and moved to the tray.`
          : 'All conflicts resolved.'
      )
    } catch {
      setAutoRescheduleMsg('Auto-reschedule failed. Please try again.')
    } finally {
      setIsRescheduling(false)
    }
  }, [autoRescheduleAction, timezone])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportMsg(null)
    try {
      const result = await exportStudyBlocksAction({})
      if (result.noCalendar) {
        setExportMsg('No calendar connected.')
      } else {
        const parts: string[] = []
        if (result.exported > 0) parts.push(`${result.exported} block${result.exported !== 1 ? 's' : ''} exported`)
        if (result.patched > 0) parts.push(`${result.patched} updated`)
        setExportMsg(parts.length > 0 ? parts.join(', ') + '.' : 'Nothing to export.')
        // Re-fetch so the grid reflects updated GCal event positions immediately
        const fresh = await fetchCalendarEventsAction({ startDate: startDateStr, timezone })
        setCalendarData(fresh)
      }
    } catch (err) {
      setExportMsg(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsExporting(false)
    }
  }, [exportStudyBlocksAction, fetchCalendarEventsAction, startDateStr, timezone])

  async function handleToggleCalendar(calId: string) {
    const current = selectedCalendarIds ?? []
    const next = current.includes(calId) ? current.filter((id) => id !== calId) : [...current, calId]
    await saveSelectedCalendarsMutation({ selectedCalendarIds: next })
    const data = await fetchCalendarEventsAction({ startDate: startDateStr, timezone })
    setCalendarData(data)
    await runDetectConflictsMutation({
      timedEvents: data.timedEvents,
      workHoursGrid: workHoursGrid ?? [],
      timezone,
    }).catch(() => {})
  }

  const hasIndicator = calendarConnected && (!selectedCalendarIds || selectedCalendarIds.length === 0)

  const pendingExportCount = useMemo(() => {
    if (!calendarConnected) return 0
    return (allStudyBlocks ?? []).filter((b) => {
      if (!b.startTime) return false
      // needsExport explicitly true, or never exported (no googleEventId and needsExport not yet set)
      return b.needsExport === true || (b.needsExport === undefined && !b.googleEventId)
    }).length
  }, [allStudyBlocks, calendarConnected])

  return (
    <div
      className="flex flex-col flex-1 min-h-0 min-w-0"
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-grid]') && !target.closest('[data-tray]')) {
          if (assigningBlockId) setAssigningBlockId(null)
          if (draggingBlockId) setDraggingBlockId(null)
        }
      }}
    >
      <ScheduleHeader
        days={days}
        weekOffset={weekOffset}
        isFetchingEvents={isFetchingEvents}
        calendarConnected={calendarConnected}
        hasCalendarIndicator={hasIndicator}
        isExporting={isExporting}
        onPrevWeek={() => setWeekOffset((o) => o - 7)}
        onNextWeek={() => setWeekOffset((o) => o + 7)}
        onExport={handleExport}
        onOpenSelector={() => setSelectorOpen((o) => !o)}
      />

      {calendarData?.error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-urgent-red-light bg-urgent-red-light px-4 py-2 text-sm text-urgent-red">
          <WarningIcon size={14} color="#CF4520" />
          Calendar events unavailable — showing work hours only.
        </div>
      )}

      {autoRescheduleMsg && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-gray px-4 py-2 text-sm text-slate-blue">
          <span>{autoRescheduleMsg}</span>
          <button type="button" onClick={() => setAutoRescheduleMsg(null)} className="text-light-blue hover:text-slate-blue">✕</button>
        </div>
      )}

      {exportMsg && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-gray px-4 py-2 text-sm text-slate-blue">
          <span>{exportMsg}</span>
          <button type="button" onClick={() => setExportMsg(null)} className="text-light-blue hover:text-slate-blue">✕</button>
        </div>
      )}

{pendingExportCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-blue bg-info-bg px-4 py-2 text-sm text-navy">
          <CalendarIcon color="#005A8E" size={14} />
          <span>
            {pendingExportCount} block{pendingExportCount !== 1 ? 's' : ''} added or moved — export to sync with Google Calendar.
          </span>
        </div>
      )}

      {assigningBlockId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-teal bg-teal/10 px-4 py-2 text-sm text-navy">
          <span className="font-semibold font-heading">Assign mode</span>
          <span className="text-slate-blue">Click a highlighted slot to assign. Press Esc to cancel.</span>
        </div>
      )}

      {draggingBlockId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-urgent-red-light bg-urgent-red-light/30 px-4 py-2 text-sm text-navy">
          <span className="font-semibold font-heading">Moving conflict</span>
          <span className="text-slate-blue">Click a highlighted slot to move the block. Press Esc to cancel.</span>
        </div>
      )}

      <div className="flex flex-1 gap-4 min-h-0">
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
            onDragStart={(id) => {
              const block = allStudyBlocks?.find((b) => b._id === id)
              if (block?.isConflicted) {
                setDraggingBlockId(id)
              } else {
                setAssigningBlockId(id)
              }
            }}
            onDrop={handleDrop}
          />
        </div>

        {isRescheduling && (
          <div className="flex items-center gap-2 text-xs text-slate-blue self-start mt-2">
            <SpinnerIcon color="#4E6A8C" size={12} />
            Rescheduling…
          </div>
        )}

        <ClassPanel
          unscheduledBlocks={unscheduledBlocks}
          assigningBlockId={assigningBlockId}
          onToggleAssign={(id) => setAssigningBlockId((prev) => (prev === id ? null : id))}
          timezone={timezone}
        />
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
