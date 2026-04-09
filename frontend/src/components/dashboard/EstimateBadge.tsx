type EstimateBadgeProps = {
  isManual: boolean
}

export default function EstimateBadge({ isManual }: EstimateBadgeProps) {
  if (isManual) {
    return (
      <span className="rounded px-2.5 py-1 bg-info-bg font-heading text-[11px] font-semibold text-info-emphasis">
        Manual
      </span>
    )
  }
  return (
    <span className="rounded px-2.5 py-1 bg-success-light font-heading text-[11px] font-semibold text-success">
      AI
    </span>
  )
}
