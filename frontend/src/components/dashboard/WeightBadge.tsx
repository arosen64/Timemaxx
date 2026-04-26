type WeightBadgeProps = {
  weight?: number
}

export default function WeightBadge({ weight }: WeightBadgeProps) {
  if (weight === undefined) return null
  const display = Math.round(Math.min(100, Math.max(0, weight)))
  return (
    <span
      className="rounded px-2.5 py-1 bg-teal/20 font-heading text-[11px] font-semibold text-navy"
      aria-label={`Assignment weight: ${display}%`}
    >
      {display}%
    </span>
  )
}
