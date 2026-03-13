import { useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { TaskFormData } from '../types'
import TaskFormModal from './TaskFormModal'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: (taskId: string) => void
}

export default function AddTaskModal({ isOpen, onClose, onTaskCreated }: AddTaskModalProps) {
  const createTask = useMutation(api.mutations.tasks.createTask)

  if (!isOpen) return null

  async function handleSubmit(form: TaskFormData) {
    const taskId = await createTask({
      title: form.title,
      description: form.description,
      taskType: form.taskType,
      dueDate: form.dueDate,
    })
    onTaskCreated?.(taskId)
  }

  return (
    <TaskFormModal
      heading="Add new task"
      subtitle="Fill in the details below."
      submitLabel="Add Task"
      submittingLabel="Adding…"
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  )
}
