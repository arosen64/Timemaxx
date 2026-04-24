import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { CalendarIcon, SpinnerIcon } from '../icons'

type Props = {
  disabled?: boolean
  overLimitWarning?: boolean
}

export default function ScheduleAllButton({ disabled, overLimitWarning }: Props) {
  const scheduleAllTasks = useAction(api.actions.scheduleAllBlocks.scheduleAllBlocks)
  const [isScheduling, setIsScheduling] = useState(false)
  const [result, setResult] = useState<{ scheduled: number; skipped: number } | null>(null)

  async function handleClick() {
    setIsScheduling(true)
    setResult(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const r = await scheduleAllTasks({ timezone })
      setResult(r)
    } finally {
      setIsScheduling(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {overLimitWarning && (
          <span className="text-xs text-yellow-600 font-semibold">Only 20 tasks scheduled at a time.</span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={isScheduling || disabled}
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold font-heading rounded-lg bg-navy text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Schedule tasks"
        >
          {isScheduling ? (
            <SpinnerIcon color="currentColor" size={13} />
          ) : (
            <CalendarIcon color="currentColor" size={13} />
          )}
          Schedule
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-navy flex items-center gap-4">
          <span>
            {result.skipped === 0
              ? `All ${result.scheduled} block${result.scheduled !== 1 ? 's' : ''} scheduled.`
              : `${result.scheduled} of ${result.scheduled + result.skipped} blocks scheduled, ${result.skipped} skipped.`}
          </span>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-slate-blue hover:text-navy text-xs font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
