import type { Ref } from 'react'
import { CalendarIcon } from './icons'

export function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  const picker = input as HTMLInputElement & { showPicker?: () => void }
  picker.showPicker?.() ?? input.click()
}

export interface DueDateCalendarAnchorProps {
  datePickerRef: Ref<HTMLInputElement>
  /** YYYY-MM-DD for the hidden `input type="date"` */
  value: string
  min?: string
  onIsoChange: (iso: string) => void
  iconSize?: number
  /** Classes on the wrapper around the hidden input + button (e.g. `ml-2` when the icon sits after the text field) */
  wrapperClassName?: string
  buttonClassName?: string
}

/**
 * Native date picker: hidden `type="date"` matches the calendar button, shifted left so the
 * OS/browser popup tends to open farther left of the icon.
 */
export function DueDateCalendarAnchor({
  datePickerRef,
  value,
  min,
  onIsoChange,
  iconSize,
  wrapperClassName = '',
  buttonClassName,
}: DueDateCalendarAnchorProps) {
  const defaultButton =
    iconSize !== undefined
      ? 'relative z-20 flex cursor-pointer items-center justify-center rounded p-0.5 text-light-blue outline-none hover:text-navy focus-visible:ring-2 focus-visible:ring-navy/30'
      : 'relative z-20 cursor-pointer rounded p-1 text-light-blue outline-none hover:text-navy focus-visible:ring-2 focus-visible:ring-navy/30'

  return (
    <div className={`relative inline-flex shrink-0 ${wrapperClassName}`.trim()}>
      <input
        ref={datePickerRef}
        type="date"
        className="absolute inset-0 z-10 opacity-0 pointer-events-none -translate-x-75"
        tabIndex={-1}
        aria-hidden
        value={value}
        {...(min !== undefined ? { min } : {})}
        onChange={(e) => onIsoChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          if (!datePickerRef || typeof datePickerRef === 'function') return
          openNativeDatePicker(datePickerRef.current)
        }}
        className={buttonClassName ?? defaultButton}
        aria-label="Open calendar"
      >
        {iconSize !== undefined ? <CalendarIcon size={iconSize} /> : <CalendarIcon />}
      </button>
    </div>
  )
}
