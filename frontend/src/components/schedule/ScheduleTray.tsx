import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import { CalendarIcon, SpinnerIcon } from '../icons'

type TrayBlock = {
  _id: Id<'studyBlocks'>
  taskId: Id<'tasks'>
  title: string
  studyBlockLength: number
  taskTitle: string
  taskDueDate: number
  courseColor?: string
  courseName?: string
}

type Props = {
  blocks: TrayBlock[]
  assigningBlockId: Id<'studyBlocks'> | null
  onToggleAssign: (id: Id<'studyBlocks'>) => void
  timezone: string
  onScheduleAllMsg: (msg: string) => void
}

export default function ScheduleTray({
  blocks,
  assigningBlockId,
  onToggleAssign,
  timezone,
  onScheduleAllMsg,
}: Props) {
  const scheduleBlockAction = useAction(api.actions.scheduleBlock.scheduleBlock)
  const scheduleAllTasksAction = useAction(api.actions.scheduleAllTasks.scheduleAllTasks)

  const [schedulingBlockIds, setSchedulingBlockIds] = useState<Set<Id<'studyBlocks'>>>(new Set())
  const [isSchedulingAll, setIsSchedulingAll] = useState(false)

  async function handleScheduleBlock(blockId: Id<'studyBlocks'>) {
    setSchedulingBlockIds((prev) => new Set(prev).add(blockId))
    try {
      await scheduleBlockAction({ studyBlockId: blockId, timezone })
    } finally {
      setSchedulingBlockIds((prev) => {
        const next = new Set(prev)
        next.delete(blockId)
        return next
      })
    }
  }

  async function handleScheduleAll() {
    setIsSchedulingAll(true)
    try {
      const result = await scheduleAllTasksAction({ timezone })
      onScheduleAllMsg(
        result.skipped === 0
          ? `All ${result.scheduled} block${result.scheduled !== 1 ? 's' : ''} scheduled.`
          : `${result.scheduled} scheduled, ${result.skipped} skipped.`
      )
    } catch {
      onScheduleAllMsg('Scheduling failed. Please try again.')
    } finally {
      setIsSchedulingAll(false)
    }
  }

  // Group blocks by parent task, preserving the incoming due-date sort order
  const groupedByTask = (() => {
    const order: Id<'tasks'>[] = []
    const map = new Map<Id<'tasks'>, { taskTitle: string; taskDueDate: number; courseColor?: string; blocks: TrayBlock[] }>()
    for (const block of blocks) {
      if (!map.has(block.taskId)) {
        order.push(block.taskId)
        map.set(block.taskId, { taskTitle: block.taskTitle, taskDueDate: block.taskDueDate, courseColor: block.courseColor, blocks: [] })
      }
      map.get(block.taskId)!.blocks.push(block)
    }
    return order.map((id) => ({ taskId: id, ...map.get(id)! }))
  })()

  const renderBlock = (block: TrayBlock) => {
    const isSelected = assigningBlockId === block._id
    const isBlockScheduling = schedulingBlockIds.has(block._id)
    return (
      <div
        key={block._id}
        role="button"
        tabIndex={0}
        onClick={() => onToggleAssign(block._id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleAssign(block._id)
          }
        }}
        className={`group relative flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition cursor-pointer ${
          isSelected
            ? 'border-teal bg-teal/10 shadow-sm'
            : 'border-border bg-white hover:border-teal/50 hover:bg-teal/5'
        }`}
      >
        <span
          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: block.courseColor ?? '#002D72' }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="block truncate font-heading text-[11px] font-semibold text-navy">
            {block.title}
          </span>
          <span className="text-[10px] text-slate-blue">{block.studyBlockLength} min</span>
          {block.courseName && (
            <span className="hidden group-hover:block truncate font-body text-[10px] font-medium text-teal">
              {block.courseName}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleScheduleBlock(block._id)
          }}
          disabled={isBlockScheduling}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-blue opacity-0 transition hover:bg-navy/10 hover:text-navy group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Auto-schedule this block"
          title="Auto-schedule"
        >
          {isBlockScheduling
            ? <SpinnerIcon color="currentColor" size={10} />
            : <CalendarIcon color="currentColor" size={10} />
          }
        </button>
      </div>
    )
  }

  return (
    <aside className="flex w-[180px] shrink-0 flex-col gap-2 overflow-y-auto" data-tray>
      <div className="flex items-center justify-between gap-1">
        <h3 className="font-heading text-xs font-semibold text-navy">Unscheduled</h3>
        {blocks.length > 0 && (
          <button
            type="button"
            onClick={handleScheduleAll}
            disabled={isSchedulingAll}
            className="flex items-center gap-1 px-2 h-6 text-[10px] font-semibold font-heading rounded-md bg-navy text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            aria-label="Schedule unscheduled blocks"
          >
            {isSchedulingAll && <SpinnerIcon color="currentColor" size={10} />}
            Schedule
          </button>
        )}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-border bg-white px-3 py-3 text-[11px] text-light-blue">
          All blocks scheduled.
        </div>
      ) : (
        groupedByTask.map(({ taskId, taskTitle, taskDueDate, courseColor, blocks: taskBlocks }) => (
          <div key={taskId} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 px-0.5 pt-1">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: courseColor ?? '#002D72' }}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-heading text-[10px] font-semibold text-navy">
                  {taskTitle}
                </span>
                <span className="text-[9px] text-light-blue">
                  Due {new Date(taskDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            {taskBlocks.map(renderBlock)}
          </div>
        ))
      )}
    </aside>
  )
}
