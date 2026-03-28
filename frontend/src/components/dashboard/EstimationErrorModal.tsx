import { WarningIcon } from '../icons'
import Modal from '../ui/Modal'

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
