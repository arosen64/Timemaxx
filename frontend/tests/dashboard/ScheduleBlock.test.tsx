import { screen } from '@testing-library/react'
import { renderWithProviders } from '../utils'
import ScheduleBlock, { type UpcomingBlock } from '../../src/components/dashboard/ScheduleBlock'

const MOCK_BLOCK: UpcomingBlock = {
  _id: 'block1',
  title: 'Study Session',
  startTime: '2026-03-29T14:00:00.000Z',
  studyBlockLength: 60,
  taskTitle: 'Calculus Problem Set',
  taskDueDate: new Date('2026-04-01').getTime(),
}

describe('ScheduleBlock', () => {
  it('renders the block title', () => {
    renderWithProviders(<ScheduleBlock block={MOCK_BLOCK} isFirst={false} />)
    expect(screen.getByText('Study Session')).toBeInTheDocument()
  })

  it('renders the duration', () => {
    renderWithProviders(<ScheduleBlock block={MOCK_BLOCK} isFirst={false} />)
    expect(screen.getByText(/60 min/)).toBeInTheDocument()
  })

  it('renders the time range', () => {
    renderWithProviders(<ScheduleBlock block={MOCK_BLOCK} isFirst={false} />)
    expect(screen.getByText(/–/)).toBeInTheDocument()
  })

  it('applies navy background when isFirst is true', () => {
    const { container } = renderWithProviders(<ScheduleBlock block={MOCK_BLOCK} isFirst={true} />)
    expect(container.firstChild).toHaveClass('bg-navy')
  })

  it('applies white background when isFirst is false', () => {
    const { container } = renderWithProviders(<ScheduleBlock block={MOCK_BLOCK} isFirst={false} />)
    expect(container.firstChild).toHaveClass('bg-white')
  })
})
