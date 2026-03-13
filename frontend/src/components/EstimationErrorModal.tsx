import { WarningIcon } from './icons/icons'

interface EstimationErrorModalProps {
  message: string
  onClose: () => void
}

export default function EstimationErrorModal({ message, onClose }: EstimationErrorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-urgent-tint text-urgent-red">
          <WarningIcon />
        </div>
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Estimation Failed</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">{message}</p>
        <div className="mt-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-lg bg-navy font-heading text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
