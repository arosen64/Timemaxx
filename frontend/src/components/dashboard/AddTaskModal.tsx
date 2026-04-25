import { useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { DEFAULT_DUE_TIME } from '../../validators'
import { type ClassTagCourseOption, type EditForm } from './types'
import TaskModal from './TaskModal'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated?: (taskId: string) => void
  classTagCourses?: ClassTagCourseOption[]
}

export default function AddTaskModal({ isOpen, onClose, onTaskCreated, classTagCourses }: AddTaskModalProps) {
  const createTask = useMutation(api.mutations.tasks.createTask)

  async function handleSubmit(form: EditForm): Promise<string> {
    const taskId = await createTask({
      title: form.title,
      description: form.description,
      taskType: form.taskType,
      dueDate: form.dueDate,
      ...(form.courseId !== undefined ? { courseId: form.courseId } : {}),
      classTag: form.classTag,
      ...(form.timeEstimate !== undefined ? { timeEstimate: form.timeEstimate } : {}),
      ...(form.assignmentWeight !== undefined ? { assignmentWeight: form.assignmentWeight } : {}),
    })
    onTaskCreated?.(taskId)
    return taskId
  }

  return (
    <TaskModal
      isOpen={isOpen}
      title="Add task"
      subtitle="Fill in the details below."
      primaryLabel="Add Task"
      primaryLoadingLabel="Adding…"
      initialValues={{
        taskName: '',
        selectedType: 'Essay',
        customTaskType: '',
        description: '',
        dueDate: '',
        dueTime: DEFAULT_DUE_TIME,
        classTag: '',
        timeEstimate: '',
      }}
      classTagCourses={classTagCourses}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  )
}
