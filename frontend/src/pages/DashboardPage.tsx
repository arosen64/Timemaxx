import { useMemo, useState, type ReactNode } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'

type TaskType = {
  _id: Id<'tasks'>
  title: string
  description: string
  taskType: string
  timeEstimate: number
  createdAt: number
}

type EditForm = {
  title: string
  description: string
  taskType: string
  timeEstimate: number
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return '—'
  if (hours === 1) return '1 hr'
  return `${trimTrailingZeros(hours)} hrs`
}

function trimTrailingZeros(n: number) {
  const s = n.toFixed(2)
  return s.replace(/\.?0+$/, '')
}

function displayTitle(task: Pick<TaskType, 'title' | 'description'>) {
  const t = task.title.trim()
  if (t.length > 0) return t
  const d = task.description.trim()
  return d.length > 0 ? d : 'Untitled task'
}

const BAR_COLORS = ['bg-[#CF4520]', 'bg-sky-blue', 'bg-[#008767]']

const BADGE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  urgent:     { bg: 'bg-[#FFF0EC]', text: 'text-[#CF4520]', label: 'Urgent' },
  inprogress: { bg: 'bg-[#EBF5FF]', text: 'text-[#0077D8]', label: 'In Progress' },
  default:    { bg: 'bg-[#E6F5F0]', text: 'text-[#008767]', label: 'Not Started' },
}

