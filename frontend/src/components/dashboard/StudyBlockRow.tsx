import type { Doc } from '../../../../backend/convex/_generated/dataModel'

export type StudyBlock = Doc<'studyBlocks'>

export type StudyBlockLike = Pick<StudyBlock, '_id' | 'title' | 'startTime' | 'studyBlockLength' | 'isCompleted'>

export function isBlockActive(block: Omit<StudyBlockLike, 'isCompleted'> & { isCompleted?: boolean }): boolean {
  if (!block.startTime) return false
  const now = Date.now()
  const start = new Date(block.startTime).getTime()
  const end = start + block.studyBlockLength * 60 * 1000
  return now >= start && now <= end
}

function formatTimeRange(startTime: string, durationMins: number): string {
  const start = new Date(startTime)
  const end = new Date(start.getTime() + durationMins * 60 * 1000)
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const timeRange = `${fmt(start)} – ${fmt(end)}`

  const today = new Date()
  const isToday =
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth() &&
    start.getDate() === today.getDate()

  if (isToday) return timeRange

  const dateLabel = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return `${dateLabel}, ${timeRange}`
}

function CheckCircleIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0">
      <circle
        cx="8" cy="8" r="7"
        stroke={filled ? 'currentColor' : 'currentColor'}
        strokeWidth="1.5"
        fill={filled ? 'currentColor' : 'none'}
        opacity={filled ? 1 : 0.4}
      />
      <polyline
        points="5,8.5 7,10.5 11,6"
        stroke={filled ? 'white' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={filled ? 1 : 0}
      />
    </svg>
  )
}

export default function StudyBlockRow({
  block,
  onToggle,
}: {
  block: StudyBlockLike
  onToggle?: (id: string) => void
}) {
  const active = isBlockActive(block)
  const completed = block.isCompleted ?? false
  const timeLabel = block.startTime
    ? formatTimeRange(block.startTime, block.studyBlockLength)
    : 'Unscheduled'
  const durationLabel = `${block.studyBlockLength} min · Focus block`

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    onToggle?.(block._id)
  }

  if (active && !completed) {
    return (
      <div className="flex items-start gap-2 rounded-[10px] bg-navy p-[18px]">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-sky-blue">{timeLabel}</span>
          <span className="font-heading text-[13px] font-semibold text-white">{block.title}</span>
          <span className="text-xs text-sky-blue">{durationLabel}</span>
        </div>
        {onToggle && (
          <button
            onClick={handleToggle}
            aria-label="Mark complete"
            className="mt-0.5 text-sky-blue opacity-60 hover:opacity-100 transition-opacity"
          >
            <CheckCircleIcon filled={false} />
          </button>
        )}
      </div>
    )
  }

  if (completed) {
    return (
      <div className="flex items-start gap-2 rounded-[10px] border border-success bg-success/5 p-[18px]">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-success/70">{timeLabel}</span>
          <span className="font-heading text-[13px] font-semibold text-success line-through">{block.title}</span>
          <span className="text-xs text-success/70">{durationLabel}</span>
        </div>
        {onToggle && (
          <button
            onClick={handleToggle}
            aria-label="Mark incomplete"
            className="mt-0.5 text-success transition-opacity hover:opacity-70"
          >
            <CheckCircleIcon filled={true} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-border bg-white p-[18px]">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-slate-blue">{timeLabel}</span>
        <span className="font-heading text-[13px] font-semibold text-navy">{block.title}</span>
        <span className="text-xs text-slate-blue">{durationLabel}</span>
      </div>
      {onToggle && (
        <button
          onClick={handleToggle}
          aria-label="Mark complete"
          className="mt-0.5 text-slate-blue opacity-40 hover:opacity-80 hover:text-success transition"
        >
          <CheckCircleIcon filled={false} />
        </button>
      )}
    </div>
  )
}
