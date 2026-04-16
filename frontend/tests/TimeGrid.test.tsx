import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import TimeGrid from '../src/components/schedule/TimeGrid'
import type { StudyBlockOnGrid } from '../src/components/schedule/TimeGrid'
import type { Id } from '../../backend/convex/_generated/dataModel'

vi.mock('../src/components/schedule/ScheduleBlockConflict', () => ({
  default: ({ title }: { title: string }) => <div data-testid="conflict-block">{title}</div>,
}))

const DAY = new Date('2026-04-07T00:00:00')

function makeBlock(overrides: Partial<StudyBlockOnGrid> = {}): StudyBlockOnGrid {
  return {
    _id: 'sb1' as Id<'studyBlocks'>,
    taskId: 'task1' as Id<'tasks'>,
    title: 'Study Math',
    startTime: new Date('2026-04-07T10:00:00').toISOString(),
    studyBlockLength: 60,
    isConflicted: false,
    taskTitle: 'Math Exam',
    taskDueDate: Date.now() + 86400000,
    ...overrides,
  }
}

function setup(blockOverrides: Partial<StudyBlockOnGrid> = {}) {
  const block = makeBlock(blockOverrides)
  const gridRef = createRef<HTMLDivElement>()
  return render(
    <TimeGrid
      days={[DAY]}
      workHoursGrid={null}
      layoutByDay={{}}
      allDayEventsByDay={{}}
      calendarConnected={false}
      gridRef={gridRef as React.RefObject<HTMLDivElement>}
      studyBlocksByDay={{ '2026-04-07': [block] }}
      highlightedSlots={new Set()}
      isAssignMode={false}
      onSlotClick={vi.fn()}
      onMoveBlock={vi.fn()}
      onAutoReschedule={vi.fn()}
      draggingBlockId={null}
      onDragStart={vi.fn()}
      onDrop={vi.fn()}
    />
  )
}

// ── Today column helpers ──────────────────────────────────────────────────────

const TODAY = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()

function setupDays(days: Date[]) {
  const gridRef = createRef<HTMLDivElement>()
  return render(
    <TimeGrid
      days={days}
      workHoursGrid={null}
      layoutByDay={{}}
      allDayEventsByDay={{}}
      calendarConnected={false}
      gridRef={gridRef as React.RefObject<HTMLDivElement>}
      studyBlocksByDay={{}}
      highlightedSlots={new Set()}
      isAssignMode={false}
      onSlotClick={vi.fn()}
      onMoveBlock={vi.fn()}
      onAutoReschedule={vi.fn()}
      draggingBlockId={null}
      onDragStart={vi.fn()}
      onDrop={vi.fn()}
    />
  )
}

// ── Today column header ───────────────────────────────────────────────────────

describe('TimeGrid — today column header', () => {
  it('today header cell has navy background', () => {
    const { container } = setupDays([TODAY])
    expect(container.querySelector('.bg-navy')).toBeInTheDocument()
  })

  it('today header shows weekday abbreviation in teal', () => {
    setupDays([TODAY])
    const weekday = TODAY.toLocaleDateString('en-US', { weekday: 'short' })
    expect(screen.getByText(weekday)).toHaveClass('text-teal')
  })

  it('today header shows date with month in white text', () => {
    setupDays([TODAY])
    const expected = TODAY.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    expect(screen.getByText(expected)).toHaveClass('text-white')
  })

  it('non-today header does not have navy background', () => {
    const { container } = setupDays([DAY])
    expect(container.querySelector('.bg-navy')).not.toBeInTheDocument()
  })

  it('non-today header shows weekday in slate-blue', () => {
    setupDays([DAY])
    const weekday = DAY.toLocaleDateString('en-US', { weekday: 'short' })
    expect(screen.getByText(weekday)).toHaveClass('text-slate-blue')
  })
})

// ── Today slot background ─────────────────────────────────────────────────────

describe('TimeGrid — today slot background', () => {
  it('today column slot cells get bg-today-col class', () => {
    const { container } = setupDays([TODAY])
    expect(container.querySelector('.bg-today-col')).toBeInTheDocument()
  })

  it('non-today column slot cells do not get bg-today-col class', () => {
    const { container } = setupDays([DAY])
    expect(container.querySelector('.bg-today-col')).not.toBeInTheDocument()
  })
})

// ── Current time indicator ────────────────────────────────────────────────────

describe('TimeGrid — current time indicator', () => {
  it('renders the indicator dot when today is visible', () => {
    const { container } = setupDays([TODAY])
    expect(container.querySelector('.rounded-full.bg-urgent-red')).toBeInTheDocument()
  })

  it('renders the indicator line when today is visible', () => {
    const { container } = setupDays([TODAY])
    const lines = container.querySelectorAll('.bg-urgent-red:not(.rounded-full)')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('does not render the indicator when today is not in the visible week', () => {
    const { container } = setupDays([DAY])
    expect(container.querySelector('.bg-urgent-red')).not.toBeInTheDocument()
  })
})

// ── Study block color coding ──────────────────────────────────────────────────

describe('TimeGrid — study block color coding', () => {
  it('renders the block title', () => {
    setup()
    expect(screen.getByText('Study Math')).toBeInTheDocument()
  })

  it('applies courseColor as inline background style when provided', () => {
    setup({ courseColor: '#ff0000' })
    const blockEl = screen.getByText('Study Math').closest('.flex.h-full')
    expect(blockEl).toHaveStyle({ backgroundColor: '#ff0000' })
  })

  it('applies bg-navy class when no courseColor is provided', () => {
    setup({ courseColor: undefined })
    const blockEl = screen.getByText('Study Math').closest('.flex.h-full')
    expect(blockEl).toHaveClass('bg-navy')
  })

  it('does not apply bg-navy class when courseColor is set', () => {
    setup({ courseColor: '#3b82f6' })
    const blockEl = screen.getByText('Study Math').closest('.flex.h-full')
    expect(blockEl).not.toHaveClass('bg-navy')
  })

  it('renders a conflicted block via ScheduleBlockConflict instead of the colored div', () => {
    setup({ isConflicted: true })
    expect(screen.getByTestId('conflict-block')).toBeInTheDocument()
    expect(screen.queryByText('Study Math')?.closest('.flex.h-full')).toBeNull()
  })
})
