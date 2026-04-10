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
  const scheduleTaskAction = useAction(api.actions.scheduleTask.scheduleTask)
  const scheduleAllTasksAction = useAction(api.actions.scheduleAllTasks.scheduleAllTasks)

  const [schedulingBlockIds, setSchedulingBlockIds] = useState<Set<Id<'studyBlocks'>>>(new Set())
  const [isSchedulingAll, setIsSchedulingAll] = useState(false)

  async function handleScheduleBlock(blockId: Id<'studyBlocks'>, taskId: Id<'tasks'>) {
    setSchedulingBlockIds((prev) => new Set(prev).add(blockId))
    try {
      await scheduleTaskAction({ taskId, timezone, studyBlockId: blockId })
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
            aria-label="Schedule all unscheduled blocks"
          >
            {isSchedulingAll && <SpinnerIcon color="currentColor" size={10} />}
            Schedule All
          </button>
        )}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-border bg-white px-3 py-3 text-[11px] text-light-blue">
          All blocks scheduled.
        </div>
      ) : (
        blocks.map((block) => {
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
                <span className="text-[10px] text-light-blue truncate">{block.taskTitle}</span>
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
                  handleScheduleBlock(block._id, block.taskId)
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
        })
      )}
    </aside>
  )
}
