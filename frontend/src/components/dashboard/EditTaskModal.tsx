import { useQuery } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { type TaskType, type EditForm, TASK_TYPE_OPTIONS, CUSTOM_TASK_TYPE_OPTION, formatDateMMDDYYYY } from './types'
import TaskModal from './TaskModal'
import { isPastTerm } from '../../utils/termUtils'

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
  const allCourses = useQuery(api.queries.userCourses.getUserCourses)

  const courses = (allCourses ?? [])
    .filter((c) => !isPastTerm(c.term ?? ''))
    .map((c) => ({ id: c._id, label: c.title }))

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
        courseId: task?.courseId,
      }}
      courses={courses}
      onClose={onClose}
      onSubmit={onSave}
    />
  )
}
