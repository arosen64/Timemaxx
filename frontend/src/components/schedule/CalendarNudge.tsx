import { CalendarIcon, XIcon } from '../icons'

type Props = {
  onConnect: () => void
  onScheduleAnyway: () => void
  onDismiss: () => void
}

export default function CalendarNudge({ onConnect, onScheduleAnyway, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40"
      onClick={onDismiss}
    >
      <div
        className="w-[420px] rounded-xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <CalendarIcon color="#0077D8" size={20} />
            <span className="font-heading text-base font-bold text-navy">Connect Google Calendar</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-7 w-7 items-center justify-center rounded text-light-blue hover:bg-bg-gray hover:text-slate-blue transition"
            aria-label="Dismiss"
          >
            <XIcon color="currentColor" size={14} />
          </button>
        </div>

        {/* Body */}
        <p className="px-5 pb-5 pt-3 font-body text-sm text-slate-blue">
          Connect Google Calendar to avoid scheduling conflicts with your existing events.
        </p>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4">
          <button
            type="button"
            onClick={onScheduleAnyway}
            className="flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 font-heading text-sm font-semibold text-navy hover:bg-bg-gray transition"
          >
            Schedule Anyway
          </button>
          <button
            type="button"
            onClick={onConnect}
            className="flex h-10 items-center justify-center rounded-lg bg-navy px-4 font-heading text-sm font-semibold text-white hover:bg-navy/90 transition"
          >
            Connect Calendar
          </button>
        </div>
      </div>
    </div>
  )
}
