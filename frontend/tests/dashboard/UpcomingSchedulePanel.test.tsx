import { screen } from '@testing-library/react'
import { renderWithProviders } from '../utils'
import UpcomingSchedulePanel from '../../src/components/dashboard/UpcomingSchedulePanel'

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: { queries: { studyBlocks: { getUpcomingStudyBlocks: 'getUpcomingStudyBlocks' } } },
}))
vi.mock('convex/react', () => ({ useQuery: vi.fn() }))

import { useQuery } from 'convex/react'
const mockUseQuery = vi.mocked(useQuery)

const MOCK_BLOCKS = [
  {
    _id: 'b1',
    title: 'Study Session A',
    startTime: '2026-03-29T14:00:00.000Z',
    studyBlockLength: 60,
    taskTitle: 'Calculus',
    taskDueDate: new Date('2026-04-01').getTime(),
  },
  {
    _id: 'b2',
    title: 'Study Session B',
    startTime: '2026-03-29T16:00:00.000Z',
    studyBlockLength: 30,
    taskTitle: 'Biology',
    taskDueDate: new Date('2026-04-02').getTime(),
  },
]

describe('UpcomingSchedulePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Loading…" when blocks are undefined', () => {
    mockUseQuery.mockReturnValue(undefined as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows "No blocks in the next 24 hours" when blocks is empty array', () => {
    mockUseQuery.mockReturnValue([] as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('No blocks in the next 24 hours')).toBeInTheDocument()
  })

  it('renders a ScheduleBlock for each block', () => {
    mockUseQuery.mockReturnValue(MOCK_BLOCKS as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('Study Session A')).toBeInTheDocument()
    expect(screen.getByText('Study Session B')).toBeInTheDocument()
  })

  it('renders "Powered by Google Gemini" footer', () => {
    mockUseQuery.mockReturnValue([] as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('Powered by Google Gemini')).toBeInTheDocument()
  })
})
