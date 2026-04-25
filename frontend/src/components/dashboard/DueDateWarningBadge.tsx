import { WarningIcon } from '../icons'

export default function DueDateWarningBadge() {
  return (
    <span
      className="flex items-center gap-1 rounded px-2.5 py-1 bg-urgent-red-light font-heading text-[11px] font-semibold text-urgent-red"
      aria-label="Available time before due date is less than the estimated task duration"
      title="Not enough available time before this task is due"
    >
      <WarningIcon color="currentColor" size={11} />
      At Risk
    </span>
  )
}
