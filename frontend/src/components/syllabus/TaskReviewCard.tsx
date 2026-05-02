import DatetimePicker from '../ui/DatetimePicker'
import { XIcon } from '../icons'
import TaskTypePills from './TaskTypePills'
import { type ReviewTask } from './types'
import { parseDueDateInput, combineDateMsWithTime } from '../../validators'

interface TaskReviewCardProps {
  task: ReviewTask
  onChange: (updated: ReviewTask) => void
  onRemove: () => void
}

function reviewTaskToDate(task: ReviewTask): Date | undefined {
  const ms = parseDueDateInput(task.dueDate)
  if (ms === null) return undefined
  return new Date(combineDateMsWithTime(ms, task.dueTime) ?? ms)
}

export default function TaskReviewCard({ task, onChange, onRemove }: TaskReviewCardProps) {
  function update(fields: Partial<Omit<ReviewTask, 'id'>>) {
    onChange({ ...task, ...fields })
  }

  function handleDatetimeChange(date: Date) {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    update({ dueDate: `${month}/${day}/${year}`, dueTime: `${h}:${m}` })
  }

  return (
    <div className="flex items-start gap-3.5 rounded-[10px] border border-border bg-white py-4 px-4.5">
      <div className="mt-1 w-1 shrink-0 self-stretch rounded-sm bg-sky-blue" />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Top row: title input + remove button */}
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

        {/* Bottom row: datetime picker + type pills */}
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-body text-[11px] font-medium text-slate-blue">Due date & time</span>
            <DatetimePicker
              value={reviewTaskToDate(task)}
              onChange={handleDatetimeChange}
              placeholder="Pick a date & time"
              minDate={new Date()}
            />
          </div>
          <div className="flex min-w-0 items-center pb-0.5">
            <TaskTypePills value={task.taskType} onChange={(taskType) => update({ taskType })} />
          </div>
        </div>

        {/* Weight row */}
        <div className="flex items-center gap-1.5">
          <span className="font-body text-[11px] font-medium text-slate-blue">Grade weight</span>
          <input
            type="number"
            min={0}
            max={100}
            value={task.assignmentWeight ?? ''}
            onChange={(e) => update({ assignmentWeight: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="—"
            className="h-8 w-16 rounded-md border border-border bg-bg-gray px-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue"
          />
          <span className="font-body text-sm text-slate-blue">%</span>
        </div>
      </div>
    </div>
  )
}
