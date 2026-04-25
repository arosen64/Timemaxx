type WeightBadgeProps = {
  weight?: number
}

export default function WeightBadge({ weight }: WeightBadgeProps) {
  if (weight === undefined || weight === null) return null
  return (
    <span className="rounded px-2.5 py-1 bg-info-bg font-heading text-[11px] font-semibold text-info-emphasis">
      {weight}%
    </span>
  )
}
