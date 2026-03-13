import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import AddTaskModal from '../components/AddTaskModal'
import Sidebar from '../components/sidebar'
import {
  Task,
  EditForm,
  SchemaTaskType,
  TASK_TYPE_OPTIONS,
} from '../types'
import {
  formatDateMMDDYYYY,
  displayTitle,
  validateDueDateValue,
} from '../utils/tasks'
import {
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  SparklesIcon,
} from '../components/icons/icons'
import { type BadgeVariant } from '../components/Badge'
import StatCard from '../components/StatCard'
import TaskCard from '../components/TaskCard'
import ScheduleBlock from '../components/ScheduleBlock'
import GeminiChip from '../components/GeminiChip'

const BAR_COLORS = ['bg-urgent-red', 'bg-sky-blue', 'bg-success']

/** Maps a normalized taskType key to a Badge variant. Falls back to 'notstarted'. */
function badgeVariant(taskTypeKey: string): BadgeVariant {
  if (taskTypeKey === 'urgent') return 'urgent'
  if (taskTypeKey === 'inprogress') return 'inprogress'
  return 'notstarted'
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({
  task,
  onClose,
  onSave,
}: {
  task: Task
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}) {
  const [taskName, setTaskName] = useState(task.title)
  const [selectedType, setSelectedType] = useState<SchemaTaskType>(
    (TASK_TYPE_OPTIONS.includes(task.taskType as SchemaTaskType) ? task.taskType : 'Problem Set') as SchemaTaskType
  )
  const [description, setDescription] = useState(task.description)
  const [dueDate, setDueDate] = useState(formatDateMMDDYYYY(task.dueDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateDueDate(value: string): boolean {
    const errorMsg = validateDueDateValue(value)
    if (errorMsg) { setError(errorMsg); return false }
    return true
  }

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSave() {
    if (!taskName.trim()) {
      setError('Please enter a task name.')
      return
    }
    if (!selectedType || !TASK_TYPE_OPTIONS.includes(selectedType)) {
      setError('Please select a task type.')
      return
    }
    if (!description.trim()) {
      setError('Please enter a description.')
      return
    }
    const trimmedDueDate = dueDate.trim()
    if (!trimmedDueDate) {
      setError('Please enter a due date.')
      return
    }
    if (!validateDueDate(trimmedDueDate)) return

    const parsedDueDate = new Date(trimmedDueDate).getTime()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: taskName,
        description,
        taskType: selectedType,
        dueDate: parsedDueDate,
      })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30"
      onClick={handleClose}
    >
      <div
        className="flex w-[520px] flex-col gap-6 rounded-xl border border-border bg-white p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <span className="font-heading text-[26px] font-bold text-navy">Edit task</span>
          <button
            onClick={handleClose}
            className="flex items-center justify-center text-lg border-none rounded-md cursor-pointer h-7 w-7 bg-bg-gray font-body text-light-blue"
          >
            &times;
          </button>
        </div>

        {/* Subtitle */}
        <p className="m-0 text-sm leading-normal font-body text-slate-blue">
          Update the details below.
        </p>

        {/* Form Body */}
        <div className="flex flex-col w-full gap-5">
          {/* Task name */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Task name</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Calculus Problem Set 5"
              className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
            />
          </div>

          {/* Task type */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Task type</label>
            <div className="flex gap-2">
              {TASK_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 font-body text-[13px] ${
                    selectedType === type
                      ? 'border-none bg-navy font-semibold text-white'
                      : 'border border-border bg-bg-gray font-normal text-slate-blue'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or type your assignment description here..."
              className="h-24 w-full resize-none rounded-md border border-border bg-bg-gray px-3.5 py-2.5 font-body text-sm leading-normal text-navy outline-none placeholder:text-light-blue"
            />
          </div>

          {/* Due date */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Due date</label>
            <div className="flex h-11 items-center justify-between rounded-md border border-border bg-bg-gray px-3.5">
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() => {
                  if (dueDate) validateDueDate(dueDate)
                }}
                onFocus={() => setError(null)}
                placeholder="MM / DD / YYYY"
                className="flex-1 text-sm bg-transparent border-none outline-none font-body text-navy placeholder:text-light-blue"
              />
              <CalendarIcon />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 font-body">{error}</p>
        )}

        {/* Button Row */}
        <div className="flex w-full gap-3">
          <button
            onClick={handleClose}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg-gray font-heading text-[15px] font-semibold text-slate-blue"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-navy font-heading text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EC]">
          <TrashIcon color="#CF4520" />
        </div>
        <h2 className="mt-4 text-lg font-bold font-heading text-navy">Delete Task?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-blue">
          <span className="font-semibold text-navy">"{displayTitle(task)}"</span> will be
          permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 text-sm font-semibold transition border rounded-lg border-border font-heading text-slate-blue hover:bg-bg-gray"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 h-10 rounded-lg bg-[#CF4520] font-heading text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const tasks = useQuery(api.queries.tasks.getAllTasks, {}) as Task[] | undefined
  const updateTask = useMutation(api.mutations.tasks.updateTask)
  const deleteTask = useMutation(api.mutations.tasks.deleteTask)
  const requestEstimate = useAction(api.actions.requestEstimateTaskTime.requestEstimateTaskTime)
  const user = useQuery(api.queries.users.getCurrUser)

  const taskRows = useMemo(() => tasks ?? [], [tasks])

  const totalEstimatedMinutes = useMemo(
    () => taskRows.reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0),
    [taskRows]
  )

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [estimatingTasks, setEstimatingTasks] = useState<Set<Id<'tasks'>>>(new Set())
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

  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">

      {/* Modals */}
      {estimationError && (
        <EstimationErrorModal
          message={estimationError}
          onClose={() => setEstimationError(null)}
        />
      )}
      {editingTask && (
        <EditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveEdit}
        />
      )}
      {deletingTask && (
        <DeleteModal
          task={deletingTask}
          onClose={() => setDeletingTask(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
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
          <StatCard
            label="Tasks This Week"
            value={taskRows.length}
            dotColorClass="bg-success"
            subtitle="0 completed"
            subtitleColorClass="text-success"
          />
          <StatCard
            label="Estimated Minutes"
            value={totalEstimatedMinutes > 0 ? Math.round(totalEstimatedMinutes) : '—'}
            dotColorClass="bg-sky-blue"
            subtitle="AI estimated"
            subtitleColorClass="text-sky-blue"
          />
          <StatCard
            variant="accent"
            label="Study Streak"
            value={7}
            dotColorClass="bg-teal"
            subtitle="days in a row"
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
                {taskRows.map((task, i) => {
                  const key = task.taskType?.toLowerCase().replace(/\s+/g, '') ?? ''
                  return (
                    <TaskCard
                      key={task._id}
                      title={displayTitle(task)}
                      dueDate={formatDateMMDDYYYY(task.dueDate)}
                      taskType={task.taskType}
                      description={task.description}
                      timeEstimate={task.timeEstimate}
                      barColorClass={BAR_COLORS[i % BAR_COLORS.length]}
                      badgeVariant={badgeVariant(key)}
                      isEstimating={estimatingTasks.has(task._id)}
                      onEdit={() => setEditingTask(task)}
                      onDelete={() => setDeletingTask(task)}
                      onEstimate={() => handleEstimateTask(task._id)}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* Schedule Column */}
          <aside className="flex w-[300px] shrink-0 flex-col gap-4">
            <h2 className="text-base font-bold font-heading text-navy">Today's Schedule</h2>

            <ScheduleBlock
              variant="active"
              time="9:00 AM – 10:30 AM"
              taskName="Calculus Problem Set 5"
              duration="1.5 hrs · Focus block"
            />

            {[
              { time: '2:00 PM – 3:00 PM',  task: 'History Essay',        dur: '1 hr · Focus block' },
              { time: '6:00 PM – 7:00 PM',  task: 'Chemistry Lab Report', dur: '1 hr · Focus block' },
            ].map(({ time, task, dur }) => (
              <ScheduleBlock key={time} time={time} taskName={task} duration={dur} />
            ))}

            <GeminiChip />
          </aside>
        </div>
      </main>
    </div>
  )
}

