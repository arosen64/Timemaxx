import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import AddTaskModal from '../components/AddTaskModal'
import Sidebar from '../components/sidebar'
import { Task, TaskFormData } from '../types'
import { formatDateMMDDYYYY, displayTitle } from '../utils/tasks'
import { PlusIcon, SparklesIcon } from '../components/icons/icons'
import { type BadgeVariant } from '../components/Badge'
import StatCard from '../components/StatCard'
import TaskCard from '../components/TaskCard'
import ScheduleBlock from '../components/ScheduleBlock'
import GeminiChip from '../components/GeminiChip'
import EditModal from '../components/EditModal'
import DeleteModal from '../components/DeleteModal'
import EstimationErrorModal from '../components/EstimationErrorModal'

const BAR_COLORS = ['bg-urgent-red', 'bg-sky-blue', 'bg-success']

/** Maps a normalized taskType key to a Badge variant. Falls back to 'notstarted'. */
function badgeVariant(taskTypeKey: string): BadgeVariant {
  if (taskTypeKey === 'urgent') return 'urgent'
  if (taskTypeKey === 'inprogress') return 'inprogress'
  return 'notstarted'
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

  async function handleSaveEdit(form: TaskFormData) {
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
            <span className="text-teal"><PlusIcon /></span>
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
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-gray text-sky-blue">
                    <SparklesIcon />
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

