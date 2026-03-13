import { useState } from 'react'
import { Task } from '../types'
import { displayTitle } from '../utils/tasks'
import { TrashIcon } from './icons/icons'
import Modal from './Modal'
import Button from './Button'

interface DeleteModalProps {
  task: Task
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteModal({ task, onClose, onConfirm }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-urgent-tint text-urgent-red">
        <TrashIcon />
      </div>
      <h2 className="mt-4 text-lg font-bold font-heading text-navy">Delete Task?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-blue">
        <span className="font-semibold text-navy">"{displayTitle(task)}"</span> will be
        permanently deleted. This cannot be undone.
      </p>

      <div className="flex gap-3 mt-8">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" disabled={deleting} onClick={handleConfirm}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </Modal>
  )
}
