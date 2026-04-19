import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from '../icons'
import { type TaskStatus } from './types'

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; text: string; bg: string; border?: string }> = {
  not_started: {
    label: 'Not Started',
    dot: 'bg-success',
    text: 'text-success',
    bg: 'bg-success-light',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-info-emphasis',
    text: 'text-info-emphasis',
    bg: 'bg-info-bg',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-light-blue',
    text: 'text-slate-blue',
    bg: 'bg-bg-gray',
    border: 'border border-border',
  },
}

type StatusDropdownProps = {
  value: TaskStatus
  onChange: (status: TaskStatus) => void
  size?: 'sm' | 'md'
}

export default function StatusDropdown({ value, onChange, size = 'md' }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const config = STATUS_CONFIG[value]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const isSm = size === 'sm'
  const triggerCls = `flex items-center gap-1 rounded cursor-pointer select-none
    ${config.bg} ${config.border ?? ''}
    ${isSm ? 'px-[7px] py-[3px]' : 'px-[10px] py-1'}`
  const dotCls = `rounded-full shrink-0 ${config.dot} ${isSm ? 'w-[5px] h-[5px]' : 'w-[6px] h-[6px]'}`
  const labelCls = `font-heading font-semibold ${config.text} ${isSm ? 'text-[10px]' : 'text-[11px]'}`

  const menu = open ? createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, zIndex: 9999 }}
      className="min-w-[130px] rounded-lg border border-border bg-white shadow-md"
      role="listbox"
    >
      {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof config][]).map(([status, cfg]) => (
        <button
          key={status}
          type="button"
          role="option"
          aria-selected={status === value}
          onClick={(e) => {
            e.stopPropagation()
            onChange(status)
            setOpen(false)
          }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold font-heading transition
            hover:bg-bg-gray
            ${status === value ? 'bg-bg-gray' : ''}`}
        >
          <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${cfg.dot}`} />
          <span className={cfg.text}>{cfg.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  ) : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setMenuStyle({ top: rect.bottom + 4, left: rect.left })
          }
          setOpen((prev) => !prev)
        }}
        className={triggerCls}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={dotCls} />
        <span className={labelCls}>{config.label}</span>
        <span className={`${config.text} ${isSm ? 'w-[9px] h-[9px]' : 'w-[10px] h-[10px]'} flex items-center`}>
          <ChevronDownIcon color="currentColor" size={isSm ? 9 : 10} />
        </span>
      </button>

      {menu}
    </div>
  )
}
