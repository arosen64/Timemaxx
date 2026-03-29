import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '../icons'

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

/** Renders course-style rows when label looks like "CODE: Title" (same pattern as CourseSelector). */
function splitLabeledRow(label: string): { primary: string; secondary: string } | null {
  const i = label.indexOf(': ')
  if (i <= 0) return null
  return { primary: label.slice(0, i).trim(), secondary: label.slice(i + 2).trim() }
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
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (disabled || loading) setOpen(false)
  }, [disabled, loading])

  const selectedOption = options.find((o) => o.value === value)
  const showPlaceholder = !loading && !selectedOption

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          if (disabled || loading) return
          setOpen((o) => !o)
        }}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm outline-none focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20 disabled:opacity-50 ${
          showPlaceholder ? 'text-light-blue' : 'text-navy'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {loading ? loadingText : selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="shrink-0 text-slate-blue">
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {open && !disabled && !loading && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
          <li
            role="option"
            aria-selected={value === ''}
            onMouseDown={(e) => {
              e.preventDefault()
              onChange('')
              setOpen(false)
            }}
            className="cursor-pointer px-3 py-2 font-body text-sm text-light-blue hover:bg-sky-blue/10"
          >
            {placeholder}
          </li>
          {options.map((opt) => {
            const parts = splitLabeledRow(opt.label)
            const selected = opt.value === value
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`cursor-pointer px-3 py-2 font-body text-sm hover:bg-sky-blue/10 ${
                  selected ? 'bg-sky-blue/10' : ''
                }`}
              >
                {parts ? (
                  <>
                    <span className="font-semibold text-navy">{parts.primary}</span>
                    <span className="ml-2 text-slate-blue">{parts.secondary}</span>
                  </>
                ) : (
                  <span className="text-navy">{opt.label}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
