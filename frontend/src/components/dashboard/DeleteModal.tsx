import { useState } from 'react'
import { TrashIcon } from '../icons'
import { type TaskType, displayTitle } from './types'
import { Modal } from '../ui'

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
    <Modal
      onClose={onClose}
      title="Delete Task?"
      icon={<TrashIcon color="#CF4520" />}
      primaryLabel="Delete"
      primaryLoadingLabel="Deleting…"
      onPrimary={handleConfirm}
      isPrimaryDisabled={deleting}
      primaryVariant="destructive"
      showCloseButton={false}
      size="sm"
      backdrop="blur"
    >
      <p className="text-sm leading-relaxed text-slate-blue">
        <span className="font-semibold text-navy">"{displayTitle(task)}"</span> will be
        permanently deleted. This cannot be undone.
      </p>
    </Modal>
  )
}
