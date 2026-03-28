import { WarningIcon } from '../icons'
import Modal from '../ui/Modal'

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
  isOpen,
  message,
  onClose,
}: {
  isOpen: boolean
  message: string
  onClose: () => void
}) {
  return (
    <Modal
      isOpen={isOpen}
      title="Estimation Failed"
      icon={<WarningIcon />}
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Dismiss"
      showCloseButton={false}
      size="sm"
      backdrop="blur"
    >
      <p className="text-sm leading-relaxed text-slate-blue">{message}</p>
    </Modal>
  )
}
