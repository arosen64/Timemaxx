import { useMemo, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'

type TaskType = {
  _id: string
  title: string
  description: string
  taskType: string
  timeEstimate: number
  createdAt: number
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

export default function DashboardPage() {
  const tasks = useQuery(api.queries.tasks.getTasks) as TaskType[] | undefined

  const taskRows = useMemo(() => tasks ?? [], [tasks])

  return (
    <div className="min-h-screen bg-bg-gray font-body text-slate-blue">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="flex w-[260px] flex-col justify-between bg-navy px-6 py-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-teal">
                <BookOpenIcon />
              </div>
              <span className="font-heading text-lg font-bold text-white">
                Timemaxx
              </span>
            </div>

            <nav className="flex flex-col gap-1">
              <div className="flex h-11 items-center gap-2.5 rounded-lg bg-white px-3.5">
                <LayoutDashboardIcon className="text-navy" />
                <span className="font-heading text-sm font-semibold text-navy">
                  Dashboard
                </span>
              </div>
              <div className="flex h-11 items-center gap-2.5 rounded-lg px-3.5">
                <SquareIcon className="text-sky-blue" />
                <span className="font-heading text-sm text-sky-blue">Tasks</span>
              </div>
              <div className="flex h-11 items-center gap-2.5 rounded-lg px-3.5">
                <CalendarIcon className="text-sky-blue" />
                <span className="font-heading text-sm text-sky-blue">
                  Schedule
                </span>
              </div>
              <div className="flex h-11 items-center gap-2.5 rounded-lg px-3.5">
                <UserIcon className="text-sky-blue" />
                <span className="font-heading text-sm text-sky-blue">
                  Profile
                </span>
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-blue font-heading text-xs font-bold text-navy">
              AJ
            </div>
            <div className="flex flex-col leading-tight">
              <div className="font-heading text-[13px] font-semibold text-white">
                Alex Johnson
              </div>
              <div className="text-[11px] text-sky-blue">alex@jhu.edu</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-10">
          <header className="mb-7 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-2xl font-bold text-navy">
                Dashboard
              </h1>
              <p className="text-sm text-slate-blue">
                Your tasks and estimates at a glance.
              </p>
            </div>

            <button
              type="button"
              className="flex h-11 items-center gap-2 rounded-lg bg-navy px-5 font-heading text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-blue focus:ring-offset-2"
            >
              <PlusIcon className="text-teal" />
              Add Task
            </button>
          </header>

          <div className="flex w-full gap-6">
            {/* Upcoming Tasks */}
            <section className="flex-1">
              <h2 className="mb-4 font-heading text-base font-bold text-navy">
                Upcoming Tasks
              </h2>

              {tasks === undefined ? (
                <div className="rounded-[10px] border border-border bg-white p-5">
                  Loading tasks…
                </div>
              ) : taskRows.length === 0 ? (
                <div className="rounded-[10px] border border-border bg-white p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-gray">
                      <SparklesIcon className="text-sky-blue" />
                    </div>
                    <div>
                      <div className="font-heading text-sm font-semibold text-navy">
                        No tasks yet
                      </div>
                      <div className="mt-1 text-sm text-slate-blue">
                        Add your first task to get an AI time estimate and a
                        personalized schedule.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {taskRows.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-3.5 rounded-[10px] border border-border bg-white px-[18px] py-4"
                    >
                      <div className="h-10 w-1 rounded bg-sky-blue" />

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="truncate font-heading text-sm font-semibold text-navy">
                          {displayTitle(task)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-blue">
                          <span className="rounded bg-bg-gray px-2 py-0.5">
                            {task.taskType}
                          </span>
                          <span className="text-light-blue">·</span>
                          <span className="text-slate-blue">
                            ~{formatHours(task.timeEstimate)} estimated
                          </span>
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-xs text-light-blue sm:block">
                        {formatHours(task.timeEstimate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right column (design placeholder) */}
            <aside className="w-[300px]">
              <h2 className="mb-4 font-heading text-base font-bold text-navy">
                Today&apos;s Schedule
              </h2>
              <div className="rounded-[10px] border border-border bg-white p-5">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="text-sky-blue" />
                  <span className="text-sm text-slate-blue">
                    Schedule coming soon.
                  </span>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-bg-gray px-3.5 py-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-blue">
                  <SparklesIcon className="text-sky-blue" />
                  Powered by Google Gemini
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

function IconBase({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#002D72"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function LayoutDashboardIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </IconBase>
  )
}

function SquareIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </IconBase>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </IconBase>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconBase>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M9 3l1.7 4.3L15 9l-4.3 1.7L9 15l-1.7-4.3L3 9l4.3-1.7L9 3z" />
      <path d="M18 3l.8 2.1L21 6l-2.2.9L18 9l-.8-2.1L15 6l2.2-.9L18 3z" />
      <path d="M18 13l1 2.5L22 17l-3 1.2L18 21l-1-2.8L14 17l3-1.5L18 13z" />
    </IconBase>
  )
}
