import { useState } from 'react'
import { TrashIcon } from '../icons'
import { type TaskType, displayTitle } from './types'

export default function DeleteModal({
  task,
  onClose,
  onConfirm,
}: {
  task: TaskType
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EC]">
          <TrashIcon color="#CF4520" />
        </div>
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Delete Task?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">
          <span className="font-semibold text-navy">"{displayTitle(task)}"</span> will be
          permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 text-sm font-semibold transition border rounded-lg border-border font-heading text-slate-blue hover:bg-bg-gray"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 h-10 rounded-lg bg-[#CF4520] font-heading text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
