import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import Sidebar from '../components/Sidebar'
import { PlusIcon, PencilIcon, TrashIcon, SpinnerIcon, SparklesIcon } from '../components/icons'
import Button from '../components/ui/Button'
import {
  AddTaskModal,
  EditModal,
  DeleteModal,
  UpcomingSchedulePanel,
  EstimationErrorModal,
  parseEstimationError,
  type ClassTagCourseOption,
  type TaskType,
  type EditForm,
  formatDueDateTimeDisplay,
  displayTitle,
  formatMinutes,
  BAR_COLORS,
  BADGE_MAP,
} from '../components/dashboard'
import { isCurrentTerm } from '../utils/termUtils'
import { buildClassTag, formatClassTagForDisplay } from '../utils/classTagUtils'

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const tasks = useQuery(api.queries.tasks.getAllTasks, {}) as TaskType[] | undefined
  const userCourses = useQuery(api.queries.userCourses.getUserCourses)
  const updateTask = useMutation(api.mutations.tasks.updateTask)
  const deleteTask = useMutation(api.mutations.tasks.deleteTask)
  const submitEstimateFeedback = useMutation(api.mutations.timeEstimate.submitEstimateFeedback)
  const requestEstimate = useAction(api.actions.requestEstimateTaskTime.requestEstimateTaskTime)
  const user = useQuery(api.queries.users.getCurrUser)

  const taskRows = useMemo(() => tasks ?? [], [tasks])

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

  const totalEstimatedMinutes = useMemo(
    () => taskRows.reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0),
    [taskRows]
  )

  const [editingTask, setEditingTask] = useState<TaskType | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [estimatingTasks, setEstimatingTasks] = useState<Set<Id<'tasks'>>>(new Set())
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

  async function handleSaveEdit(form: EditForm) {
    if (!editingTask) return
    const taskId = editingTask._id
    await updateTask({ taskId, ...form })
    handleEstimateTask(taskId)
  }

  async function handleConfirmDelete() {
    if (!deletingTask) return
    await deleteTask({ taskId: deletingTask._id })
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
        isOpen={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
        classTagCourses={classTagCourses}
      />
      <DeleteModal
        isOpen={deletingTask !== null}
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleConfirmDelete}
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
          <div className="flex flex-1 flex-col gap-2 rounded-[10px] border border-border bg-white p-5">
            <span className="text-xs font-semibold text-slate-blue">Tasks This Week</span>
            <span className="font-heading text-[36px] font-bold leading-none text-navy">{taskRows.length}</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 shrink-0 rounded-full bg-[#008767]" />
              <span className="text-xs text-[#008767]">0 completed</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 rounded-[10px] border border-border bg-white p-5">
            <span className="text-xs font-semibold text-slate-blue">Estimated Minutes</span>
            <span className="font-heading text-[36px] font-bold leading-none text-navy">
              {totalEstimatedMinutes > 0 ? Math.round(totalEstimatedMinutes) : '—'}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0 bg-sky-blue" />
              <span className="text-xs text-sky-blue">AI estimated</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 rounded-[10px] bg-navy p-5">
            <span className="text-xs font-semibold text-sky-blue">Study Streak</span>
            <span className="font-heading text-[36px] font-bold leading-none text-teal">7</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0 bg-teal" />
              <span className="text-xs text-white">days in a row</span>
            </div>
          </div>
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
                {taskRows.map((task, i) => {
                  const barColor = BAR_COLORS[i % BAR_COLORS.length]
                  const key = task.taskType?.toLowerCase().replace(/\s+/g, '') ?? ''
                  const badge = BADGE_MAP[key] ?? BADGE_MAP.default

                  return (
                    <div
                      key={task._id}
                      className="group flex min-w-0 gap-3 rounded-[10px] border border-border bg-white px-[18px] py-4 overflow-hidden"
                    >
                      <div className={`mt-0.5 h-10 w-1 shrink-0 rounded ${barColor}`} />

                      <div className="flex justify-between flex-1 min-w-0 gap-4">
                        <div className="flex flex-col flex-1 min-w-0 gap-1">
                          <div className="text-sm font-semibold truncate font-heading text-navy">
                            {displayTitle(task)}
                          </div>
                          <div className="text-xs text-slate-blue">
                            Due {formatDueDateTimeDisplay(task.dueDate)}
                            {task.classTag ? ` · ${formatClassTagForDisplay(task.classTag)}` : ''} · {task.taskType} · ~{formatMinutes(task.timeEstimate ?? 0)} estimated
                          </div>
                          {task.description.trim().length > 0 && (
                            <div className="text-xs break-words text-light-blue line-clamp-4">
                              {task.description}
                            </div>
                          )}
                        </div>

                        <div className="flex w-[260px] shrink-0 flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`rounded px-2.5 py-1 ${badge.bg}`}>
                              <span className={`font-heading text-[11px] font-semibold ${badge.text}`}>
                                {badge.label}
                              </span>
                            </div>
                            {task.timeEstimate === undefined && (
                              estimatingTasks.has(task._id) ? (
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-blue">
                                  <SpinnerIcon color="currentColor" size={16} />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleEstimateTask(task._id)}
                                  className="flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy"
                                  aria-label="Estimate task time"
                                >
                                  <SparklesIcon color="currentColor" size={16} />
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingTask(task)}
                              className="flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray hover:text-navy"
                              aria-label="Edit task"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTask(task)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue hover:bg-[#FFF0EC] hover:text-[#CF4520] transition"
                              aria-label="Delete task"
                            >
                              <TrashIcon />
                            </button>
                          </div>

                          {task.timeEstimate !== undefined && (
                            task.estimateFeedbackRating && !editingFeedbackTasks.has(task._id) ? (
                              <div className="w-full flex flex-col items-end gap-1.5">
                                <div className="text-right text-[11px] text-light-blue">
                                  Feedback: {task.estimateFeedbackRating === 'up' ? 'helpful' : 'improve'}
                                  {task.correctedEstimateMinutes !== undefined
                                    ? ` · actual ${formatMinutes(task.correctedEstimateMinutes)}`
                                    : ''}
                                  <button
                                    type="button"
                                    onClick={() => startEditFeedback(task)}
                                    className="ml-1 text-[11px] text-light-blue hover:underline cursor-pointer select-none"
                                  >
                                    (<span className="text-sky-blue">edit</span>)
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex w-full flex-col items-end gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-light-blue">Time estimate helpful?</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateFeedbackDraft(task._id, (curr) =>
                                        curr.rating === 'up'
                                          ? { ...curr, rating: undefined, hours: '', minutes: '' }
                                          : { ...curr, rating: 'up' }
                                      )
                                    }
                                    className={`rounded px-2 py-1 text-xs transition ${
                                      getFeedbackDraft(task._id).rating === 'up'
                                        ? 'bg-sky-blue/20 text-navy'
                                        : 'text-slate-blue hover:bg-bg-gray'
                                    }`}
                                    aria-label="Rate estimate thumbs up"
                                  >
                                    👍
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateFeedbackDraft(task._id, (curr) =>
                                        curr.rating === 'down'
                                          ? { ...curr, rating: undefined, hours: '', minutes: '' }
                                          : { ...curr, rating: 'down' }
                                      )
                                    }
                                    className={`rounded px-2 py-1 text-xs transition ${
                                      getFeedbackDraft(task._id).rating === 'down'
                                        ? 'bg-sky-blue/20 text-navy'
                                        : 'text-slate-blue hover:bg-bg-gray'
                                    }`}
                                    aria-label="Rate estimate thumbs down"
                                  >
                                    👎
                                  </button>
                                </div>
                                {getFeedbackDraft(task._id).rating && (
                                  <>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="text-[11px] text-light-blue">Actual time taken</span>
                                      <input
                                        type="number"
                                        min={0}
                                        placeholder="hrs"
                                        value={getFeedbackDraft(task._id).hours}
                                        onChange={(e) =>
                                          updateFeedbackDraft(task._id, (curr) => ({ ...curr, hours: e.target.value }))
                                        }
                                        className="w-10 px-1.5 text-[11px] bg-white border rounded outline-none h-6 border-border text-navy"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        placeholder="mins"
                                        value={getFeedbackDraft(task._id).minutes}
                                        onChange={(e) =>
                                          updateFeedbackDraft(task._id, (curr) => ({ ...curr, minutes: e.target.value }))
                                        }
                                        className="w-12 px-1.5 text-[11px] bg-white border rounded outline-none h-6 border-border text-navy"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitFeedback(task._id)}
                                      disabled={submittingFeedbackTasks.has(task._id)}
                                      className="h-7 rounded border border-border px-2.5 text-[11px] font-medium text-slate-blue transition hover:bg-bg-gray disabled:opacity-60"
                                    >
                                      {submittingFeedbackTasks.has(task._id) ? 'Saving…' : 'Save'}
                                    </button>
                                  </>
                                )}
                                {feedbackErrors[task._id] && (
                                  <div className="w-full text-right text-[11px] text-[#CF4520]">{feedbackErrors[task._id]}</div>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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

