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
}

export default function WorkHoursSelector({ data, onChange }: WorkHoursSelectorProps) {
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

  const applyToSlot = useCallback(
    (day: string, slot: number, action: DragAction, mode: PaintMode) => {
      setSlots((prev) => {
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
        onChange(slotsToData(next))
        return next
      })
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
    if (slots[day].available.has(slot)) return 'bg-green-300 hover:bg-green-400'
    if (slots[day].blocked.has(slot)) return 'bg-slate-600 hover:bg-slate-500'
    return 'bg-white hover:bg-gray-100'
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Work Hours</h2>
        <p className="mt-1 text-sm text-gray-500">
          Click or drag to mark when you're available to study or when you'll never work.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Drawing:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaintMode('available')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              paintMode === 'available'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className="inline-block h-3 w-3 rounded-sm bg-green-300" />
            Available
          </button>
          <button
            type="button"
            onClick={() => setPaintMode('blocked')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              paintMode === 'blocked'
                ? 'border-slate-500 bg-slate-50 text-slate-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className="inline-block h-3 w-3 rounded-sm bg-slate-600" />
            Never work
          </button>
        </div>
        <span className="ml-auto text-xs text-gray-400">Click a painted cell to erase it</span>
      </div>

      {/* Grid */}
      <div className="select-none overflow-hidden rounded-xl border border-gray-200">
        {/* Sticky day header */}
        <div
          className="grid border-b border-gray-200 bg-gray-50"
          style={{ gridTemplateColumns: '2.5rem repeat(7, 1fr)' }}
        >
          <div />
          {DAYS_SHORT.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600">
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
                <div className="flex h-4 items-start justify-end pr-1.5 pt-px text-[10px] leading-none text-gray-400">
                  {slot % 4 === 0 ? slotToLabel(slot) : ''}
                </div>
                {/* One cell per day */}
                {DAYS_FULL.map((day) => (
                  <div
                    key={day}
                    className={`h-4 cursor-crosshair border-b border-r border-gray-100 transition-colors ${getCellClass(day, slot)}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleMouseDown(day, slot)
                    }}
                    onMouseEnter={() => handleMouseEnter(day, slot)}
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
