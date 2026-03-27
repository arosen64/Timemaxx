import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { WorkHoursData } from '../types'

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TOTAL_SLOTS = 48 // 30-min increments across 24 hours

type PaintMode = 'available' | 'blocked'
type DragAction = 'paint' | 'erase'

function slotToLabel(slot: number): string {
  const hours = Math.floor(slot / 2)
  const ampm = hours < 12 ? 'am' : 'pm'
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h}${ampm}`
}

function initSlots(data: WorkHoursData) {
  return Object.fromEntries(
    DAYS_FULL.map((day) => [
      day,
      {
        available: new Set<number>(data[day]?.available ?? []),
        blocked: new Set<number>(data[day]?.blocked ?? []),
      },
    ])
  )
}

function slotsToData(
  slots: Record<string, { available: Set<number>; blocked: Set<number> }>
): WorkHoursData {
  return Object.fromEntries(
    DAYS_FULL.map((day) => [
      day,
      {
        available: [...slots[day].available].sort((a, b) => a - b),
        blocked: [...slots[day].blocked].sort((a, b) => a - b),
      },
    ])
  )
}

export const DEFAULT_WORK_HOURS: WorkHoursData = Object.fromEntries(
  DAYS_FULL.map((day) => [day, { available: [], blocked: [] }])
)

interface WorkHoursSelectorProps {
  data: WorkHoursData
  onChange: (data: WorkHoursData) => void
  readOnly?: boolean
}

export default function WorkHoursSelector({ data, onChange, readOnly = false }: WorkHoursSelectorProps) {
  const [paintMode, setPaintMode] = useState<PaintMode>('available')
  const [slots, setSlots] = useState(() => initSlots(data))
  const dragRef = useRef<{ active: boolean; action: DragAction; mode: PaintMode }>({
    active: false,
    action: 'paint',
    mode: 'available',
  })

  useEffect(() => {
    const handleMouseUp = () => {
      dragRef.current.active = false
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Tracks whether the most recent data change was caused by our own onChange call.
  // If so, skip re-initializing slots — the data is already in sync and re-initializing
  // would cause an extra render on every cell paint in edit mode.
  const isOwnUpdate = useRef(false)

  // Sync internal slots when data changes from an external source (e.g. parent loads
  // saved values when switching into edit mode). Skipped when the change originated
  // from our own onChange to avoid a double-render during drag painting.
  useEffect(() => {
    if (isOwnUpdate.current) {
      isOwnUpdate.current = false
      return
    }
    setSlots(initSlots(data))
  }, [data])

  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const applyToSlot = useCallback(
    (day: string, slot: number, action: DragAction, mode: PaintMode) => {
      const prev = slotsRef.current
      const available = new Set(prev[day].available)
      const blocked = new Set(prev[day].blocked)
      if (action === 'paint') {
        if (mode === 'available') {
          available.add(slot)
          blocked.delete(slot)
        } else {
          blocked.add(slot)
          available.delete(slot)
        }
      } else {
        if (mode === 'available') available.delete(slot)
        else blocked.delete(slot)
      }
      const next = { ...prev, [day]: { available, blocked } }
      setSlots(next)
      isOwnUpdate.current = true
      onChange(slotsToData(next))
    },
    [onChange]
  )

  const handleMouseDown = (day: string, slot: number) => {
    const isActive = slots[day][paintMode].has(slot)
    const action: DragAction = isActive ? 'erase' : 'paint'
    dragRef.current = { active: true, action, mode: paintMode }
    applyToSlot(day, slot, action, paintMode)
  }

  const handleMouseEnter = (day: string, slot: number) => {
    if (!dragRef.current.active) return
    applyToSlot(day, slot, dragRef.current.action, dragRef.current.mode)
  }

  const getCellClass = (day: string, slot: number): string => {
    if (slots[day].available.has(slot)) return readOnly ? 'bg-teal/40' : 'bg-teal/40 hover:bg-teal/60'
    if (slots[day].blocked.has(slot)) return readOnly ? 'bg-slate-blue' : 'bg-slate-blue hover:bg-slate-blue/80'
    return readOnly ? 'bg-white' : 'bg-white hover:bg-bg-gray'
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Mode toggle (edit) / Legend (readOnly) */}
      <div className="flex flex-wrap items-center gap-3">
        {readOnly ? (
          <>
            <span className="flex items-center gap-1.5 font-body text-sm text-slate-blue">
              <span className="inline-block h-3 w-3 rounded-sm bg-teal/40" /> Available
            </span>
            <span className="flex items-center gap-1.5 font-body text-sm text-slate-blue">
              <span className="inline-block h-3 w-3 rounded-sm bg-slate-blue" /> Never work
            </span>
          </>
        ) : (
          <>
            <span className="font-heading text-sm font-semibold text-navy">Drawing:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaintMode('available')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-medium transition-colors ${
                  paintMode === 'available'
                    ? 'border-teal bg-success-tint text-navy'
                    : 'border-border text-slate-blue hover:border-teal'
                }`}
              >
                <span className="inline-block h-3 w-3 rounded-sm bg-teal" />
                Available
              </button>
              <button
                type="button"
                onClick={() => setPaintMode('blocked')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-body text-sm font-medium transition-colors ${
                  paintMode === 'blocked'
                    ? 'border-slate-blue bg-slate-blue/10 text-navy'
                    : 'border-border text-slate-blue hover:border-slate-blue'
                }`}
              >
                <span className="inline-block h-3 w-3 rounded-sm bg-slate-blue" />
                Never work
              </button>
            </div>
            <span className="ml-auto font-body text-xs text-light-blue">Click a painted cell to erase it</span>
          </>
        )}
      </div>

      {/* Grid */}
      <div className="select-none overflow-hidden rounded-xl border border-border">
        {/* Sticky day header */}
        <div
          className="grid border-b border-border bg-bg-gray"
          style={{ gridTemplateColumns: '2.5rem repeat(7, 1fr)' }}
        >
          <div />
          {DAYS_SHORT.map((day) => (
            <div key={day} className="py-2 text-center font-body text-xs font-semibold text-slate-blue">
              {day}
            </div>
          ))}
        </div>

        {/* Slot rows */}
        <div>
          <div className="grid" style={{ gridTemplateColumns: '2.5rem repeat(7, 1fr)' }}>
            {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
              <Fragment key={slot}>
                {/* Time label every 2 hours */}
                <div className="flex h-4 items-start justify-end pr-1.5 pt-px font-body text-[10px] leading-none text-light-blue">
                  {slot % 2 === 0 ? slotToLabel(slot) : ''}
                </div>
                {/* One cell per day */}
                {DAYS_FULL.map((day) => (
                  <div
                    key={day}
                    className={`h-4 border-b border-r border-border/50 transition-colors ${
                      readOnly ? 'cursor-default' : 'cursor-crosshair'
                    } ${getCellClass(day, slot)}`}
                    onMouseDown={readOnly ? undefined : (e) => {
                      e.preventDefault()
                      handleMouseDown(day, slot)
                    }}
                    onMouseEnter={readOnly ? undefined : () => handleMouseEnter(day, slot)}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
