import NudgeModal from './NudgeModal'

type Props = {
  onScheduleAnyway: () => void
  onSelectCalendars: () => void
  onDismiss: () => void
}

export default function NoCalendarNudge({ onScheduleAnyway, onSelectCalendars, onDismiss }: Props) {
  return (
    <NudgeModal
      title="No Calendar Selected"
      body="You haven't selected which Google calendars to display. Pick your calendars so existing events appear on the schedule — or schedule anyway."
      onDismiss={onDismiss}
      buttons={[
        { label: 'Schedule Anyway', onClick: onScheduleAnyway, variant: 'secondary' },
        { label: 'Select Calendars', onClick: onSelectCalendars, variant: 'primary' },
      ]}
    />
  )
}
