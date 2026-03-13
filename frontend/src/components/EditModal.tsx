import { Task, TaskFormData, TASK_TYPE_OPTIONS, SchemaTaskType } from '../types'
import { formatDateMMDDYYYY } from '../utils/tasks'
import TaskFormModal from './TaskFormModal'

interface EditModalProps {
  task: Task
  onClose: () => void
  onSave: (form: TaskFormData) => Promise<void>
}

export default function EditModal({ task, onClose, onSave }: EditModalProps) {
  return (
    <TaskFormModal
      heading="Edit task"
      subtitle="Update the details below."
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      initialValues={{
        taskName: task.title,
        selectedType: (TASK_TYPE_OPTIONS.includes(task.taskType as SchemaTaskType)
          ? task.taskType
          : 'Problem Set') as SchemaTaskType,
        description: task.description,
        dueDate: formatDateMMDDYYYY(task.dueDate),
      }}
      onClose={onClose}
      onSubmit={onSave}
    />
  )
}
