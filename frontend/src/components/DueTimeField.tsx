export interface DueTimeFieldProps {
  variant: 'modal' | 'compact'
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onValueChange?: () => void
}

export default function DueTimeField({
  variant,
  id,
  label,
  value,
  onChange,
  onValueChange,
}: DueTimeFieldProps) {
  const isModal = variant === 'modal'

  return (
    <div className={isModal ? 'shrink-0 sm:w-[9.5rem]' : 'flex min-w-0 flex-col gap-1'}>
      <label
        className={
          isModal
            ? 'mb-1 block font-body text-xs font-medium text-slate-blue'
            : 'font-body text-[11px] font-medium text-slate-blue'
        }
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          onValueChange?.()
        }}
        className={
          isModal
            ? 'h-11 w-full rounded-md border border-border bg-bg-gray px-3 font-body text-sm text-navy outline-none focus:border-sky-blue'
            : 'h-8 w-[7.25rem] rounded-md border border-border bg-bg-gray px-2 font-body text-[13px] text-navy outline-none focus:border-sky-blue'
        }
      />
    </div>
  )
}
