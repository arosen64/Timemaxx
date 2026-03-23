import { TrashIcon } from '../icons/icons'
import { Modal, Button } from '../ui'
import DestructButton from './DestructButton'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
  async function handleConfirm() {
    await onConfirm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="mt-4 text-lg font-bold font-heading text-navy">Delete Account?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-blue">
        Your account and all associated data will be permanently deleted.{' '}
        <span className="font-semibold text-navy">This cannot be undone.</span>
      </p>
      <div className="flex gap-3 mt-8">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <DestructButton text="Delete Account" onClick={handleConfirm} icon={<TrashIcon />} />
      </div>
    </Modal>
  )
}
