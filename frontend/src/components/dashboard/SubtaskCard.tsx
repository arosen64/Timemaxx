import { SpinnerIcon, SparklesIcon, PencilIcon, TrashIcon } from '../icons'
import { type SubtaskType, formatMinutes } from './types'
import { type Id } from '../../../../backend/convex/_generated/dataModel'

type SubtaskCardProps = {
  subtask: SubtaskType
  isEstimating: boolean
  onEstimate: (id: Id<'subtasks'>) => void
  onEdit: (subtask: SubtaskType) => void
  onDelete: (id: Id<'subtasks'>) => void
}

export default function SubtaskCard({
  subtask,
  isEstimating,
  onEstimate,
  onEdit,
  onDelete,
}: SubtaskCardProps) {
  const iconBtnCls =
    'flex items-center justify-center w-7 h-7 rounded-md border border-border bg-bg-gray text-slate-blue transition hover:bg-white hover:text-navy'

  return (
    <div className="flex items-center gap-3 border-t border-border bg-bg-gray px-[18px] py-3">
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
        <span className="font-body text-xs text-light-blue">
          {subtask.timeEstimate !== undefined
            ? formatMinutes(subtask.timeEstimate)
            : isEstimating
              ? 'Estimating…'
              : 'No estimate yet'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {subtask.timeEstimate === undefined && (
          isEstimating ? (
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
          )
        )}
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
      </div>
    </div>
  )
}
