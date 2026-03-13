import { WarningIcon } from './icons/icons'
import Modal from './Modal'
import Button from './Button'

interface EstimationErrorModalProps {
  message: string
  onClose: () => void
}

export default function EstimationErrorModal({ message, onClose }: EstimationErrorModalProps) {
  return (
    <Modal onClose={onClose}>
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-urgent-tint text-urgent-red">
        <WarningIcon />
      </div>
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
