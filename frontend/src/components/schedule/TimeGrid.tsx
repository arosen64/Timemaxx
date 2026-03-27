import { Fragment } from 'react'
import type { AllDayEvent } from '../../../../backend/convex/actions/fetchCalendarEvents'
import type { LayoutEvent } from './overlapLayout'
import { TOTAL_SLOTS, SLOT_HEIGHT, DAYS_FULL, slotLabel, isoDateString, isToday, minutesFromMidnight } from './utils'

type WorkHoursRow = { day: string; available: number[]; blocked: number[] }

function getSlotState(grid: WorkHoursRow[] | null, dayName: string, slot: number) {
  const row = grid?.find((r) => r.day === dayName)
  if (!row) return 'none'
  if (row.available.includes(slot)) return 'preferred'
  if (row.blocked.includes(slot)) return 'unavailable'
  return 'none'
}

function slotBgClass(state: 'preferred' | 'unavailable' | 'none') {
  if (state === 'preferred') return 'bg-teal/40'
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
}

export default function TimeGrid({
  days,
  workHoursGrid,
  layoutByDay,
  allDayEventsByDay,
  calendarConnected,
  gridRef,
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

      {/* Slot rows + absolute event overlay */}
      <div className="relative grid" style={{ gridTemplateColumns: COLS }}>
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
              return (
                <div
                  key={`${key}-${slot}`}
                  className={`border-b border-l border-border/50 ${slotBgClass(state)}`}
                  style={{ height: SLOT_HEIGHT }}
                />
              )
            })}
          </Fragment>
        ))}

        {/* Timed event blocks */}
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
      </div>
    </div>
  )
}
