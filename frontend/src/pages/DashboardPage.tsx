import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import Sidebar from '../components/Sidebar'
import { PlusIcon, PencilIcon, TrashIcon, WarningIcon, SpinnerIcon, SparklesIcon } from '../components/icons'
import { AddTaskModal, EditModal, DeleteModal, type TaskType, type EditForm, formatDateMMDDYYYY, displayTitle } from '../components/dashboard'

function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes === 1) return '1 min'
  return `${Math.round(minutes)} mins`
}

const BAR_COLORS = ['bg-[#CF4520]', 'bg-sky-blue', 'bg-[#008767]']

const BADGE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-[#FFF0EC]', text: 'text-[#CF4520]', label: 'Urgent' },
  inprogress: { bg: 'bg-[#EBF5FF]', text: 'text-[#0077D8]', label: 'In Progress' },
  default: { bg: 'bg-[#E6F5F0]', text: 'text-[#008767]', label: 'Not Started' },
}


// ─── Estimation Error Helpers ─────────────────────────────────────────────────

function parseEstimationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const jsonMatch = raw.match(/(\{.+\})/s)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      const inner = parsed?.error
      if (inner?.code && inner?.message) {
        return `Error ${inner.code}: ${inner.message}`
      }
    } catch {
      // not valid JSON — fall through
    }
  }
  return 'Failed to estimate task time. Please try again.'
}

// ─── Estimation Error Modal ───────────────────────────────────────────────────

function EstimationErrorModal({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EC]">
          <WarningIcon />
        </div>
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Estimation Failed</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">{message}</p>
        <div className="mt-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-lg bg-navy font-heading text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const tasks = useQuery(api.queries.tasks.getAllTasks, {}) as TaskType[] | undefined
  const updateTask = useMutation(api.mutations.tasks.updateTask)
  const deleteTask = useMutation(api.mutations.tasks.deleteTask)
  const submitEstimateFeedback = useMutation(api.mutations.timeEstimate.submitEstimateFeedback)
  const requestEstimate = useAction(api.actions.requestEstimateTaskTime.requestEstimateTaskTime)
  const user = useQuery(api.queries.users.getCurrUser)

  const taskRows = useMemo(() => tasks ?? [], [tasks])

  const totalEstimatedMinutes = useMemo(
    () => taskRows.reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0),
    [taskRows]
  )

  const [editingTask, setEditingTask] = useState<TaskType | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [estimatingTasks, setEstimatingTasks] = useState<Set<Id<'tasks'>>>(new Set())
  const [submittingFeedbackTasks, setSubmittingFeedbackTasks] = useState<Set<Id<'tasks'>>>(new Set())
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

  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">

      {/* Modals */}
      {estimationError && (
        <EstimationErrorModal
          message={estimationError}
          onClose={() => setEstimationError(null)}
        />
      )}
      <EditModal
        isOpen={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
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
      />

      <Sidebar />

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 min-h-0 p-10 overflow-y-auto gap-7">

        {/* Page Header */}
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            {user === undefined ? (
              <span className="inline-block h-9 w-72 animate-pulse rounded-md bg-navy/10" />
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
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 text-sm font-semibold text-white transition rounded-lg h-11 bg-navy font-heading hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-blue focus:ring-offset-2"
          >
            <PlusIcon color="#86C8BC" />
            Add Task
          </button>
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
                      className="group flex min-w-0 flex-col gap-3 rounded-[10px] border border-border bg-white px-[18px] py-4 overflow-hidden"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`h-10 w-1 shrink-0 rounded ${barColor}`} />

                        <div className="flex flex-col flex-1 min-w-0 gap-1">
                          <div className="text-sm font-semibold truncate font-heading text-navy">
                            {displayTitle(task)}
                          </div>
                          <div className="text-xs text-slate-blue">
                            Due {formatDateMMDDYYYY(task.dueDate)} · {task.taskType} · ~{formatMinutes(task.timeEstimate ?? 0)} estimated
                          </div>
                          {task.description.trim().length > 0 && (
                            <div className="text-xs text-light-blue break-words line-clamp-2">
                              {task.description}
                            </div>
                          )}
                        </div>

                        <div className={`shrink-0 rounded px-2.5 py-1 ${badge.bg}`}>
                          <span className={`font-heading text-[11px] font-semibold ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Edit / Delete / Estimate buttons */}
                        <div className="flex items-center gap-1">
                          {task.timeEstimate === undefined && (
                            estimatingTasks.has(task._id) ? (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue">
                                <SpinnerIcon color="currentColor" size={16} />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEstimateTask(task._id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-blue transition hover:bg-bg-gray hover:text-navy"
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
                      </div>

                      {task.timeEstimate !== undefined && (
                        task.estimateFeedbackRating ? (
                          <div className="ml-[18px] text-[11px] text-light-blue">
                            Feedback saved: {task.estimateFeedbackRating === 'up' ? 'helpful' : 'needs improvement'}
                            {task.correctedEstimateMinutes !== undefined
                              ? ` · corrected to ${formatMinutes(task.correctedEstimateMinutes)}`
                              : ''}
                          </div>
                        ) : (
                          <div className="ml-[18px] flex flex-wrap items-end gap-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-light-blue">Estimate feedback:</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateFeedbackDraft(task._id, (curr) => ({ ...curr, rating: 'up' }))
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
                                  updateFeedbackDraft(task._id, (curr) => ({ ...curr, rating: 'down' }))
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
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                placeholder="hrs"
                                value={getFeedbackDraft(task._id).hours}
                                onChange={(e) =>
                                  updateFeedbackDraft(task._id, (curr) => ({ ...curr, hours: e.target.value }))
                                }
                                className="h-7 w-12 rounded border border-border bg-white px-2 text-xs text-navy outline-none"
                              />
                              <input
                                type="number"
                                min={0}
                                placeholder="mins"
                                value={getFeedbackDraft(task._id).minutes}
                                onChange={(e) =>
                                  updateFeedbackDraft(task._id, (curr) => ({ ...curr, minutes: e.target.value }))
                                }
                                className="h-7 w-14 rounded border border-border bg-white px-2 text-xs text-navy outline-none"
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
                            {feedbackErrors[task._id] && (
                              <div className="w-full text-[11px] text-[#CF4520]">{feedbackErrors[task._id]}</div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Schedule Column */}
          <aside className="flex w-[300px] shrink-0 flex-col gap-4">
            <h2 className="text-base font-bold font-heading text-navy">Today's Schedule</h2>

            <div className="flex flex-col gap-1.5 rounded-[10px] bg-navy p-[18px]">
              <span className="text-[11px] font-semibold text-sky-blue">9:00 AM – 10:30 AM</span>
              <span className="font-heading text-[13px] font-semibold text-white">Calculus Problem Set 5</span>
              <span className="text-xs text-sky-blue">1.5 hrs · Focus block</span>
            </div>

            {[
              { time: '2:00 PM – 3:00 PM', task: 'History Essay', dur: '1 hr · Focus block' },
              { time: '6:00 PM – 7:00 PM', task: 'Chemistry Lab Report', dur: '1 hr · Focus block' },
            ].map(({ time, task, dur }) => (
              <div key={time} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-[18px]">
                <span className="text-[11px] font-semibold text-slate-blue">{time}</span>
                <span className="font-heading text-[13px] font-semibold text-navy">{task}</span>
                <span className="text-xs text-slate-blue">{dur}</span>
              </div>
            ))}

            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-gray px-3.5 py-3">
              <SparklesIcon color="#68ACE5" size={14} />
              <span className="text-[11px] text-slate-blue">Powered by Google Gemini</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

