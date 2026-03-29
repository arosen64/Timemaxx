import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleBlockConflict from '../src/components/schedule/ScheduleBlockConflict'

const STUDY_BLOCK_ID = 'block1' as any

const DEFAULT_PROPS = {
  title: 'Read Chapter 3',
  studyBlockId: STUDY_BLOCK_ID,
  startTime: new Date('2026-03-28T14:30:00').toISOString(),
  studyBlockLength: 90,
  onMove: vi.fn(),
  onAutoReschedule: vi.fn(),
}

describe('ScheduleBlockConflict', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the block title', () => {
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} />)
    expect(screen.getByText('Read Chapter 3')).toBeInTheDocument()
  })

  it('renders the study block duration', () => {
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} />)
    expect(screen.getByText(/90 min/)).toBeInTheDocument()
  })

  it('renders the formatted start time', () => {
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} />)
    // Time label is locale-formatted; verify it includes a time string
    expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument()
  })

  it('renders the "Conflict" badge', () => {
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} />)
    expect(screen.getByText('Conflict')).toBeInTheDocument()
  })

  it('calls onMove with the studyBlockId when Move is clicked', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} onMove={onMove} />)

    await user.click(screen.getByRole('button', { name: 'Move' }))
    expect(onMove).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledWith(STUDY_BLOCK_ID)
  })

  it('calls onAutoReschedule when the retry button is clicked', async () => {
    const user = userEvent.setup()
    const onAutoReschedule = vi.fn()
    render(<ScheduleBlockConflict {...DEFAULT_PROPS} onAutoReschedule={onAutoReschedule} />)

    await user.click(screen.getByTitle('Auto-reschedule'))
    expect(onAutoReschedule).toHaveBeenCalledOnce()
  })
})
