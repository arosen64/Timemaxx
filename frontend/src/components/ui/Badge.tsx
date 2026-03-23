export type BadgeVariant = 'urgent' | 'inprogress' | 'notstarted'

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  urgent:     { bg: 'bg-urgent-tint',  text: 'text-urgent-red', label: 'Urgent' },
  inprogress: { bg: 'bg-sky-tint',     text: 'text-sky-dark',   label: 'In Progress' },
  notstarted: { bg: 'bg-success-tint', text: 'text-success',    label: 'Not Started' },
}

interface BadgeProps {
  variant: BadgeVariant
}

export default function Badge({ variant }: BadgeProps) {
  const { bg, text, label } = BADGE_STYLES[variant]
  return (
    <div className={`shrink-0 rounded px-2.5 py-1 ${bg}`}>
      <span className={`font-heading text-[11px] font-semibold ${text}`}>{label}</span>
    </div>
  )
}
