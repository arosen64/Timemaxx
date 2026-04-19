import { useState } from 'react'
import { SpinnerIcon, SparklesIcon, PencilIcon, TrashIcon } from '../icons'
import { type SubtaskType, type TaskStatus, formatMinutes } from './types'
import { type Id } from '../../../../backend/convex/_generated/dataModel'
import StatusDropdown from './StatusDropdown'

type SubtaskCardProps = {
  subtask: SubtaskType
  isEstimating: boolean
  onEstimate: (id: Id<'subtasks'>) => void
  onEdit: (subtask: SubtaskType) => void
  onDelete: (id: Id<'subtasks'>) => void
  onStatusChange: (id: Id<'subtasks'>, status: TaskStatus) => void
  isReadOnly?: boolean
}

export default function SubtaskCard({
  subtask,
  isEstimating,
  onEstimate,
  onEdit,
  onDelete,
  onStatusChange,
  isReadOnly = false,
}: SubtaskCardProps) {
  const [showReasoning, setShowReasoning] = useState(false)

  const iconBtnCls =
    'flex items-center justify-center w-7 h-7 rounded-md border border-border bg-bg-gray text-slate-blue transition hover:bg-white hover:text-navy'

  return (
    <div
      className="flex flex-col border-t border-border bg-bg-gray"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-[18px] py-3">
        {/* Indent + color bar */}
        <div className="ml-4 shrink-0">
          <div
            className="h-7 w-[3px] rounded"
            style={{ backgroundColor: subtask.color }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 min-w-0 flex-col gap-0.5">
          <span className="truncate font-heading text-[13px] font-semibold text-navy">
            {subtask.title || 'Untitled subtask'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 font-body text-xs text-light-blue">
            {subtask.timeEstimate !== undefined ? (
              <>
                <span>{formatMinutes(subtask.timeEstimate)}</span>
                {subtask.reasoning && !isEstimating && (
                  <button
                    type="button"
                    onClick={() => setShowReasoning((prev) => !prev)}
                    className="flex items-center gap-1 text-info-emphasis hover:underline"
                    aria-label="Toggle AI reasoning"
                  >
                    <SparklesIcon color="currentColor" size={11} />
                    <span className="text-[11px] font-semibold">Why?</span>
                  </button>
                )}
              </>
            ) : isEstimating ? (
              <span>Estimating…</span>
            ) : (
              <span>No estimate yet</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!isReadOnly && (
            <StatusDropdown
              value={subtask.status ?? 'not_started'}
              onChange={(s) => onStatusChange(subtask._id, s)}
              size="sm"
            />
          )}
          {!isReadOnly && (
            <>
              {subtask.timeEstimate === undefined &&
                (isEstimating ? (
                  <div className="flex h-7 w-7 items-center justify-center text-slate-blue">
                    <SpinnerIcon color="currentColor" size={14} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEstimate(subtask._id)}
                    className={iconBtnCls}
                    aria-label="Estimate subtask time"
                  >
                    <SparklesIcon color="currentColor" size={14} />
                  </button>
                ))}
              <button
                type="button"
                onClick={() => onEdit(subtask)}
                className={iconBtnCls}
                aria-label="Edit subtask"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => onDelete(subtask._id)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-gray text-slate-blue transition hover:bg-urgent-red-light hover:text-urgent-red"
                aria-label="Delete subtask"
              >
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          showReasoning && subtask.reasoning ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {subtask.reasoning && (
            <div className="border-t border-border bg-info-bg px-[18px] py-3 pl-[52px] flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-info-emphasis">
                  <SparklesIcon color="currentColor" size={12} />
                </span>
                <span className="text-[11px] font-semibold font-heading text-info-emphasis">
                  AI Reasoning
                </span>
              </div>
              {[
                { label: 'Courses', text: subtask.reasoning.classes },
                { label: 'Past Tasks', text: subtask.reasoning.tasks },
                { label: 'Chat History', text: subtask.reasoning.chats },
                { label: 'Profile', text: subtask.reasoning.profile },
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
    </div>
  )
}
