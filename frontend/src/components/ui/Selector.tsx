

interface Option {
  label: string
  value: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  className?: string
}

export default function Selector({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
  loadingText = 'Loading...',
  className,
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={`rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20 disabled:opacity-50 ${className ?? ''}`}
    >
      <option value="">
        {loading ? loadingText : placeholder}
      </option>

      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}