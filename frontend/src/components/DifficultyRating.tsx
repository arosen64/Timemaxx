interface DifficultyRatingProps {
  value: number
  onChange: (n: number) => void
}

export default function DifficultyRating({ value, onChange }: DifficultyRatingProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-body text-xs text-slate-blue">Difficulty:</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-6 w-6 items-center justify-center rounded-md font-body text-xs font-semibold transition-colors ${
              value === n
                ? 'bg-navy text-white'
                : 'border border-border bg-white text-slate-blue hover:border-sky-blue hover:text-navy'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
