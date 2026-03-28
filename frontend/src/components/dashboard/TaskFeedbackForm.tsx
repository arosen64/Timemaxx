import { type TaskType, type FeedbackDraft, formatMinutes } from './types'

type TaskFeedbackFormProps = {
  task: Pick<TaskType, 'estimateFeedbackRating' | 'correctedEstimateMinutes'>
  draft: FeedbackDraft
  error?: string
  isSubmitting: boolean
  isEditing: boolean
  onToggleRating: (value: 'up' | 'down') => void
  onHoursChange: (value: string) => void
  onMinutesChange: (value: string) => void
  onSubmit: () => void
  onStartEdit: () => void
}

export default function TaskFeedbackForm({
  task,
  draft,
  error,
  isSubmitting,
  isEditing,
  onToggleRating,
  onHoursChange,
  onMinutesChange,
  onSubmit,
  onStartEdit,
}: TaskFeedbackFormProps) {
  if (task.estimateFeedbackRating && !isEditing) {
    return (
      <div className="w-full flex flex-col items-end gap-1.5">
        <div className="text-right text-[11px] text-light-blue">
          Feedback: {task.estimateFeedbackRating === 'up' ? 'helpful' : 'improve'}
          {task.correctedEstimateMinutes !== undefined
            ? ` · actual ${formatMinutes(task.correctedEstimateMinutes)}`
            : ''}
          <button
            type="button"
            onClick={onStartEdit}
            className="ml-1 text-[11px] text-light-blue hover:underline cursor-pointer select-none"
          >
            (<span className="text-sky-blue">edit</span>)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-light-blue">Time estimate helpful?</span>
        <button
          type="button"
          onClick={() => onToggleRating('up')}
          className={`rounded px-2 py-1 text-xs transition ${
            draft.rating === 'up' ? 'bg-sky-blue/20 text-navy' : 'text-slate-blue hover:bg-bg-gray'
          }`}
          aria-label="Rate estimate thumbs up"
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => onToggleRating('down')}
          className={`rounded px-2 py-1 text-xs transition ${
            draft.rating === 'down' ? 'bg-sky-blue/20 text-navy' : 'text-slate-blue hover:bg-bg-gray'
          }`}
          aria-label="Rate estimate thumbs down"
        >
          👎
        </button>
      </div>
      {draft.rating && (
        <>
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[11px] text-light-blue">Actual time taken</span>
            <input
              type="number"
              min={0}
              placeholder="hrs"
              value={draft.hours}
              onChange={(e) => onHoursChange(e.target.value)}
              className="w-10 px-1.5 text-[11px] bg-white border rounded outline-none h-6 border-border text-navy"
            />
            <input
              type="number"
              min={0}
              placeholder="mins"
              value={draft.minutes}
              onChange={(e) => onMinutesChange(e.target.value)}
              className="w-12 px-1.5 text-[11px] bg-white border rounded outline-none h-6 border-border text-navy"
            />
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="h-7 rounded border border-border px-2.5 text-[11px] font-medium text-slate-blue transition hover:bg-bg-gray disabled:opacity-60"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
      {error && (
        <div className="w-full text-right text-[11px] text-urgent-red">{error}</div>
      )}
    </div>
  )
}
