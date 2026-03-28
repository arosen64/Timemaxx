import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { type EditForm } from './types'
import TaskModal from './TaskModal'
import { isPastTerm } from '../../utils/termUtils'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: (taskId: string) => void
}

export default function AddTaskModal({ isOpen, onClose, onTaskCreated }: AddTaskModalProps) {
  const createTask = useMutation(api.mutations.tasks.createTask)
  const allCourses = useQuery(api.queries.userCourses.getUserCourses)

  const courses = (allCourses ?? [])
    .filter((c) => !isPastTerm(c.term ?? ''))
    .map((c) => ({ id: c._id, label: c.title }))

  async function handleSubmit(form: EditForm) {
    const taskId = await createTask({
      title: form.title,
      description: form.description,
      taskType: form.taskType,
      dueDate: form.dueDate,
      courseId: form.courseId,
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
      initialValues={{ taskName: '', selectedType: 'Essay', customTaskType: '', description: '', dueDate: '' }}
      courses={courses}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  )
}
