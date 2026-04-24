import { screen } from '@testing-library/react'
import { renderWithProviders } from '../utils'
import UpcomingSchedulePanel from '../../src/components/dashboard/UpcomingSchedulePanel'

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: { queries: { studyBlocks: { getAllStudyBlocksWithTasks: 'getAllStudyBlocksWithTasks' } } },
}))
vi.mock('convex/react', () => ({ useQuery: vi.fn() }))

import { useQuery } from 'convex/react'
const mockUseQuery = vi.mocked(useQuery)

// Build start times within today so blocks pass the today filter — use late-night times
// so the blocks are almost never "completed" (ended) during test runs
const todayMidnight = new Date()
todayMidnight.setHours(0, 0, 0, 0)
const block1Start = new Date(todayMidnight.getTime() + 22 * 60 * 60 * 1000).toISOString() // 22:00 today
const block2Start = new Date(todayMidnight.getTime() + 23 * 60 * 60 * 1000).toISOString() // 23:00 today

const MOCK_BLOCKS = [
  {
    _id: 'b1',
    taskId: 'task1',
    title: 'Study Session A',
    startTime: block1Start,
    studyBlockLength: 60,
    taskTitle: 'Calculus',
    taskDueDate: new Date('2026-04-01').getTime(),
  },
  {
    _id: 'b2',
    taskId: 'task2',
    title: 'Study Session B',
    startTime: block2Start,
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

  it('shows "No study blocks today" when blocks is empty array', () => {
    mockUseQuery.mockReturnValue([] as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('No study blocks today')).toBeInTheDocument()
  })

  it('shows "No study blocks today" when all blocks are outside today', () => {
    const pastBlocks = [
      {
        _id: 'b1',
        taskId: 'task1',
        title: 'Old Session',
        startTime: '2020-01-01T14:00:00.000Z',
        studyBlockLength: 60,
        taskTitle: 'History',
        taskDueDate: new Date('2020-01-05').getTime(),
      },
    ]
    mockUseQuery.mockReturnValue(pastBlocks as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('No study blocks today')).toBeInTheDocument()
  })

  it('renders task titles grouped by task for today\'s blocks', () => {
    mockUseQuery.mockReturnValue(MOCK_BLOCKS as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    expect(screen.getByText('Calculus')).toBeInTheDocument()
    expect(screen.getByText('Biology')).toBeInTheDocument()
  })

  it('shows block progress for each task', () => {
    mockUseQuery.mockReturnValue(MOCK_BLOCKS as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    const progressLabels = screen.getAllByText(/\d+ \/ \d+ blocks done/)
    expect(progressLabels.length).toBe(2)
  })

  it('groups multiple blocks from the same task', () => {
    const sameTaskBlocks = [
      {
        _id: 'b1',
        taskId: 'task1',
        title: 'Block 1',
        startTime: block1Start,
        studyBlockLength: 60,
        taskTitle: 'Calculus',
        taskDueDate: new Date('2026-04-01').getTime(),
      },
      {
        _id: 'b2',
        taskId: 'task1',
        title: 'Block 2',
        startTime: block2Start,
        studyBlockLength: 30,
        taskTitle: 'Calculus',
        taskDueDate: new Date('2026-04-01').getTime(),
      },
    ]
    mockUseQuery.mockReturnValue(sameTaskBlocks as never)
    renderWithProviders(<UpcomingSchedulePanel />)
    // Only one task card for 'Calculus' (blocks grouped by task)
    expect(screen.getAllByText('Calculus')).toHaveLength(1)
    // Total is 2 regardless of how many have completed
    expect(screen.getByText(/\d+ \/ 2 blocks done/)).toBeInTheDocument()
  })

})
