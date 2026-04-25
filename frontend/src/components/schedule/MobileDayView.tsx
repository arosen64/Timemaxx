import { Fragment, useState } from 'react'
import type { RefObject } from 'react'
import type { AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import type { LayoutEvent } from './overlapLayout'
import type { StudyBlockOnGrid } from './TimeGrid'
import ScheduleBlockConflict from './ScheduleBlockConflict'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { SLOT_HEIGHT, TOTAL_SLOTS, isoDateString, isToday, minutesFromMidnight, slotLabel, DAYS_FULL, getTextColorClass } from './utils'
import type { Id } from '../../../../backend/convex/_generated/dataModel'

type WorkHoursRow = { day: string; available: number[]; blocked: number[] }

interface MobileDayViewProps {
  days: Date[]
  workHoursGrid: WorkHoursRow[] | null
  studyBlocksByDay: Record<string, StudyBlockOnGrid[]>
  allDayEventsByDay: Record<string, AllDayEvent[]>
  layoutByDay: Record<string, LayoutEvent[]>
  calendarConnected: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
  onMoveBlock: (studyBlockId: Id<'studyBlocks'>) => void
  onAutoReschedule: () => void
  gridRef: RefObject<HTMLDivElement>
}

export default function MobileDayView({
  days,
  workHoursGrid,
  studyBlocksByDay,
  allDayEventsByDay,
  layoutByDay,
  calendarConnected,
  onPrevWeek,
  onNextWeek,
  onMoveBlock,
  onAutoReschedule,
  gridRef,
}: MobileDayViewProps) {
  const todayIdx = days.findIndex((d) => isToday(d))
  const [dayIdx, setDayIdx] = useState(todayIdx >= 0 ? todayIdx : 0)

  const day = days[dayIdx]
  const dateStr = isoDateString(day)
  const jsDay = day.getDay()
  const dayName = DAYS_FULL[jsDay === 0 ? 6 : jsDay - 1]
  const row = workHoursGrid?.find((r) => r.day === dayName)
  const events = layoutByDay[dateStr] ?? []
  const blocks = studyBlocksByDay[dateStr] ?? []
  const allDayEvents = allDayEventsByDay[dateStr] ?? []
  const today = isToday(day)

  function handlePrev() {
    if (dayIdx === 0) {
      onPrevWeek()
      setDayIdx(6)
    } else {
      setDayIdx(dayIdx - 1)
    }
  }

  function handleNext() {
    if (dayIdx === 6) {
      onNextWeek()
      setDayIdx(0)
    } else {
      setDayIdx(dayIdx + 1)
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 rounded-xl border border-border bg-white">
      {/* Day navigation */}
      <div className={`flex items-center justify-between border-b border-border px-3 py-2 ${today ? 'bg-navy' : 'bg-bg-gray'}`}>
        <button
          type="button"
          onClick={handlePrev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue"
          aria-label="Previous day"
        >
          <ChevronLeftIcon size={14} />
        </button>
        <div className="flex flex-col items-center">
          <span className={`font-body text-xs font-semibold ${today ? 'text-teal' : 'text-slate-blue'}`}>
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className={`font-heading text-sm font-bold ${today ? 'text-white' : 'text-navy'}`}>
            {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-blue"
          aria-label="Next day"
        >
          <ChevronRightIcon size={14} />
        </button>
      </div>

      {/* All-day events */}
      {calendarConnected && allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-border bg-bg-gray/50 px-2 py-1">
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
      )}

      {/* Time grid — single day */}
      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ display: 'grid', gridTemplateColumns: '3rem 1fr' }}>
          {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
            let bgClass = today ? 'bg-today-col' : 'bg-white'
            if (row?.blocked.includes(slot)) bgClass = 'bg-slate-blue'
            else if (row?.available.includes(slot)) bgClass = 'bg-teal/40'

            return (
              <Fragment key={slot}>
                <div
                  className="flex items-start justify-end border-b border-border/50 bg-white pr-1.5 pt-px font-body text-[10px] leading-none text-light-blue"
                  style={{ height: SLOT_HEIGHT }}
                >
                  {slotLabel(slot)}
                </div>
                <div
                  className={`border-b border-l border-border/50 ${bgClass}`}
                  style={{ height: SLOT_HEIGHT }}
                />
              </Fragment>
            )
          })}

          {/* Calendar event overlays */}
          {events.map(({ event, left, width }) => {
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
                  left: `calc(3rem + (100% - 3rem) * ${left})`,
                  width: `calc((100% - 3rem) * ${width} - 2px)`,
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
          })}

          {/* Study block overlays */}
          {blocks.map((block) => {
            const startDt = new Date(block.startTime)
            const topPx = (minutesFromMidnight(startDt) / 30) * SLOT_HEIGHT
            const heightPx = Math.max((block.studyBlockLength / 30) * SLOT_HEIGHT, SLOT_HEIGHT)
            const isConflicted = block.isConflicted ?? false
            return (
              <div
                key={block._id}
                className="absolute"
                style={{
                  top: topPx,
                  height: heightPx,
                  left: '3rem',
                  width: 'calc(100% - 3rem - 2px)',
                  zIndex: 5,
                }}
              >
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
                    className={`flex h-full flex-col justify-start overflow-hidden rounded px-2 py-1 gap-0.5 ${block.courseColor ? '' : 'bg-navy'}`}
                    style={block.courseColor ? { backgroundColor: block.courseColor } : undefined}
                  >
                    <span className={`block truncate font-heading text-[11px] font-semibold leading-tight ${block.courseColor ? getTextColorClass(block.courseColor) : 'text-white'}`}>
                      {block.title}
                    </span>
                    <span className="block truncate font-body text-[9px] leading-tight text-sky-blue">
                      {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {block.studyBlockLength} min
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
