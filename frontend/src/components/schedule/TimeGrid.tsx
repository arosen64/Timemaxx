import { Fragment } from 'react'

function getTextColorClass(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'text-navy' : 'text-white'
}
import type { AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import type { LayoutEvent } from './overlapLayout'
import { TOTAL_SLOTS, SLOT_HEIGHT, DAYS_FULL, slotLabel, isoDateString, isToday, minutesFromMidnight } from './utils'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import ScheduleBlockConflict from './ScheduleBlockConflict'

type WorkHoursRow = { day: string; available: number[]; blocked: number[] }

export type StudyBlockOnGrid = {
  _id: Id<'studyBlocks'>
  taskId: Id<'tasks'>
  title: string
  startTime: string
  studyBlockLength: number
  isConflicted: boolean | undefined
  taskTitle: string
  taskDueDate: number
  courseColor?: string
  courseName?: string
}

function getSlotState(grid: WorkHoursRow[] | null, dayName: string, slot: number) {
  const row = grid?.find((r) => r.day === dayName)
  if (!row) return 'none'
  if (row.available.includes(slot)) return 'preferred'
  if (row.blocked.includes(slot)) return 'unavailable'
  return 'none'
}

function slotBgClass(
  state: 'preferred' | 'unavailable' | 'none',
  isHighlighted: boolean,
  isAssignMode: boolean,
) {
  if (isHighlighted) return 'bg-teal/60 cursor-pointer hover:bg-teal/80'
  if (state === 'preferred') return isAssignMode ? 'bg-teal/20' : 'bg-teal/40'
  if (state === 'unavailable') return 'bg-slate-blue'
  return 'bg-white'
}

interface TimeGridProps {
  days: Date[]
  workHoursGrid: WorkHoursRow[] | null
  layoutByDay: Record<string, LayoutEvent[]>
  allDayEventsByDay: Record<string, AllDayEvent[]>
  calendarConnected: boolean
  gridRef: React.RefObject<HTMLDivElement>
  studyBlocksByDay: Record<string, StudyBlockOnGrid[]>
  highlightedSlots: Set<string>
  isAssignMode: boolean
  onSlotClick: (dateStr: string, slot: number) => void
  onMoveBlock: (studyBlockId: Id<'studyBlocks'>) => void
  onAutoReschedule: () => void
  draggingBlockId: Id<'studyBlocks'> | null
  onDragStart: (studyBlockId: Id<'studyBlocks'>) => void
  onDrop: (dateStr: string, slot: number) => void
}

export default function TimeGrid({
  days,
  workHoursGrid,
  layoutByDay,
  allDayEventsByDay,
  calendarConnected,
  gridRef,
  studyBlocksByDay,
  highlightedSlots,
  isAssignMode,
  onSlotClick,
  onMoveBlock,
  onAutoReschedule,
  draggingBlockId,
  onDragStart,
  onDrop,
}: TimeGridProps) {
  const COLS = `3rem repeat(7, 1fr)`

  return (
    <div ref={gridRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-white min-h-0">

      {/* Sticky day header */}
      <div className="sticky top-0 z-10 grid border-b border-border bg-bg-gray" style={{ gridTemplateColumns: COLS }}>
        <div />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div key={isoDateString(day)} className="border-l border-border py-2 text-center">
              <div className={`font-body text-xs font-semibold ${today ? 'text-sky-blue' : 'text-slate-blue'}`}>
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`font-heading text-sm font-bold ${today ? 'text-navy' : 'text-slate-blue'}`}>
                {day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day chips row (only when calendar is connected) */}
      {calendarConnected && (
        <div className="grid border-b border-border bg-bg-gray/50" style={{ gridTemplateColumns: COLS }}>
          <div className="flex items-center justify-end pr-1.5">
            <span className="font-body text-[9px] leading-none text-light-blue">all-day</span>
          </div>
          {days.map((day) => {
            const key = isoDateString(day)
            return (
              <div key={key} className="flex min-h-[24px] flex-wrap gap-1 border-l border-border px-1 py-1">
                {(allDayEventsByDay[key] ?? []).map((e) => (
                  <span
                    key={e.id}
                    title={e.summary}
                    className="inline-block max-w-full truncate rounded bg-info-bg px-1.5 py-0.5 font-body text-[10px] font-medium text-info-emphasis"
                  >
                    {e.summary}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Slot rows + absolute overlay */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: COLS }}
        onDragOver={(e) => e.preventDefault()}
      >
        {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
          <Fragment key={slot}>
            <div
              className="flex items-start justify-end border-b border-border/50 bg-white pr-1.5 pt-px font-body text-[10px] leading-none text-light-blue"
              style={{ height: SLOT_HEIGHT }}
            >
              {slotLabel(slot)}
            </div>
            {days.map((day) => {
              const key = isoDateString(day)
              const jsDay = day.getDay()
              const dayName = DAYS_FULL[jsDay === 0 ? 6 : jsDay - 1]
              const state = getSlotState(workHoursGrid, dayName, slot)
              const slotKey = `${key}:${slot}`
              const isHighlighted = highlightedSlots.has(slotKey)

              return (
                <div
                  key={`${key}-${slot}`}
                  className={`border-b border-l border-border/50 ${slotBgClass(state, isHighlighted, isAssignMode)}`}
                  style={{ height: SLOT_HEIGHT }}
                  onClick={() => {
                    if (isHighlighted) onSlotClick(key, slot)
                  }}
                  onDragOver={(e) => {
                    if (draggingBlockId && isHighlighted) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggingBlockId && isHighlighted) onDrop(key, slot)
                  }}
                />
              )
            })}
          </Fragment>
        ))}

        {/* Timed calendar event blocks */}
        {days.map((day, colIdx) => {
          const key = isoDateString(day)
          return (layoutByDay[key] ?? []).map(({ event, left, width }) => {
            const startDt = new Date(event.start)
            const endDt = new Date(event.end)
            const durationMin = Math.max(15, (endDt.getTime() - startDt.getTime()) / 60000)
            const topPx = (minutesFromMidnight(startDt) / 30) * SLOT_HEIGHT
            const heightPx = (durationMin / 30) * SLOT_HEIGHT

            return (
              <div
                key={event.id}
                className="absolute overflow-hidden rounded border-l-2 border-sky-blue bg-info-bg px-1 py-0.5"
                style={{
                  top: topPx,
                  height: Math.max(heightPx, SLOT_HEIGHT),
                  left: `calc(3rem + (100% - 3rem) * ${(colIdx + left) / 7})`,
                  width: `calc((100% - 3rem) / 7 * ${width} - 2px)`,
                }}
                title={event.summary}
              >
                <span className="block truncate font-body text-[10px] font-semibold leading-tight text-info-emphasis">
                  {event.summary}
                </span>
                <span className="block font-body text-[9px] text-sky-blue">
                  {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        })}

        {/* Study block overlays */}
        {days.map((day, colIdx) => {
          const key = isoDateString(day)
          return (studyBlocksByDay[key] ?? []).map((block) => {
            const startDt = new Date(block.startTime)
            const topPx = (minutesFromMidnight(startDt) / 30) * SLOT_HEIGHT
            const heightPx = Math.max((block.studyBlockLength / 30) * SLOT_HEIGHT, SLOT_HEIGHT)
            const isConflicted = block.isConflicted ?? false
            // One calendar row or less: keep title visible (truncate + flex min-size-0 can collapse the title).
            const compactBlock = heightPx <= SLOT_HEIGHT

            return (
              <div
                key={block._id}
                className="absolute group"
                style={{
                  top: topPx,
                  height: heightPx,
                  left: `calc(3rem + (100% - 3rem) * ${colIdx / 7})`,
                  width: `calc((100% - 3rem) / 7 - 2px)`,
                  zIndex: 5,
                }}
                draggable
                onDragStart={() => onDragStart(block._id)}
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
                    className={`flex h-full min-h-0 flex-col justify-start overflow-hidden rounded px-2 cursor-grab active:cursor-grabbing ${
                      compactBlock ? 'gap-0 py-0.5' : 'gap-0.5 py-1.5'
                    } ${block.courseColor ? '' : 'bg-navy'}`}
                    style={block.courseColor ? { backgroundColor: block.courseColor } : undefined}
                  >
                    <span className={`block min-w-0 shrink-0 truncate font-heading text-[11px] font-semibold leading-tight ${block.courseColor ? getTextColorClass(block.courseColor) : 'text-white'}`}>
                      {block.title}
                    </span>
                    <span className="block min-w-0 shrink-0 truncate font-body text-[9px] leading-tight text-sky-blue">
                      {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {block.studyBlockLength} min
                    </span>
                  </div>
                )}
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}
