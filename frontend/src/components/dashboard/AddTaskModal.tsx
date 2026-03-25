import { useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { type EditForm } from './types'
import TaskModal from './TaskModal'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: (taskId: string) => void
}

export default function AddTaskModal({ isOpen, onClose, onTaskCreated }: AddTaskModalProps) {
  const createTask = useMutation(api.mutations.tasks.createTask)

  async function handleSubmit(form: EditForm) {
    const taskId = await createTask({
      title: form.title,
      description: form.description,
      taskType: form.taskType,
      dueDate: form.dueDate,
    })
    onTaskCreated?.(taskId)
  }

  return (
    <TaskModal
      isOpen={isOpen}
      title="Add task"
      subtitle="Fill in the details below."
      primaryLabel="Add Task"
      primaryLoadingLabel="Adding…"
      initialValues={{ taskName: '', selectedType: 'Problem Set', description: '', dueDate: '' }}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  )
}