const TASK_TYPE_OPTIONS = ['Assignment', 'Essay', 'Lab Report', 'Problem Set', 'Reading', 'Project', 'Other']

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({
  task,
  onClose,
  onSave,
}: {
  task: TaskType
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    taskType: task.taskType,
    timeEstimate: String(task.timeEstimate), // store as string while editing
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({
      ...form,
      timeEstimate: parseFloat(form.timeEstimate) || 0.5, // parse only on save
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md p-8 bg-white border shadow-xl rounded-xl border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-heading text-navy">Edit Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-blue hover:bg-bg-gray"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold font-heading text-navy">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="h-10 px-3 text-sm border rounded-lg border-border bg-bg-gray text-navy placeholder:text-light-blue focus:border-sky-blue focus:outline-none focus:ring-1 focus:ring-sky-blue"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold font-heading text-navy">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="px-3 py-2 text-sm border rounded-lg resize-none border-border bg-bg-gray text-navy placeholder:text-light-blue focus:border-sky-blue focus:outline-none focus:ring-1 focus:ring-sky-blue"
              placeholder="Task description"
            />
          </div>

          {/* Task Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold font-heading text-navy">Task Type</label>
            <select
              value={form.taskType}
              onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
              className="h-10 px-3 text-sm border rounded-lg border-border bg-bg-gray text-navy focus:border-sky-blue focus:outline-none focus:ring-1 focus:ring-sky-blue"
            >
              {TASK_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Time Estimate */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold font-heading text-navy">
              Time Estimate (hours)
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.timeEstimate}
              onChange={e => setForm(f => ({ ...f, timeEstimate: e.target.value }))}
              onBlur={e => {
                // clean up on blur: clamp to 0.5 minimum, strip leading zeros
                const parsed = parseFloat(e.target.value)
                setForm(f => ({ ...f, timeEstimate: String(Math.max(0.5, parsed || 0.5)) }))
              }}
              className="h-10 px-3 text-sm border rounded-lg border-border bg-bg-gray text-navy focus:border-sky-blue focus:outline-none focus:ring-1 focus:ring-sky-blue"
            />
          </div>
        </div>

        {/* Actions */}
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
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 text-sm font-semibold text-white transition rounded-lg bg-navy font-heading hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
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
  task: TaskType
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // TODO: revert to getTasks once auth (#20) is complete
  const tasks = useQuery(api.queries.tasks.getAllTasks) as TaskType[] | undefined
  const updateTask = useMutation(api.mutations.tasks.updateTask)
  const deleteTask = useMutation(api.mutations.tasks.deleteTask)

  const taskRows = useMemo(() => tasks ?? [], [tasks])

  const totalEstimatedHours = useMemo(
    () => taskRows.reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0),
    [taskRows]
  )

  const [editingTask, setEditingTask] = useState<TaskType | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null)

  async function handleSaveEdit(form: EditForm) {
    if (!editingTask) return
    await updateTask({ taskId: editingTask._id, ...form })
  }

  async function handleConfirmDelete() {
    if (!deletingTask) return
    await deleteTask({ taskId: deletingTask._id })
  }

  return (
    <div className="flex min-h-screen bg-bg-gray font-body text-slate-blue">

      {/* Modals */}
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

      {/* ── Sidebar ── */}
      <aside className="flex w-[260px] shrink-0 flex-col justify-between bg-navy px-6 py-8">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded shrink-0 bg-teal">
              <BookOpenIcon />
            </div>
            <span className="text-lg font-bold text-white font-heading">Timemaxx</span>
          </div>

          <nav className="flex flex-col gap-1">
            <div className="flex h-11 items-center gap-2.5 rounded-lg bg-white px-3.5">
              <LayoutDashboardIcon color="#002D72" />
              <span className="text-sm font-semibold font-heading text-navy">Dashboard</span>
            </div>
            {[
              { label: 'Tasks',    Icon: SquareIcon   },
              { label: 'Schedule', Icon: CalendarIcon },
              { label: 'Profile',  Icon: UserIcon     },
            ].map(({ label, Icon }) => (
              <div key={label} className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3.5">
                <Icon color="#68ACE5" />
                <span className="text-sm font-heading text-sky-blue">{label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-full h-9 w-9 shrink-0 bg-sky-blue">
            <span className="text-xs font-bold font-heading text-navy">AJ</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-[13px] font-semibold text-white">Alex Johnson</span>
            <span className="text-[11px] text-sky-blue">alex@jhu.edu</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 p-10 gap-7">

        {/* Page Header */}
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-[28px] font-bold text-navy">Good morning, Alex</h1>
            <p className="text-sm text-slate-blue">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}{' '}
              · {taskRows.length} task{taskRows.length !== 1 ? 's' : ''} due this week
            </p>
          </div>
          <button
            type="button"
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
            <span className="text-xs font-semibold text-slate-blue">Estimated Hours</span>
            <span className="font-heading text-[36px] font-bold leading-none text-navy">
              {totalEstimatedHours > 0 ? trimTrailingZeros(totalEstimatedHours) : '—'}
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
          <section className="flex flex-col flex-1 gap-4">
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
                      className="group flex items-center gap-3.5 rounded-[10px] border border-border bg-white px-[18px] py-4"
                    >
                      <div className={`h-10 w-1 shrink-0 rounded ${barColor}`} />

                      <div className="flex flex-col flex-1 min-w-0 gap-1">
                        <div className="text-sm font-semibold truncate font-heading text-navy">
                          {displayTitle(task)}
                        </div>
                        <div className="text-xs text-slate-blue">
                          {task.taskType} · ~{formatHours(task.timeEstimate)} estimated
                        </div>
                      </div>

                      <div className={`shrink-0 rounded px-2.5 py-1 ${badge.bg}`}>
                        <span className={`font-heading text-[11px] font-semibold ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Edit / Delete buttons — visible on hover */}
                      <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
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
              { time: '2:00 PM – 3:00 PM',  task: 'History Essay',        dur: '1 hr · Focus block' },
              { time: '6:00 PM – 7:00 PM',  task: 'Chemistry Lab Report', dur: '1 hr · Focus block' },
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

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconBase({
  children,
  color = 'currentColor',
  size = 16,
}: {
  children: ReactNode
  color?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#002D72" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function LayoutDashboardIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </IconBase>
  )
}

function SquareIcon({ color }: { color?: string }) {
  return <IconBase color={color}><rect width="18" height="18" x="3" y="3" rx="2" /></IconBase>
}

function CalendarIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </IconBase>
  )
}

function UserIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  )
}

function PlusIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </IconBase>
  )
}

function PencilIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </IconBase>
  )
}

function TrashIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </IconBase>
  )
}

function XIcon({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </IconBase>
  )
}

function SparklesIcon({ color, size }: { color?: string; size?: number }) {
  return (
    <IconBase color={color} size={size}>
      <path d="M9 3l1.7 4.3L15 9l-4.3 1.7L9 15l-1.7-4.3L3 9l4.3-1.7L9 3z" />
      <path d="M18 3l.8 2.1L21 6l-2.2.9L18 9l-.8-2.1L15 6l2.2-.9L18 3z" />
      <path d="M18 13l1 2.5L22 17l-3 1.2L18 21l-1-2.8L14 17l3-1.5L18 13z" />
    </IconBase>
  )
}