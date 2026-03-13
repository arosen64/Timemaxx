import Card from './Card'

interface StatCardProps {
  /** 'default' = white card; 'accent' = navy card */
  variant?: 'default' | 'accent'
  label: string
  value: React.ReactNode
  dotColorClass: string
  subtitle: string
  subtitleColorClass?: string
}

export default function StatCard({
  variant = 'default',
  label,
  value,
  dotColorClass,
  subtitle,
  subtitleColorClass,
}: StatCardProps) {
  const isAccent = variant === 'accent'

  return (
    <Card variant={isAccent ? 'accent' : 'default'} className="flex flex-1 flex-col gap-2 p-5">
      <span className={`text-xs font-semibold ${isAccent ? 'text-sky-blue' : 'text-slate-blue'}`}>
        {label}
      </span>
      <span className={`font-heading text-[36px] font-bold leading-none ${isAccent ? 'text-teal' : 'text-navy'}`}>
        {value}
      </span>
      <div className="flex items-center gap-1">
        <div className={`h-2 w-2 shrink-0 rounded-full ${dotColorClass}`} />
        <span className={`text-xs ${subtitleColorClass ?? (isAccent ? 'text-white' : 'text-slate-blue')}`}>
          {subtitle}
        </span>
      </div>
    </Card>
  )
}
