import { type ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  variant?: 'form' | 'alert'
  children: ReactNode
}

export default function Modal({ onClose, variant = 'alert', children }: ModalProps) {
  if (variant === 'form') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30" onClick={onClose}>
        <div
          className="flex w-[520px] flex-col gap-6 rounded-xl border border-border bg-white p-12"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        {children}
      </div>
    </div>
  )
}
