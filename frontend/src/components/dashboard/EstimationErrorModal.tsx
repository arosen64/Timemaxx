import { WarningIcon } from '../icons/icons'
import { Modal, Button, IconCircle } from '../ui'

interface EstimationErrorModalProps {
  isOpen: boolean
  message: string
  onClose: () => void
}

export default function EstimationErrorModal({ isOpen, message, onClose }: EstimationErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <IconCircle className="bg-urgent-tint text-urgent-red">
        <WarningIcon />
      </IconCircle>
      <h2 className="mt-4 text-lg font-bold font-heading text-navy">Estimation Failed</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-blue">{message}</p>
      <div className="mt-8">
        <Button size="sm" fullWidth onClick={onClose}>
          Dismiss
        </Button>
      </div>
    </Modal>
  )
}
