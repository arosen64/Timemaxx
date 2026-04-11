import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import Sidebar from '../components/Sidebar'
import { formatEstimatedTime } from '../utils/timeUtils'
import { PlusIcon, SparklesIcon } from '../components/icons'
import Button from '../components/ui/Button'
import {
  AddTaskModal,
  EditModal,
  DeleteModal,
  UpcomingSchedulePanel,
  EstimationErrorModal,
  StatCard,
  TaskCard,
  parseEstimationError,
  type ClassTagCourseOption,
  type TaskType,
  type SubtaskType,
  type EditForm,
  BADGE_MAP,
} from '../components/dashboard'
import { FALLBACK_COURSE_COLOR } from '../utils/color'
import { isCurrentTerm } from '../utils/termUtils'
import { buildClassTag } from '../utils/classTagUtils'

const FALLBACK_COLORS = ['#CF4520', '#68ACE5', '#008767']

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const tasks = useQuery(api.queries.tasks.getAllTasks, {}) as TaskType[] | undefined
  const allSubtasks = useQuery(api.queries.subtasks.getAllSubtasksForUser) as SubtaskType[] | undefined
  const userCourses = useQuery(api.queries.userCourses.getUserCourses)
  const updateTask = useMutation(api.mutations.tasks.updateTask)
  const setManualTimeEstimate = useMutation(api.mutations.timeEstimate.setManualTimeEstimate)
  const clearManualEstimate = useMutation(api.mutations.timeEstimate.clearManualEstimate)
  const deleteTask = useMutation(api.mutations.tasks.deleteTask)
  const deleteSubtask = useMutation(api.mutations.subtasks.deleteSubtask)
  const updateSubtask = useMutation(api.mutations.subtasks.updateSubtask)
  const submitEstimateFeedback = useMutation(api.mutations.timeEstimate.submitEstimateFeedback)
  const requestEstimate = useAction(api.ai.requestEstimateTaskTime.requestEstimateTaskTime)
  const requestEstimateSubtask = useAction(api.actions.requestEstimateSubtaskTime.requestEstimateSubtaskTime)
  const user = useQuery(api.queries.users.getCurrUser)

  const taskRows = useMemo(() => tasks ?? [], [tasks])

  function getTaskBarColor(task: TaskType): string {
    if (!task.courseId || !userCourses) return FALLBACK_COURSE_COLOR
    const course = userCourses.find((c) => c._id === task.courseId)
    return course?.color ?? FALLBACK_COURSE_COLOR
  }

  const subtasksByTaskId = useMemo(() => {
    const map = new Map<Id<'tasks'>, SubtaskType[]>()
    for (const s of allSubtasks ?? []) {
      const list = map.get(s.parentTaskId) ?? []
      list.push(s)
      map.set(s.parentTaskId, list)
    }
    // already sorted by order from query, but sort again to be safe
    for (const [k, v] of map) map.set(k, v.sort((a, b) => a.order - b.order))
    return map
  }, [allSubtasks])

  const classTagCourses = useMemo((): ClassTagCourseOption[] => {
    if (!userCourses?.length) return []
    const rows: ClassTagCourseOption[] = []
    for (const c of userCourses) {
      if (!isCurrentTerm(c.term ?? '')) continue
      const courseCode = c.courseCode?.trim()
      const title = c.title?.trim()
      if (!courseCode || !title) continue
      rows.push({
        courseId: c._id,
        courseCode,
        title,
        classTag: buildClassTag(courseCode, title),
      })
    }
    return rows.sort((a, b) => a.courseCode.localeCompare(b.courseCode))
  }, [userCourses])

  const courseColorByTag = useMemo(() => {
    const map = new Map<string, string>()
    if (!Array.isArray(userCourses)) return map
    for (const c of userCourses) {
      if (c.color && c.courseCode && c.title) {
        map.set(buildClassTag(c.courseCode.trim(), c.title.trim()), c.color)
      }
    }
    return map
  }, [userCourses])

  const totalEstimatedMinutes = useMemo(
    () => taskRows.reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0),
    [taskRows]
  )

  const [editingTask, setEditingTask] = useState<TaskType | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [estimatingTasks, setEstimatingTasks] = useState<Set<Id<'tasks'>>>(new Set())
  const [estimatingSubtasks, setEstimatingSubtasks] = useState<Set<Id<'subtasks'>>>(new Set())
  const [editingSubtask, setEditingSubtask] = useState<SubtaskType | null>(null)
  const [submittingFeedbackTasks, setSubmittingFeedbackTasks] = useState<Set<Id<'tasks'>>>(new Set())
  const [editingFeedbackTasks, setEditingFeedbackTasks] = useState<Set<Id<'tasks'>>>(new Set())
  const [feedbackDrafts, setFeedbackDrafts] = useState<
    Record<string, { rating?: 'up' | 'down'; hours: string; minutes: string }>
  >({})
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({})
  const [estimationError, setEstimationError] = useState<string | null>(null)

  // Clear tasks from estimatingTasks once their timeEstimate is populated by the server
  useEffect(() => {
    setEstimatingTasks((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      for (const id of prev) {
        const task = taskRows.find((t) => t._id === id)
        if (task?.timeEstimate !== undefined) next.delete(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [taskRows])

  // Clear subtasks from estimatingSubtasks once their timeEstimate arrives
  useEffect(() => {
    setEstimatingSubtasks((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      for (const id of prev) {
        const subtask = (allSubtasks ?? []).find((s) => s._id === id)
        if (subtask?.timeEstimate !== undefined) next.delete(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [allSubtasks])

  async function handleSaveEdit(form: EditForm) {
    if (!editingTask) return
    const taskId = editingTask._id
    const { timeEstimate, useAiEstimate, ...taskFields } = form
    await updateTask({ taskId, ...taskFields })
    if (useAiEstimate) {
      await clearManualEstimate({ taskId })
      handleEstimateTask(taskId)
    } else if (timeEstimate !== undefined) {
      await setManualTimeEstimate({ taskId, timeEstimate })
    } else {
      handleEstimateTask(taskId)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTask) return
    await deleteTask({ taskId: deletingTask._id })
  }

  async function handleEstimateSubtask(subtaskId: Id<'subtasks'>) {
    setEstimatingSubtasks((prev) => new Set(prev).add(subtaskId))
    try {
      await requestEstimateSubtask({ subtaskId })
    } catch (err) {
      setEstimationError(parseEstimationError(err))
    } finally {
      setEstimatingSubtasks((prev) => {
        const next = new Set(prev)
        next.delete(subtaskId)
        return next
      })
    }
  }

  async function handleEstimateTask(taskId: Id<'tasks'>) {
    setEstimatingTasks((prev) => new Set(prev).add(taskId))
    try {
      await requestEstimate({ taskId })
    } catch (err) {
      setEstimationError(parseEstimationError(err))
    } finally {
      setEstimatingTasks((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  function getFeedbackDraft(taskId: Id<'tasks'>) {
    return feedbackDrafts[taskId] ?? { rating: undefined, hours: '', minutes: '' }
  }

  function updateFeedbackDraft(
    taskId: Id<'tasks'>,
    updater: (current: { rating?: 'up' | 'down'; hours: string; minutes: string }) => {
      rating?: 'up' | 'down'
      hours: string
      minutes: string
    }
  ) {
    setFeedbackDrafts((prev) => {
      const current = prev[taskId] ?? { rating: undefined, hours: '', minutes: '' }
      return { ...prev, [taskId]: updater(current) }
    })
    setFeedbackErrors((prev) => {
      if (!prev[taskId]) return prev
      const { [taskId]: _omit, ...rest } = prev
      return rest
    })
  }

  async function handleSubmitFeedback(taskId: Id<'tasks'>) {
    const draft = getFeedbackDraft(taskId)
    if (!draft.rating) {
      setFeedbackErrors((prev) => ({ ...prev, [taskId]: 'Select thumbs up or thumbs down.' }))
      return
    }

    const hoursValue = draft.hours.trim()
    const minutesValue = draft.minutes.trim()
    let correctedEstimateMinutes: number | undefined

    if (hoursValue.length > 0 || minutesValue.length > 0) {
      const parsedHours = hoursValue.length > 0 ? Number(hoursValue) : 0
      const parsedMinutes = minutesValue.length > 0 ? Number(minutesValue) : 0
      const validHours = Number.isInteger(parsedHours) && parsedHours >= 0
      const validMinutes = Number.isInteger(parsedMinutes) && parsedMinutes >= 0
      if (!validHours || !validMinutes) {
        setFeedbackErrors((prev) => ({ ...prev, [taskId]: 'Hours/minutes must be whole numbers.' }))
        return
      }
      correctedEstimateMinutes = parsedHours * 60 + parsedMinutes
      if (correctedEstimateMinutes <= 0) {
        setFeedbackErrors((prev) => ({
          ...prev,
          [taskId]: 'Corrected estimate must be greater than 0 minutes.',
        }))
        return
      }
    }

    setSubmittingFeedbackTasks((prev) => new Set(prev).add(taskId))
    try {
      await submitEstimateFeedback({
        taskId,
        feedback: {
          rating: draft.rating,
          correctedEstimateMinutes,
        },
      })
      setEditingFeedbackTasks((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      setFeedbackErrors((prev) => {
        const { [taskId]: _omit, ...rest } = prev
        return rest
      })
    } catch (err) {
      setFeedbackErrors((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : 'Failed to submit feedback.',
      }))
    } finally {
      setSubmittingFeedbackTasks((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  function startEditFeedback(task: TaskType) {
    if (!task.estimateFeedbackRating) return

    const minutesTotal = task.correctedEstimateMinutes
    const hrs =
      typeof minutesTotal === 'number' && Number.isFinite(minutesTotal)
        ? String(Math.floor(minutesTotal / 60))
        : ''
    const mins =
      typeof minutesTotal === 'number' && Number.isFinite(minutesTotal)
        ? String(minutesTotal % 60)
        : ''

    setFeedbackDrafts((prev) => ({
      ...prev,
      [task._id]: {
        rating: task.estimateFeedbackRating,
        hours: hrs,
        minutes: mins,
      },
    }))
    setFeedbackErrors((prev) => {
      if (!prev[task._id]) return prev
      const { [task._id]: _omit, ...rest } = prev
      return rest
    })

    setEditingFeedbackTasks((prev) => new Set(prev).add(task._id))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">

      {/* Modals */}
      <EstimationErrorModal
        isOpen={estimationError !== null}
        message={estimationError ?? ''}
        onClose={() => setEstimationError(null)}
      />
      <EditModal
        isOpen={editingTask !== null && editingSubtask === null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
        classTagCourses={classTagCourses}
        existingSubtaskCount={editingTask ? (subtasksByTaskId.get(editingTask._id)?.length ?? 0) : 0}
        onDeleteSubtasks={editingTask ? async () => {
          const subtasks = subtasksByTaskId.get(editingTask._id) ?? []
          await Promise.all(subtasks.map((s) => deleteSubtask({ subtaskId: s._id })))
        } : undefined}
      />
      <EditModal
        isOpen={editingSubtask !== null}
        title="Edit subtask"
        subtitle="Update the subtask details below."
        hideSubtaskGeneration
        task={editingSubtask ? {
          _id: editingSubtask._id as unknown as Id<'tasks'>,
          title: editingSubtask.title,
          description: editingSubtask.description,
          taskType: editingSubtask.taskType,
          dueDate: editingSubtask.dueDate ?? Date.now(),
          classTag: editingSubtask.classTag,
          timeEstimate: editingSubtask.timeEstimate,
          isManualEstimate: false,
          createdAt: editingSubtask.createdAt,
        } : null}
        onClose={() => setEditingSubtask(null)}
        onSave={async (form) => {
          if (!editingSubtask) return
          await updateSubtask({
            subtaskId: editingSubtask._id,
            title: form.title,
            description: form.description,
            taskType: form.taskType,
          })
        }}
        classTagCourses={classTagCourses}
      />
      <DeleteModal
        isOpen={deletingTask !== null}
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleConfirmDelete}
        subtaskCount={deletingTask ? (subtasksByTaskId.get(deletingTask._id)?.length ?? 0) : 0}
      />
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTaskCreated={(taskId) => handleEstimateTask(taskId as Id<'tasks'>)}
        classTagCourses={classTagCourses}
      />

      <Sidebar />

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 min-h-0 p-10 overflow-y-auto gap-7">

        {/* Page Header */}
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            {user === undefined ? (
              <span className="inline-block rounded-md h-9 w-72 animate-pulse bg-navy/10" />
            ) : (
              <h1 className="font-heading text-[28px] font-bold text-navy">
                {(() => {
                  const hour = new Date().getHours()
                  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
                  return `${greeting}, ${user?.name?.split(' ')[0] ?? 'student'}!`
                })()}
              </h1>
            )}
            <p className="text-sm text-slate-blue">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}{' '}
              · {taskRows.length} task{taskRows.length !== 1 ? 's' : ''} due this week
            </p>
          </div>
          <Button
            variant="primary"
            icon={<PlusIcon color="#86C8BC" />}
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 focus:outline-none focus:ring-2 focus:ring-sky-blue focus:ring-offset-2"
          >
            Add Task
          </Button>
        </header>

        {/* Stats Row */}
        <div className="flex gap-4">
          <StatCard
            label="Tasks This Week"
            value={taskRows.length}
            indicator={{ dotClass: 'bg-success', text: '0 completed', textClass: 'text-success' }}
          />
          <StatCard
            label="Estimated Time"
            value={formatEstimatedTime(totalEstimatedMinutes)}
            indicator={{ dotClass: 'bg-sky-blue', text: 'AI estimated', textClass: 'text-sky-blue' }}
          />
          <StatCard
            label="Study Streak"
            value="—"
            indicator={{ dotClass: 'bg-teal', text: 'days in a row', textClass: 'text-white' }}
            variant="dark"
          />
        </div>

        {/* Columns */}
        <div className="flex flex-1 gap-6">

          {/* Task Column */}
          <section className="flex flex-col flex-1 min-w-0 gap-4">
            <h2 className="text-base font-bold font-heading text-navy">Upcoming Tasks</h2>

            {tasks === undefined ? (
              <div className="rounded-[10px] border border-border bg-white p-5 text-sm text-slate-blue">
                Loading tasks…
              </div>
            ) : taskRows.length === 0 ? (
              <div className="rounded-[10px] border border-border bg-white p-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-gray">
                    <SparklesIcon color="#68ACE5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold font-heading text-navy">No tasks yet</div>
                    <div className="mt-1 text-sm text-slate-blue">
                      Add your first task to get an AI time estimate and a personalized schedule.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {taskRows.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    barColor={getTaskBarColor(task)}
                    badge={BADGE_MAP[task.taskType?.toLowerCase().replace(/\s+/g, '') ?? ''] ?? BADGE_MAP.default}
                    isEstimating={estimatingTasks.has(task._id)}
                    onEstimate={() => handleEstimateTask(task._id)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => setDeletingTask(task)}
                    subtasks={subtasksByTaskId.get(task._id) ?? []}
                    estimatingSubtasks={estimatingSubtasks}
                    onEditSubtask={(subtask) => setEditingSubtask(subtask)}
                    onDeleteSubtask={(subtaskId) => deleteSubtask({ subtaskId })}
                    onEstimateSubtask={(subtaskId) => handleEstimateSubtask(subtaskId)}
                    feedback={{
                      draft: getFeedbackDraft(task._id),
                      error: feedbackErrors[task._id],
                      isSubmitting: submittingFeedbackTasks.has(task._id),
                      isEditing: editingFeedbackTasks.has(task._id),
                      onToggleRating: (value) => updateFeedbackDraft(task._id, (curr) =>
                        curr.rating === value
                          ? { ...curr, rating: undefined, hours: '', minutes: '' }
                          : { ...curr, rating: value }
                      ),
                      onHoursChange: (value) => updateFeedbackDraft(task._id, (curr) => ({ ...curr, hours: value })),
                      onMinutesChange: (value) => updateFeedbackDraft(task._id, (curr) => ({ ...curr, minutes: value })),
                      onSubmit: () => handleSubmitFeedback(task._id),
                      onStartEdit: () => startEditFeedback(task),
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Schedule Column */}
          <UpcomingSchedulePanel />
        </div>
      </main>
    </div>
  )
}
