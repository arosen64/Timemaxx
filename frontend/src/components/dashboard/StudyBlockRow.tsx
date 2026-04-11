import type { Doc } from '../../../../backend/convex/_generated/dataModel'

export type StudyBlock = Doc<'studyBlocks'>

export function isBlockActive(block: StudyBlock): boolean {
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
  return `${fmt(start)} – ${fmt(end)}`
}

export default function StudyBlockRow({ block }: { block: StudyBlock }) {
  const active = isBlockActive(block)
  const timeLabel = block.startTime
    ? formatTimeRange(block.startTime, block.studyBlockLength)
    : 'Unscheduled'
  const durationLabel = `${block.studyBlockLength} min · Focus block`

  if (active) {
    return (
      <div className="flex flex-col gap-1.5 rounded-[10px] bg-navy p-[18px]">
        <span className="text-[11px] font-semibold text-sky-blue">{timeLabel}</span>
        <span className="font-heading text-[13px] font-semibold text-white">{block.title}</span>
        <span className="text-xs text-sky-blue">{durationLabel}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-[18px]">
      <span className="text-[11px] font-semibold text-slate-blue">{timeLabel}</span>
      <span className="font-heading text-[13px] font-semibold text-navy">{block.title}</span>
      <span className="text-xs text-slate-blue">{durationLabel}</span>
    </div>
  )
}
