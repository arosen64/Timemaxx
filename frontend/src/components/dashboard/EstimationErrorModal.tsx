import { WarningIcon } from '../icons'

function parseEstimationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const jsonMatch = raw.match(/(\{.+\})/s)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      const inner = parsed?.error
      if (inner?.code && inner?.message) {
        return `Error ${inner.code}: ${inner.message}`
      }
    } catch {
      // not valid JSON — fall through
    }
  }
  return 'Failed to estimate task time. Please try again.'
}

export { parseEstimationError }

export default function EstimationErrorModal({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EC]">
          <WarningIcon />
        </div>
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Estimation Failed</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">{message}</p>
        <div className="mt-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 text-sm font-semibold text-white transition rounded-lg bg-navy font-heading hover:opacity-90"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
