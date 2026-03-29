import { DEFAULT_DUE_TIME, msToTimeInputValue } from '../../validators'
import {
  type ClassTagCourseOption,
  type TaskType,
  type EditForm,
  TASK_TYPE_OPTIONS,
  CUSTOM_TASK_TYPE_OPTION,
  formatDateMMDDYYYY,
} from './types'
import TaskModal from './TaskModal'

export default function EditModal({
  isOpen,
  task,
  onClose,
  onSave,
  classTagCourses,
}: {
  isOpen: boolean
  task: TaskType | null
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
  classTagCourses?: ClassTagCourseOption[]
}) {
  return (
    <TaskModal
      key={task?._id}
      isOpen={isOpen && task !== null}
      title="Edit task"
      subtitle="Update the details below."
      primaryLabel="Save Changes"
      primaryLoadingLabel="Saving…"
      initialValues={{
        taskName: task?.title ?? '',
        selectedType: task && TASK_TYPE_OPTIONS.includes(task.taskType as (typeof TASK_TYPE_OPTIONS)[number])
          ? task.taskType
          : CUSTOM_TASK_TYPE_OPTION,
        customTaskType: task && TASK_TYPE_OPTIONS.includes(task.taskType as (typeof TASK_TYPE_OPTIONS)[number])
          ? ''
          : (task?.taskType ?? ''),
        description: task?.description ?? '',
        dueDate: task ? formatDateMMDDYYYY(task.dueDate) : '',
        dueTime: task ? msToTimeInputValue(task.dueDate) : DEFAULT_DUE_TIME,
        classTag: task?.classTag ?? '',
      }}
      classTagCourses={classTagCourses}
      onClose={onClose}
      onSubmit={onSave}
    />
  )
}
