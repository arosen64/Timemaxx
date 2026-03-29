import { formatDateMMDDYYYY } from './types'

export type UpcomingBlock = {
  _id: string
  title: string
  startTime: string
  studyBlockLength: number
  taskTitle: string
  taskDueDate: number
}

export default function ScheduleBlock({ block, isFirst }: { block: UpcomingBlock; isFirst: boolean }) {
  const startDt = new Date(block.startTime)
  const endDt = new Date(startDt.getTime() + block.studyBlockLength * 60 * 1000)
  const timeRange = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${endDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  return (
    <div className={`flex flex-col gap-1.5 rounded-[10px] p-[18px] ${isFirst ? 'bg-navy' : 'border border-border bg-white'}`}>
      <span className={`text-[11px] font-semibold ${isFirst ? 'text-sky-blue' : 'text-slate-blue'}`}>
        {timeRange}
      </span>
      <span className={`font-heading text-[13px] font-semibold ${isFirst ? 'text-white' : 'text-navy'}`}>
        {block.title}
      </span>
      <span className={`text-xs ${isFirst ? 'text-sky-blue' : 'text-slate-blue'}`}>
        {block.studyBlockLength} min · Due {formatDateMMDDYYYY(block.taskDueDate)}
      </span>
    </div>
  )
}
