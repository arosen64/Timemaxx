interface ToggleOption<T extends string> {
  value: T
  label: string
}

interface ToggleProps<T extends string> {
  options: ToggleOption<T>[]
  value: T
  onChange: (value: T) => void
}

export default function Toggle<T extends string>({ options, value, onChange }: ToggleProps<T>) {
  return (
    <div className="flex w-full gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex flex-1 items-center justify-center h-9 rounded-lg text-sm font-heading font-semibold transition border ${
            value === option.value
              ? 'bg-navy text-white border-navy'
              : 'bg-bg-gray text-slate-blue border-border hover:bg-border'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
