import { useMemo, useRef } from 'react'
import { CalendarIcon, XIcon } from '../icons'
import TaskTypePills from './TaskTypePills'
import { type ReviewTask } from './types'
import {
  msToFormDate,
  msToDateInputValue,
  parseDueDateInput,
  parseIsoDatePickerValue,
  startOfTodayMs,
  todayDateInputMin,
} from '../../validators'

interface TaskReviewCardProps {
  task: ReviewTask
  onChange: (updated: ReviewTask) => void
  onRemove: () => void
}

export default function TaskReviewCard({ task, onChange, onRemove }: TaskReviewCardProps) {
  const datePickerRef = useRef<HTMLInputElement>(null)

  const datePickerValue = useMemo(() => {
    const ms = parseDueDateInput(task.dueDate)
    return ms !== null ? msToDateInputValue(ms) : ''
  }, [task.dueDate])

  const datePickerMin = useMemo(() => {
    const ms = parseDueDateInput(task.dueDate)
    if (ms !== null && ms < startOfTodayMs()) return undefined
    return todayDateInputMin()
  }, [task.dueDate])

  function update(fields: Partial<Omit<ReviewTask, 'id'>>) {
    onChange({ ...task, ...fields })
  }

  function openNativeDatePicker() {
    const el = datePickerRef.current
    if (!el) return
    const picker = el as HTMLInputElement & { showPicker?: () => void }
    picker.showPicker?.() ?? el.click()
  }

  function handleDueDateBlur() {
    const t = task.dueDate.trim()
    if (!t) return
    const ms = parseDueDateInput(t)
    if (ms !== null) {
      update({ dueDate: msToFormDate(ms) })
    }
  }

  function handleNativeDateChange(iso: string) {
    if (!iso) return
    const ms = parseIsoDatePickerValue(iso)
    if (ms === null) return
    update({ dueDate: msToFormDate(ms) })
  }

  return (
    <div className="flex items-start gap-3.5 rounded-[10px] border border-border bg-white py-4 px-4.5">
      <div className="mt-1 w-1 shrink-0 self-stretch rounded-sm bg-sky-blue" />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Top row: class badge + title input + remove button */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={task.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Task title"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg-gray px-3 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove task"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-urgent-red-light transition-colors hover:bg-urgent-red/20"
          >
            <XIcon />
          </button>
        </div>

        {/* Bottom row: due date + type pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-border bg-bg-gray px-2.5">
            <div className="relative inline-flex shrink-0">
              <input
                ref={datePickerRef}
                type="date"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 h-px w-px min-w-px -translate-x-1/2 opacity-0"
                tabIndex={-1}
                aria-hidden
                value={datePickerValue}
                {...(datePickerMin !== undefined ? { min: datePickerMin } : {})}
                onChange={(e) => handleNativeDateChange(e.target.value)}
              />
              <button
                type="button"
                onClick={openNativeDatePicker}
                className="relative z-20 flex cursor-pointer items-center justify-center rounded p-0.5 text-light-blue outline-none hover:text-navy focus-visible:ring-2 focus-visible:ring-navy/30"
                aria-label="Open calendar"
              >
                <CalendarIcon size={14} />
              </button>
            </div>
            <input
              id={`syllabus-review-due-${task.id}`}
              type="text"
              value={task.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
              onBlur={handleDueDateBlur}
              placeholder="MM / DD / YYYY"
              autoComplete="off"
              className="w-28 min-w-0 border-none bg-transparent font-body text-[13px] text-navy outline-none placeholder:text-light-blue"
            />
          </div>
          <TaskTypePills value={task.taskType} onChange={(taskType) => update({ taskType })} />
        </div>
      </div>
    </div>
  )
}

