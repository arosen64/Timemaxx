import { Badge, type BadgeVariant } from '../ui'
import { PencilIcon, TrashIcon, SparklesIcon, SpinnerIcon } from '../icons/icons'
import { formatMinutes } from '../../utils/tasks'

interface TaskCardProps {
  title: string
  dueDate: string
  taskType: string
  description: string
  timeEstimate?: number
  /** Tailwind bg class for the left color bar, e.g. 'bg-urgent-red' */
  barColorClass: string
  badgeVariant: BadgeVariant
  isEstimating: boolean
  onEdit: () => void
  onDelete: () => void
  onEstimate: () => void
}

export default function TaskCard({
  title,
  dueDate,
  taskType,
  description,
  timeEstimate,
  barColorClass,
  badgeVariant,
  isEstimating,
  onEdit,
  onDelete,
  onEstimate,
}: TaskCardProps) {
  return (
    <div className="group flex items-center gap-3.5 min-w-0 rounded-[10px] border border-border bg-white px-[18px] py-4 overflow-hidden">
      <div className={`h-10 w-1 shrink-0 rounded ${barColorClass}`} />

      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <div className="text-sm font-semibold truncate font-heading text-navy">
          {title}
        </div>
        <div className="text-xs text-slate-blue">
          Due {dueDate} · {taskType} · ~{formatMinutes(timeEstimate ?? 0)} estimated
        </div>
        {description.trim().length > 0 && (
          <div className="text-xs text-light-blue break-words line-clamp-2">
            {description}
          </div>
        )}
      </div>

      <Badge variant={badgeVariant} />

      <div className="flex items-center gap-1">
        {timeEstimate === undefined && (
          isEstimating ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue">
              <SpinnerIcon color="currentColor" size={16} />
            </div>
          ) : (
            <button
              type="button"
              onClick={onEstimate}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue transition hover:bg-bg-gray hover:text-navy"
              aria-label="Estimate task time"
            >
              <SparklesIcon color="currentColor" size={16} />
            </button>
          )
        )}
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy"
          aria-label="Edit task"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue hover:bg-urgent-tint hover:text-urgent-red transition"
          aria-label="Delete task"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
