import { useMemo, useRef } from 'react'
import DueDateRowWithCalendar from '../DueDateRowWithCalendar'
import DueTimeField from '../DueTimeField'
import { XIcon } from '../icons'
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

        {/* Bottom row: due date, due time (default 11:59 PM), type pills */}
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-body text-[11px] font-medium text-slate-blue">Date</span>
            <DueDateRowWithCalendar
              variant="compact"
              calendarPosition="start"
              datePickerRef={datePickerRef}
              textInputId={`syllabus-review-due-${task.id}`}
              dateTextValue={task.dueDate}
              onDateTextChange={(v) => update({ dueDate: v })}
              onDateTextBlur={handleDueDateBlur}
              placeholder="MM / DD / YYYY"
              datePickerValue={datePickerValue}
              {...(datePickerMin !== undefined ? { datePickerMin } : {})}
              onIsoChange={handleNativeDateChange}
            />
          </div>
          <DueTimeField
            variant="compact"
            id={`syllabus-review-time-${task.id}`}
            label="Time"
            value={task.dueTime}
            onChange={(v) => update({ dueTime: v })}
          />
          <div className="flex min-w-0 items-center pb-0.5">
            <TaskTypePills value={task.taskType} onChange={(taskType) => update({ taskType })} />
          </div>
        </div>
      </div>
    </div>
  )
}

