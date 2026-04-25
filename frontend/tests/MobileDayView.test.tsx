import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import MobileDayView from '../src/components/schedule/MobileDayView'

function makeDays(anchorDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchorDate)
    d.setDate(anchorDate.getDate() + i)
    return d
  })
}

const baseProps = {
  workHoursGrid: null,
  studyBlocksByDay: {},
  allDayEventsByDay: {},
  layoutByDay: {},
  highlightedSlots: new Set<string>(),
  isAssignMode: false,
  calendarConnected: false,
  onPrevBoundary: vi.fn(),
  onNextBoundary: vi.fn(),
  onSlotClick: vi.fn(),
  onMoveBlock: vi.fn(),
  onAutoReschedule: vi.fn(),
  gridRef: createRef<HTMLDivElement>(),
}

describe('MobileDayView', () => {
  it('renders today by default when today is in the days array', () => {
    const today = new Date()
    const days = makeDays(today)
    render(<MobileDayView {...baseProps} days={days} />)

    const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    expect(screen.getByText(todayLabel)).toBeInTheDocument()
  })

  it('defaults to day 0 when today is not in the days array', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const days = makeDays(future)
    render(<MobileDayView {...baseProps} days={days} />)

    const day0Label = days[0].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    expect(screen.getByText(day0Label)).toBeInTheDocument()
  })

  it('advances to the next day when Next is clicked', async () => {
    const today = new Date()
    const days = makeDays(today)
    render(<MobileDayView {...baseProps} days={days} />)

    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))

    const nextDayLabel = days[1].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    expect(screen.getByText(nextDayLabel)).toBeInTheDocument()
  })

  it('goes back to the previous day when Prev is clicked', async () => {
    const today = new Date()
    const days = makeDays(today)
    render(<MobileDayView {...baseProps} days={days} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))

    const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    expect(screen.getByText(todayLabel)).toBeInTheDocument()
  })

  it('calls onPrevBoundary when navigating before the first day', async () => {
    const onPrevBoundary = vi.fn()
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const days = makeDays(future)
    render(<MobileDayView {...baseProps} days={days} onPrevBoundary={onPrevBoundary} />)

    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(onPrevBoundary).toHaveBeenCalledTimes(1)
  })

  it('calls onNextBoundary when navigating past the last day', async () => {
    const onNextBoundary = vi.fn()
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const days = makeDays(future)
    render(<MobileDayView {...baseProps} days={days} onNextBoundary={onNextBoundary} />)

    for (let i = 0; i < 6; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next day' }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(onNextBoundary).toHaveBeenCalledTimes(1)
  })
})
