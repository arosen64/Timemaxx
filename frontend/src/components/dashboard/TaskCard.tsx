import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { PencilIcon, TrashIcon, SpinnerIcon, SparklesIcon, ChevronDownIcon } from '../icons'
import { type TaskType, type SubtaskType, type TaskStatus, formatDueDateTimeDisplay, displayTitle, formatMinutes } from './types'
import { type Id } from '../../../../backend/convex/_generated/dataModel'
import { formatClassTagForDisplay } from '../../utils/classTagUtils'
import TaskFeedbackForm, { type TaskFeedbackFormProps } from './TaskFeedbackForm'
import EstimateBadge from './EstimateBadge'
import SubtaskCard from './SubtaskCard'
import StudyBlockRow from './StudyBlockRow'
import StatusDropdown from './StatusDropdown'

const BLOCK_DISPLAY_LIMIT = 5

type TaskCardProps = {
  task: TaskType
  barColor: string
  isEstimating: boolean
  feedback: Omit<TaskFeedbackFormProps, 'task'>
  onStatusChange: (status: TaskStatus) => void
  onEstimate: () => void
  onEdit: () => void
  onDelete: () => void
  onReopen?: () => void
  isReadOnly?: boolean
  subtasks?: SubtaskType[]
  estimatingSubtasks?: Set<Id<'subtasks'>>
  onEditSubtask?: (subtask: SubtaskType) => void
  onDeleteSubtask?: (id: Id<'subtasks'>) => void
  onEstimateSubtask?: (id: Id<'subtasks'>) => void
  onSubtaskStatusChange?: (id: Id<'subtasks'>, status: TaskStatus) => void
}

