import { CalendarIcon, XIcon } from '../icons'
import TaskTypePills from './TaskTypePills'
import { type ReviewTask } from './types'

interface TaskReviewCardProps {
  task: ReviewTask
  onChange: (updated: ReviewTask) => void
  onRemove: () => void
}

export default function TaskReviewCard({ task, onChange, onRemove }: TaskReviewCardProps) {
  function update(fields: Partial<Omit<ReviewTask, 'id'>>) {
    onChange({ ...task, ...fields })
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
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-gray px-2.5">
            <CalendarIcon size={14} />
            <input
              type="text"
              value={task.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
              placeholder="MM / DD / YYYY"
              className="w-28 border-none bg-transparent font-body text-[13px] text-navy outline-none placeholder:text-light-blue"
            />
          </div>
          <TaskTypePills value={task.taskType} onChange={(taskType) => update({ taskType })} />
        </div>
      </div>
    </div>
  )
}

