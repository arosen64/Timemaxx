import type { Id } from '../../../../backend/convex/_generated/dataModel'

interface ScheduleBlockConflictProps {
  title: string
  studyBlockId: Id<'studyBlocks'>
  startTime: string
  studyBlockLength: number
  onMove: (studyBlockId: Id<'studyBlocks'>) => void
  onAutoReschedule: () => void
}

export default function ScheduleBlockConflict({
  title,
  studyBlockId,
  startTime,
  studyBlockLength,
  onMove,
  onAutoReschedule,
}: ScheduleBlockConflictProps) {
  const startDt = new Date(startTime)
  const timeLabel = startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="relative flex flex-col gap-1 rounded border border-urgent-red-light bg-white px-2 py-1.5 shadow-sm overflow-hidden">
      {/* Red conflict badge */}
      <span className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 bg-[#FFF0EC] font-heading text-[9px] font-semibold text-urgent-red leading-none">
        Conflict
      </span>

      <span className="block truncate pr-12 font-heading text-[11px] font-semibold leading-tight text-navy">
        {title}
      </span>
      <span className="block font-body text-[9px] text-slate-blue">
        {timeLabel} · {studyBlockLength} min
      </span>

      <div className="flex gap-1 mt-0.5">
        <button
          type="button"
          onClick={() => onMove(studyBlockId)}
          className="flex-1 h-5 rounded border border-border bg-white font-heading text-[9px] font-semibold text-slate-blue transition hover:bg-bg-gray"
        >
          Move
        </button>
        <button
          type="button"
          onClick={onAutoReschedule}
          className="flex-1 h-5 rounded bg-navy font-heading text-[9px] font-semibold text-white transition hover:opacity-90"
        >
          Auto-reschedule
        </button>
      </div>
    </div>
  )
}
