import { PencilIcon, TrashIcon, SpinnerIcon, SparklesIcon } from '../icons'
import { type TaskType, formatDueDateTimeDisplay, displayTitle, formatMinutes } from './types'
import { formatClassTagForDisplay } from '../../utils/classTagUtils'
import TaskFeedbackForm, { type TaskFeedbackFormProps } from './TaskFeedbackForm'
import EstimateBadge from './EstimateBadge'

type TaskCardProps = {
  task: TaskType
  barColor: string
  badge: { bg: string; text: string; label: string }
  isEstimating: boolean
  feedback: Omit<TaskFeedbackFormProps, 'task'>
  onEstimate: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function TaskCard({
  task,
  barColor,
  badge,
  isEstimating,
  feedback,
  onEstimate,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const iconBtnCls = 'flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy'

  return (
    <div className="group flex min-w-0 gap-3 rounded-[10px] border border-border bg-white px-[18px] py-4 overflow-hidden">
      <div className={`mt-0.5 h-10 w-1 shrink-0 rounded ${barColor}`} />

      <div className="flex justify-between flex-1 min-w-0 gap-4">
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          <div className="text-sm font-semibold truncate font-heading text-navy">
            {displayTitle(task)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-blue">
            <span>Due {formatDueDateTimeDisplay(task.dueDate)}</span>
            {task.classTag ? <span>· {formatClassTagForDisplay(task.classTag)}</span> : null}
            <span>· {task.taskType}</span>
            {task.timeEstimate !== undefined ? (
              <>
                <span>· ~{formatMinutes(task.timeEstimate)} estimated</span>
                <EstimateBadge isManual={task.isManualEstimate} />
              </>
            ) : null}
          </div>
          {task.description.trim().length > 0 && (
            <div className="text-xs break-words text-light-blue line-clamp-4">
              {task.description}
            </div>
          )}
        </div>

        <div className="flex w-[260px] shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className={`rounded px-2.5 py-1 ${badge.bg}`}>
              <span className={`font-heading text-[11px] font-semibold ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            {task.timeEstimate === undefined && (
              isEstimating ? (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-blue">
                  <SpinnerIcon color="currentColor" size={16} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onEstimate}
                  className={iconBtnCls}
                  aria-label="Estimate task time"
                >
                  <SparklesIcon color="currentColor" size={16} />
                </button>
              )
            )}
            <button
              type="button"
              onClick={onEdit}
              className={iconBtnCls}
              aria-label="Edit task"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue hover:bg-urgent-red-light hover:text-urgent-red transition"
              aria-label="Delete task"
            >
              <TrashIcon />
            </button>
          </div>

          {task.timeEstimate !== undefined && (
            <TaskFeedbackForm task={task} {...feedback} />
          )}
        </div>
      </div>
    </div>
  )
}
