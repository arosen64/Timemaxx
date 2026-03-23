import { Card } from '../ui'

interface ScheduleBlockProps {
  /** 'active' = navy background; 'default' = white card */
  variant?: 'active' | 'default'
  time: string
  taskName: string
  duration: string
}

export default function ScheduleBlock({
  variant = 'default',
  time,
  taskName,
  duration,
}: ScheduleBlockProps) {
  const isActive = variant === 'active'

  return (
    <Card variant={isActive ? 'accent' : 'default'} className="flex flex-col gap-1.5 p-[18px]">
      <span className={`text-[11px] font-semibold ${isActive ? 'text-sky-blue' : 'text-slate-blue'}`}>
        {time}
      </span>
      <span className={`font-heading text-[13px] font-semibold ${isActive ? 'text-white' : 'text-navy'}`}>
        {taskName}
      </span>
      <span className={`text-xs ${isActive ? 'text-sky-blue' : 'text-slate-blue'}`}>
        {duration}
      </span>
    </Card>
  )
}
