import { type TaskType, type EditForm, type SchemaTaskType, TASK_TYPE_OPTIONS, formatDateMMDDYYYY } from './types'
import TaskModal from './TaskModal'

export default function EditModal({
  task,
  onClose,
  onSave,
}: {
  task: TaskType
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}) {
  return (
    <TaskModal
      title="Edit task"
      subtitle="Update the details below."
      primaryLabel="Save Changes"
      primaryLoadingLabel="Saving…"
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
