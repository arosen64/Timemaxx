import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import TimeGrid from '../src/components/schedule/TimeGrid'
import type { StudyBlockOnGrid } from '../src/components/schedule/TimeGrid'
import type { Id } from '../../../backend/convex/_generated/dataModel'

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
