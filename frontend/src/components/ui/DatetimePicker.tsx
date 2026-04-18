import { useState, useRef, useEffect } from 'react'
import { CalendarIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDisplay(date: Date | undefined, placeholder: string) {
  if (!date) return placeholder
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

export interface DatetimePickerProps {
  value?: Date
  onChange: (date: Date) => void
  placeholder?: string
  minDate?: Date
}

export default function DatetimePicker({ value, onChange, placeholder = 'Pick a date & time', minDate }: DatetimePickerProps) {
  const now = value ?? new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(value ? value.getDate() : null)
  const [selectedMonth, setSelectedMonth] = useState(value ? value.getMonth() : now.getMonth())
  const [selectedYear, setSelectedYear] = useState(value ? value.getFullYear() : now.getFullYear())
  const [hour, setHour] = useState(() => {
    const h = value ? value.getHours() : 11
    return h === 0 ? 12 : h > 12 ? h - 12 : h
  })
  const [minute, setMinute] = useState(value ? value.getMinutes() : 59)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(value ? (value.getHours() >= 12 ? 'PM' : 'AM') : 'AM')

  const containerRef = useRef<HTMLDivElement>(null)

  function resetToValue() {
    const base = value ?? new Date()
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setSelectedDay(value ? value.getDate() : null)
    setSelectedMonth(base.getMonth())
    setSelectedYear(base.getFullYear())
    const h = value ? value.getHours() : 11
    setHour(h === 0 ? 12 : h > 12 ? h - 12 : h)
    setMinute(value ? value.getMinutes() : 59)
    setAmpm(value ? (value.getHours() >= 12 ? 'PM' : 'AM') : 'AM')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        resetToValue()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const candidate = new Date(viewYear, viewMonth, day)
    if (minDate && candidate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return
    setSelectedDay(day)
    setSelectedMonth(viewMonth)
    setSelectedYear(viewYear)
  }

  function isDisabled(day: number) {
    if (!minDate) return false
    const candidate = new Date(viewYear, viewMonth, day)
    return candidate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
  }

  function isSelected(day: number) {
    return selectedDay === day && selectedMonth === viewMonth && selectedYear === viewYear
  }

  function handleHourInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (isNaN(n)) return
    setHour(Math.min(12, Math.max(1, n)))
  }

  function handleMinuteInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (isNaN(n)) return
    setMinute(Math.min(59, Math.max(0, n)))
  }

  function handleConfirm() {
    if (!selectedDay) return
    let h = hour % 12
    if (ampm === 'PM') h += 12
    const result = new Date(selectedYear, selectedMonth, selectedDay, h, minute)
    onChange(result)
    setOpen(false)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startOffset = firstDayOfMonth(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-left text-sm font-body text-navy hover:border-sky-blue transition-colors"
      >
        <CalendarIcon size={16} color="#8FA6C2" />
        <span className={value ? 'text-navy' : 'text-light-blue'}>
          {formatDisplay(value, placeholder)}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border border-border bg-white shadow-lg">
          {/* Month/year header */}
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-bg-gray text-slate-blue hover:text-navy transition-colors">
              <ChevronLeftIcon size={16} />
            </button>
            <span className="text-sm font-heading font-semibold text-navy">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-bg-gray text-slate-blue hover:text-navy transition-colors">
              <ChevronRightIcon size={16} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {DAYS.map(d => (
              <div key={d} className="flex items-center justify-center text-[11px] font-heading font-semibold text-slate-blue h-7">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="px-3 pb-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-y-0.5">
                {week.map((day, di) => (
                  <div key={di} className="flex items-center justify-center">
                    {day ? (
                      <button
                        type="button"
                        disabled={isDisabled(day)}
                        onClick={() => selectDay(day)}
                        className={`w-8 h-8 rounded-full text-[13px] font-body transition-colors
                          ${isSelected(day)
                            ? 'bg-navy text-white font-semibold'
                            : isDisabled(day)
                              ? 'text-border cursor-not-allowed'
                              : 'text-navy hover:bg-bg-gray'
                          }`}
                      >
                        {day}
                      </button>
                    ) : <div className="w-8 h-8" />}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Time row */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <ClockIcon size={14} color="#8FA6C2" />
            <input
              type="text"
              value={String(hour).padStart(2, '0')}
              onChange={e => handleHourInput(e.target.value)}
              className="w-12 h-8 rounded-md border border-border bg-bg-gray text-center text-sm font-heading font-semibold text-navy outline-none focus:border-sky-blue"
              maxLength={2}
            />
            <span className="text-slate-blue font-heading font-bold text-base">:</span>
            <input
              type="text"
              value={String(minute).padStart(2, '0')}
              onChange={e => handleMinuteInput(e.target.value)}
              className="w-12 h-8 rounded-md border border-border bg-bg-gray text-center text-sm font-heading font-semibold text-navy outline-none focus:border-sky-blue"
              maxLength={2}
            />
            <div className="flex rounded-md border border-border bg-bg-gray overflow-hidden">
              <button
                type="button"
                onClick={() => setAmpm('AM')}
                className={`w-9 h-8 text-[11px] font-heading font-semibold transition-colors
                  ${ampm === 'AM' ? 'bg-navy text-white' : 'text-slate-blue hover:bg-border'}`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setAmpm('PM')}
                className={`w-9 h-8 text-[11px] font-heading font-semibold transition-colors
                  ${ampm === 'PM' ? 'bg-navy text-white' : 'text-slate-blue hover:bg-border'}`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-2.5">
            <button
              type="button"
              onClick={() => { resetToValue(); setOpen(false) }}
              className="h-8 px-3.5 rounded-md border border-border text-[13px] font-body text-slate-blue hover:bg-bg-gray transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedDay}
              onClick={handleConfirm}
              className="h-8 px-3.5 rounded-md bg-navy text-[13px] font-body font-semibold text-white hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
