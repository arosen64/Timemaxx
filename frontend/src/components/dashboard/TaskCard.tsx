import { useState } from 'react'
import { PencilIcon, TrashIcon, SpinnerIcon, SparklesIcon } from '../icons'
import { type TaskType, type SubtaskType, formatDueDateTimeDisplay, displayTitle, formatMinutes } from './types'
import { type Id } from '../../../../backend/convex/_generated/dataModel'
import { formatClassTagForDisplay } from '../../utils/classTagUtils'
import TaskFeedbackForm, { type TaskFeedbackFormProps } from './TaskFeedbackForm'
import EstimateBadge from './EstimateBadge'
import SubtaskCard from './SubtaskCard'

type TaskCardProps = {
  task: TaskType
  barColor: string
  badge: { bg: string; text: string; label: string }
  isEstimating: boolean
  feedback: Omit<TaskFeedbackFormProps, 'task'>
  onEstimate: () => void
  onEdit: () => void
  onDelete: () => void
  subtasks?: SubtaskType[]
  estimatingSubtasks?: Set<Id<'subtasks'>>
  onEditSubtask?: (subtask: SubtaskType) => void
  onDeleteSubtask?: (id: Id<'subtasks'>) => void
  onEstimateSubtask?: (id: Id<'subtasks'>) => void
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
  subtasks = [],
  estimatingSubtasks,
  onEditSubtask,
  onDeleteSubtask,
  onEstimateSubtask,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const iconBtnCls = 'flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy'

  const hasSubtasks = subtasks.length > 0
  const anySubtaskPending = hasSubtasks && subtasks.some(
    (s) => s.timeEstimate === undefined && (estimatingSubtasks?.has(s._id) ?? false)
  )
  const subtaskTotal = hasSubtasks
    ? subtasks.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0)
    : undefined

  // When subtasks exist, show their summed estimate; otherwise show task's own estimate
  const displayedEstimate = hasSubtasks ? subtaskTotal : task.timeEstimate
  const showEstimateSpinner = hasSubtasks ? anySubtaskPending : (task.timeEstimate === undefined && isEstimating)

  return (
    <div className="rounded-[10px] border border-border bg-white overflow-hidden">
      {/* Main card row */}
      <div className="group flex min-w-0 gap-3 px-[18px] py-4">
        <div
          className="mt-0.5 h-10 w-1 shrink-0 rounded"
          style={{ backgroundColor: barColor }}
        />

        <div className="flex justify-between flex-1 min-w-0 gap-4">
          <div className="flex flex-col flex-1 min-w-0 gap-1">
            <div className="text-sm font-semibold truncate font-heading text-navy">
              {displayTitle(task)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-blue">
              <span>Due {formatDueDateTimeDisplay(task.dueDate)}</span>
              {task.classTag ? <span>· {formatClassTagForDisplay(task.classTag)}</span> : null}
              <span>· {task.taskType}</span>
              {hasSubtasks ? (
                <>
                  {anySubtaskPending ? (
                    <span className="flex items-center gap-1">
                      · <SpinnerIcon color="currentColor" size={11} /> Estimating subtasks…
                    </span>
                  ) : subtaskTotal !== undefined && subtaskTotal > 0 ? (
                    <span>· {formatMinutes(subtaskTotal)} total · {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                  ) : null}
                </>
              ) : task.timeEstimate !== undefined ? (
                <>
                  <span>· {formatMinutes(task.timeEstimate)}</span>
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
              {hasSubtasks && (
                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-bg-gray px-2 py-1 font-body text-[11px] font-semibold text-slate-blue transition hover:bg-white hover:text-navy"
                  aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                >
                  <span>{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <div className={`rounded px-2.5 py-1 ${badge.bg}`}>
                <span className={`font-heading text-[11px] font-semibold ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
              {/* Show estimate button only when no subtasks and no estimate yet */}
              {!hasSubtasks && displayedEstimate === undefined && (
                showEstimateSpinner ? (
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

            {!hasSubtasks && task.timeEstimate !== undefined && !task.isManualEstimate && (
              <TaskFeedbackForm task={task} {...feedback} />
            )}
          </div>
        </div>
      </div>

      {/* Subtask list */}
      {hasSubtasks && isExpanded && (
        <div className="flex flex-col">
          {subtasks.map((subtask) => (
            <SubtaskCard
              key={subtask._id}
              subtask={subtask}
              isEstimating={estimatingSubtasks?.has(subtask._id) ?? false}
              onEstimate={onEstimateSubtask ?? (() => {})}
              onEdit={onEditSubtask ?? (() => {})}
              onDelete={onDeleteSubtask ?? (() => {})}
            />
          ))}
        </div>
      )}
    </div>
  )
}
