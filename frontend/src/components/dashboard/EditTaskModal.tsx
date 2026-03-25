import { type TaskType, type EditForm, type SchemaTaskType, TASK_TYPE_OPTIONS, formatDateMMDDYYYY } from './types'
import TaskModal from './TaskModal'

export default function EditModal({
  isOpen,
  task,
  onClose,
  onSave,
}: {
  isOpen: boolean
  task: TaskType | null
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}) {
  return (
    <TaskModal
      isOpen={isOpen && task !== null}
      title="Edit task"
      subtitle="Update the details below."
      primaryLabel="Save Changes"
      primaryLoadingLabel="Saving…"
      initialValues={{
        taskName: task?.title ?? '',
        selectedType: (task && TASK_TYPE_OPTIONS.includes(task.taskType as SchemaTaskType)
          ? task.taskType
          : 'Problem Set') as SchemaTaskType,
        description: task?.description ?? '',
        dueDate: task ? formatDateMMDDYYYY(task.dueDate) : '',
      }}
      onClose={onClose}
      onSubmit={onSave}
    />
  )
}
