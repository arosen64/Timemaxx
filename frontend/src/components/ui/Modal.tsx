import { type ReactNode } from 'react'

interface ModalProps {
  isOpen?: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Icon rendered above the title inside an accent circle (e.g. for confirm dialogs). */
  icon?: ReactNode
  children?: ReactNode
  error?: string | null
  primaryLabel: string
  /** Label shown while isPrimaryDisabled is true (loading state). */
  primaryLoadingLabel?: string
  onPrimary: () => void
  isPrimaryDisabled?: boolean
  /** 'destructive' removes the teal dot and uses urgent-red for the primary button. */
  primaryVariant?: 'default' | 'destructive'
  /** Whether to show the × close button in the header. Defaults to true. */
  showCloseButton?: boolean
  /** 'sm' uses a narrower card with smaller padding and buttons (for confirm dialogs). */
  size?: 'default' | 'sm'
  /** 'blur' uses a heavier, blurred backdrop (for confirm dialogs). */
  backdrop?: 'default' | 'blur'
}

export default function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon,
  children,
  error,
  primaryLabel,
  primaryLoadingLabel,
  onPrimary,
  isPrimaryDisabled = false,
  primaryVariant = 'default',
  showCloseButton = true,
  size = 'default',
  backdrop = 'default',
}: ModalProps) {
  if (!isOpen) return null

  const isDestructive = primaryVariant === 'destructive'
  const isSm = size === 'sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${
          backdrop === 'blur' ? 'bg-navy/40 backdrop-blur-sm' : 'bg-navy/30'
        }`}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} modal`}
        className={`relative z-10 flex flex-col bg-white border border-border rounded-xl ${
          isSm
            ? 'w-full max-w-sm p-8 gap-4 shadow-xl'
            : 'w-[520px] p-12 gap-6'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon (confirm dialogs) */}
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EC]">
            {icon}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <span className="font-heading text-[26px] font-bold text-navy">{title}</span>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex items-center justify-center text-lg border-none rounded-md cursor-pointer h-7 w-7 bg-bg-gray font-body text-light-blue"
            >
              &times;
            </button>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="m-0 text-sm leading-normal font-body text-slate-blue">{subtitle}</p>
        )}

        {/* Body */}
        {children}

        {/* Error */}
        {error && <p className="text-sm text-red-500 font-body">{error}</p>}

        {/* Button Row */}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg-gray font-heading font-semibold text-slate-blue transition hover:bg-bg-gray ${
              isSm ? 'h-10 text-sm' : 'h-12 text-[15px]'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={isPrimaryDisabled}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none font-heading font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              isDestructive ? 'bg-urgent-red' : 'bg-navy'
            } ${isSm ? 'h-10 text-sm' : 'h-12 text-[15px]'}`}
          >
            {isPrimaryDisabled && primaryLoadingLabel ? primaryLoadingLabel : primaryLabel}
            {!isDestructive && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
