import NudgeModal from './NudgeModal'

type Props = {
  onConnect: () => void
  onScheduleAnyway: () => void
  onDismiss: () => void
  isConnecting?: boolean
  connectError?: string | null
}

export default function CalendarNudge({ onConnect, onScheduleAnyway, onDismiss, isConnecting, connectError }: Props) {
  return (
    <NudgeModal
      title="Connect Google Calendar"
      body={
        connectError
          ? connectError
          : 'Connect Google Calendar to avoid scheduling conflicts with your existing events.'
      }
      onDismiss={onDismiss}
      buttons={[
        { label: 'Schedule Anyway', onClick: onScheduleAnyway, variant: 'secondary' },
        { label: isConnecting ? 'Connecting…' : 'Connect Calendar', onClick: onConnect, variant: 'primary', disabled: isConnecting },
      ]}
    />
  )
}