export default function TaskCard({
  task,
  barColor,
  isEstimating,
  feedback,
  onStatusChange,
  onEstimate,
  onEdit,
  onDelete,
  onReopen,
  isReadOnly = false,
  subtasks = [],
  estimatingSubtasks,
  onEditSubtask,
  onDeleteSubtask,
  onEstimateSubtask,
  onSubtaskStatusChange,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [isCancellingBlocks, setIsCancellingBlocks] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const deleteStudyBlocksForTask = useMutation(api.mutations.studyBlocks.deleteStudyBlocksForTask)

  async function handleCancelBlocks(e: React.MouseEvent) {
    e.stopPropagation()
    setIsCancellingBlocks(true)
    try {
      await deleteStudyBlocksForTask({ taskId: task._id })
    } finally {
      setIsCancellingBlocks(false)
    }
  }

  const studyBlocks = useQuery(
    api.queries.studyBlocks.getStudyBlocksByTask,
    isExpanded ? { taskId: task._id } : 'skip',
  )

  const iconBtnCls =
    'flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy'

  const visibleBlocks = studyBlocks
    ? showAll
      ? studyBlocks
      : studyBlocks.slice(0, BLOCK_DISPLAY_LIMIT)
    : []
  const hiddenCount = studyBlocks ? Math.max(0, studyBlocks.length - BLOCK_DISPLAY_LIMIT) : 0

  const hasSubtasks = subtasks.length > 0
  const anySubtaskPending = hasSubtasks && subtasks.some(
    (s) => s.timeEstimate === undefined && (estimatingSubtasks?.has(s._id) ?? false)
  )
  const subtaskTotal = hasSubtasks
    ? subtasks.reduce((sum, s) => sum + (s.timeEstimate ?? 0), 0)
    : undefined

  const displayedEstimate = hasSubtasks ? subtaskTotal : task.timeEstimate
  const showEstimateSpinner = hasSubtasks ? anySubtaskPending : (task.timeEstimate === undefined && isEstimating)

  return (
    <div
      className="group min-w-0 cursor-pointer rounded-[10px] border border-border bg-white overflow-hidden"
      onClick={() => setIsExpanded((prev) => {
        if (prev) setShowAll(false)
        return !prev
      })}
    >
      {/* Main card row */}
      <div className="flex gap-3 px-[18px] py-4">
        <div className="mt-0.5 h-10 w-1 shrink-0 rounded" style={{ backgroundColor: barColor }} />

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
                  {!task.isManualEstimate && task.reasoning && !isEstimating && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowReasoning((prev) => !prev)
                      }}
                      className="flex items-center gap-1 text-info-emphasis hover:underline"
                      aria-label="Toggle AI reasoning"
                    >
                      <SparklesIcon color="currentColor" size={11} />
                      <span className="text-[11px] font-semibold">Why?</span>
                    </button>
                  )}
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
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReopen?.()
                  }}
                  className="rounded px-2.5 py-1 text-[11px] font-semibold font-heading text-slate-blue border border-border bg-bg-gray hover:bg-white transition"
                >
                  Reopen
                </button>
              ) : (
                <>
                  <StatusDropdown
                    value={task.status ?? 'not_started'}
                    onChange={(s) => {
                      onStatusChange(s)
                    }}
                    size="md"
                  />
                  {!hasSubtasks && displayedEstimate === undefined && (
                    showEstimateSpinner ? (
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-blue">
                        <SpinnerIcon color="currentColor" size={16} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEstimate()
                        }}
                        className={iconBtnCls}
                        aria-label="Estimate task time"
                      >
                        <SparklesIcon color="currentColor" size={16} />
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                    className={iconBtnCls}
                    aria-label="Edit task"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue hover:bg-urgent-red-light hover:text-urgent-red transition"
                    aria-label="Delete task"
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
              <div
                className={`text-slate-blue transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <ChevronDownIcon color="currentColor" size={16} />
              </div>
            </div>

            {!isReadOnly && task.timeEstimate !== undefined &&
              !task.isManualEstimate &&
              (!hasSubtasks || !anySubtaskPending) && (
                <TaskFeedbackForm task={task} {...feedback} />
              )}
          </div>
        </div>
      </div>

      {/* Collapsible reasoning panel */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          showReasoning && task.reasoning ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {task.reasoning && (
            <div className="border-t border-border bg-info-bg px-[18px] py-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-info-emphasis"><SparklesIcon color="currentColor" size={12} /></span>
                <span className="text-[11px] font-semibold font-heading text-info-emphasis">AI Reasoning</span>
              </div>
              {[
                { label: 'Courses', text: task.reasoning.classes },
                { label: 'Past Tasks', text: task.reasoning.tasks },
                { label: 'Chat History', text: task.reasoning.chats },
                { label: 'Profile', text: task.reasoning.profile },
              ].map(({ label, text }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold font-heading text-navy">{label}</span>
                  <span className="text-[11px] leading-relaxed text-slate-blue">{text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible panel: study blocks + subtasks */}
      <div
        className={`grid transition-all duration-200 ${
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-[18px] py-3 flex flex-col gap-2">
            {/* Study blocks */}
            {studyBlocks === undefined ? (
              <div className="flex items-center gap-2 py-1 text-slate-blue">
                <SpinnerIcon color="currentColor" size={14} />
                <span className="text-xs">Loading study blocks…</span>
              </div>
            ) : studyBlocks.length === 0 && !hasSubtasks ? (
              <p className="text-[13px] text-slate-blue">No study sessions scheduled yet.</p>
            ) : (
              <>
                {visibleBlocks.map((block) => (
                  <StudyBlockRow key={block._id} block={block} />
                ))}
                {hiddenCount > 0 && !showAll && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAll(true)
                    }}
                    className="self-start text-[13px] font-semibold text-sky-blue hover:underline"
                  >
                    See more (+{hiddenCount})
                  </button>
                )}
                {showAll && studyBlocks.length > BLOCK_DISPLAY_LIMIT && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAll(false)
                    }}
                    className="self-start text-[13px] font-semibold text-sky-blue hover:underline"
                  >
                    See less
                  </button>
                )}
                {!isReadOnly && studyBlocks.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancelBlocks}
                      disabled={isCancellingBlocks}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-blue hover:text-urgent-red transition disabled:opacity-50"
                      aria-label="Cancel study block generation"
                    >
                      {isCancellingBlocks
                        ? <SpinnerIcon color="currentColor" size={11} />
                        : null}
                      Cancel blocks
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Subtasks */}
            {hasSubtasks && (
              <div className="flex flex-col">
                {subtasks.map((subtask) => (
                  <SubtaskCard
                    key={subtask._id}
                    subtask={subtask}
                    isEstimating={estimatingSubtasks?.has(subtask._id) ?? false}
                    onEstimate={onEstimateSubtask ?? (() => {})}
                    onEdit={onEditSubtask ?? (() => {})}
                    onDelete={onDeleteSubtask ?? (() => {})}
                    onStatusChange={onSubtaskStatusChange ?? (() => {})}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
