import { WarningIcon } from '../icons'
import Modal from '../ui/Modal'

export default function EstimationErrorModal({
  isOpen,
  message,
  onClose,
  onRetry,
}: {
  isOpen: boolean
  message: string
  onClose: () => void
  onRetry?: () => void
}) {
  return (
    <Modal
      isOpen={isOpen}
      title="Estimation Failed"
      icon={<WarningIcon />}
      onClose={onClose}
      onPrimary={onRetry ?? (() => {})}
      isPrimaryDisabled={!onRetry}
      primaryLabel='Retry'
      showCancelButton={true}
      showCloseButton={false}
      size="sm"
      backdrop="blur"
    >
      <p className="text-sm leading-relaxed text-slate-blue">{message}</p>
    </Modal>
  )
}
