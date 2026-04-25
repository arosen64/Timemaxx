import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import { formatDateMMDDYYYY } from './types'

type BlockInfo = {
  _id: string
  title: string
  startTime: string
  studyBlockLength: number
  isCompleted: boolean
}

type TaskSummary = {
  taskId: string
  taskTitle: string
  taskDueDate: number
  total: number
  completed: number
  firstBlockTime: number
  blocks: BlockInfo[]
}

function formatTimeRange(startTime: string, lengthMinutes: number): string {
  const start = new Date(startTime)
  const end = new Date(start.getTime() + lengthMinutes * 60 * 1000)
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

function buildTodaysSummary(
  allBlocks: Array<{
    _id: string
    title: string
    taskId: string
    taskTitle: string
    taskDueDate: number
    startTime?: string
    studyBlockLength: number
    isCompleted: boolean
  }>,
): TaskSummary[] {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartMs = todayStart.getTime()
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000

  const summaryMap = new Map<string, TaskSummary>()

  for (const block of allBlocks) {
    if (!block.startTime) continue
    const startMs = new Date(block.startTime).getTime()
    if (startMs < todayStartMs || startMs >= todayEndMs) continue

    const existing = summaryMap.get(block.taskId)
    const blockInfo: BlockInfo = {
      _id: block._id,
      title: block.title,
      startTime: block.startTime,
      studyBlockLength: block.studyBlockLength,
      isCompleted: block.isCompleted,
    }

    if (existing) {
      existing.total++
      if (block.isCompleted) existing.completed++
      if (startMs < existing.firstBlockTime) existing.firstBlockTime = startMs
      existing.blocks.push(blockInfo)
    } else {
      summaryMap.set(block.taskId, {
        taskId: block.taskId,
        taskTitle: block.taskTitle,
        taskDueDate: block.taskDueDate,
        total: 1,
        completed: block.isCompleted ? 1 : 0,
        firstBlockTime: startMs,
        blocks: [blockInfo],
      })
    }
  }

  return [...summaryMap.values()]
    .map((s) => ({
      ...s,
      blocks: [...s.blocks].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      ),
    }))
    .sort((a, b) => a.firstBlockTime - b.firstBlockTime)
}

function TaskProgressCard({
  summary,
  onToggle,
}: {
  summary: TaskSummary
  onToggle: (id: string) => void
}) {
  const { taskTitle, taskDueDate, total, completed, blocks } = summary
  const progress = total > 0 ? (completed / total) * 100 : 0
  const allDone = completed === total

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-white py-4 px-[18px]">
      <span className="font-heading text-[13px] font-semibold text-navy">{taskTitle}</span>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${allDone ? 'text-success' : 'text-slate-blue'}`}>
          {completed} / {total} blocks done
        </span>
        <span className="text-xs text-slate-blue">Due {formatDateMMDDYYYY(taskDueDate)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-gray">
        <div
          className={`h-full rounded-full transition-all ${allDone ? 'bg-success' : 'bg-sky-blue'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
        {blocks.map((block) => (
          <div key={block._id} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span
                className={`truncate text-[11px] font-medium leading-tight ${block.isCompleted ? 'text-success line-through' : 'text-navy'}`}
              >
                {block.title}
              </span>
              <span className="text-[10px] text-slate-blue">
                {formatTimeRange(block.startTime, block.studyBlockLength)}
              </span>
            </div>
            <button
              onClick={() => onToggle(block._id)}
              aria-label={block.isCompleted ? 'Mark incomplete' : 'Mark complete'}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                block.isCompleted
                  ? 'border-success bg-success text-white'
                  : 'border-slate-blue bg-white text-transparent hover:border-sky-blue'
              }`}
            >
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <polyline points="2,6 5,9 10,3" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UpcomingSchedulePanel() {
  const allBlocks = useQuery(api.queries.studyBlocks.getAllStudyBlocksWithTasks)
  const toggleComplete = useMutation(api.mutations.studyBlocks.toggleStudyBlockComplete)

  const taskSummaries: TaskSummary[] | undefined =
    allBlocks === undefined
      ? undefined
      : buildTodaysSummary(allBlocks as Parameters<typeof buildTodaysSummary>[0])

  function handleToggle(studyBlockId: string) {
    toggleComplete({ studyBlockId: studyBlockId as Id<'studyBlocks'> })
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4">
      <h2 className="font-heading text-base font-bold text-navy">Today's Tasks</h2>

      {taskSummaries === undefined ? (
        <div className="rounded-[10px] border border-border bg-white p-5 text-sm text-slate-blue">
          Loading…
        </div>
      ) : taskSummaries.length === 0 ? (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-[18px]">
          <span className="font-heading text-[13px] font-semibold text-navy">No study blocks today</span>
          <span className="text-xs text-slate-blue">Head to the Schedule tab to assign study blocks.</span>
        </div>
      ) : (
        taskSummaries.map((summary) => (
          <TaskProgressCard key={summary.taskId} summary={summary} onToggle={handleToggle} />
        ))
      )}
    </aside>
  )
}
