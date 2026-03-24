import { TrashIcon } from '../icons/icons'
import DestructButton from './DestructButton'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
  if (!isOpen) return null

  async function handleConfirm() {
    await onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Delete Account?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">
          Your account and all associated data will be permanently deleted.{' '}
          <span className="font-semibold text-navy">This cannot be undone.</span>
        </p>
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex flex-1 h-10 items-center justify-center font-heading text-sm font-semibold border border-border text-slate-blue rounded-lg transition hover:bg-bg-gray"
          >
            Cancel
          </button>
          <DestructButton icon={<TrashIcon />} text="Delete Account" onClick={handleConfirm} />
        </div>
      </div>
    </div>
  )
}
