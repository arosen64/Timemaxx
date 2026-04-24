import { useQuery } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { formatDateMMDDYYYY } from './types'

type TaskSummary = {
  taskId: string
  taskTitle: string
  taskDueDate: number
  total: number
  completed: number
  firstBlockTime: number
}

function buildTodaysSummary(
  allBlocks: Array<{
    _id: string
    taskId: string
    taskTitle: string
    taskDueDate: number
    startTime?: string
    studyBlockLength: number
  }>,
): TaskSummary[] {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartMs = todayStart.getTime()
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000

  const summaryMap = new Map<string, TaskSummary>()

  for (const block of allBlocks) {
    if (!block.startTime) continue
    const startMs = new Date(block.startTime).getTime()
    if (startMs < todayStartMs || startMs >= todayEndMs) continue

    const blockEndMs = startMs + block.studyBlockLength * 60 * 1000
    const isCompleted = blockEndMs <= now
    const existing = summaryMap.get(block.taskId)

    if (existing) {
      existing.total++
      if (isCompleted) existing.completed++
      if (startMs < existing.firstBlockTime) existing.firstBlockTime = startMs
    } else {
      summaryMap.set(block.taskId, {
        taskId: block.taskId,
        taskTitle: block.taskTitle,
        taskDueDate: block.taskDueDate,
        total: 1,
        completed: isCompleted ? 1 : 0,
        firstBlockTime: startMs,
      })
    }
  }

  return [...summaryMap.values()].sort((a, b) => a.firstBlockTime - b.firstBlockTime)
}

function TaskProgressCard({ summary }: { summary: TaskSummary }) {
  const { taskTitle, taskDueDate, total, completed } = summary
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
    </div>
  )
}

export default function UpcomingSchedulePanel() {
  const allBlocks = useQuery(api.queries.studyBlocks.getAllStudyBlocksWithTasks)

  const taskSummaries: TaskSummary[] | undefined =
    allBlocks === undefined ? undefined : buildTodaysSummary(allBlocks as Parameters<typeof buildTodaysSummary>[0])

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
          <TaskProgressCard key={summary.taskId} summary={summary} />
        ))
      )}

    </aside>
  )
}
