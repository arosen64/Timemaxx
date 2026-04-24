import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ScheduleTab from '../src/components/schedule/ScheduleTab'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      calendar: { getScheduleData: 'getScheduleData' },
      studyBlocks: { getAllStudyBlocksWithTasks: 'getAllStudyBlocksWithTasks' },
    },
    mutations: {
      calendar: { saveSelectedCalendars: 'saveSelectedCalendars' },
      studyBlocks: {
        runDetectConflicts: 'runDetectConflicts',
        editStudyBlockTime: 'editStudyBlockTime',
      },
    },
    actions: {
      fetchCalendarEvents: { fetchCalendarEvents: 'fetchCalendarEvents' },
      autoRescheduleConflicts: { autoRescheduleConflicts: 'autoRescheduleConflicts' },
      exportStudyBlocksToCalendar: { exportStudyBlocksToCalendar: 'exportStudyBlocksToCalendar' },
      scheduleBlock: { scheduleBlock: 'scheduleBlock' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

import { useQuery, useMutation, useAction } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WORK_HOURS_GRID = [
  { day: 'Monday', available: [18, 19], blocked: [] },
  { day: 'Tuesday', available: [], blocked: [] },
  { day: 'Wednesday', available: [], blocked: [] },
  { day: 'Thursday', available: [], blocked: [] },
  { day: 'Friday', available: [], blocked: [] },
  { day: 'Saturday', available: [], blocked: [] },
  { day: 'Sunday', available: [], blocked: [] },
]

const BASE_SCHEDULE = {
  workHoursGrid: WORK_HOURS_GRID,
  calendarConnected: false,
  selectedCalendarIds: null,
}

const todayAt10am = new Date()
todayAt10am.setHours(10, 0, 0, 0)

const UNSCHEDULED_BLOCK = {
  _id: 'block1',
  taskId: 'task1',
  title: 'Read Chapter 3',
  startTime: undefined,
  studyBlockLength: 60,
  isConflicted: undefined,
  taskTitle: 'History Essay',
  taskDueDate: Date.now() + 86400000 * 7,
}

const CONFLICTED_BLOCK = {
  _id: 'block2',
  taskId: 'task2',
  title: 'Study Session',
  startTime: todayAt10am.toISOString(),
  studyBlockLength: 60,
  isConflicted: true,
  taskTitle: 'Math Exam',
  taskDueDate: Date.now() + 86400000 * 7,
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

function makeQueryImpl(scheduleData: object, studyBlocks: unknown[] = []) {
  return (...args: Parameters<typeof useQuery>) => {
    if ((args[0] as unknown) === 'getAllStudyBlocksWithTasks') return studyBlocks as never
    return scheduleData as never
  }
}

function setupWithBlocks(studyBlocks: unknown[]) {
  mockUseQuery.mockImplementation(makeQueryImpl(BASE_SCHEDULE, studyBlocks))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(
    makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: false }) as never,
  )
  renderWithProviders(<ScheduleTab />)
}

function setupWithConflictBlock(autoRescheduleResult: object | 'reject') {
  mockUseQuery.mockImplementation(makeQueryImpl(BASE_SCHEDULE, [CONFLICTED_BLOCK]))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockImplementation((actionRef: unknown) => {
    if (actionRef === 'autoRescheduleConflicts') {
      return autoRescheduleResult === 'reject'
        ? vi.fn().mockRejectedValue(new Error('network error'))
        : vi.fn().mockResolvedValue(autoRescheduleResult)
    }
    return makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: false }) as never
  })
  renderWithProviders(<ScheduleTab />)
}

function setupCalendarError() {
  mockUseQuery.mockImplementation(makeQueryImpl({
    ...BASE_SCHEDULE,
    calendarConnected: true,
    selectedCalendarIds: ['cal1'],
  }))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(
    makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: true }) as never,
  )
  renderWithProviders(<ScheduleTab />)
}

// ── Unscheduled block tray ────────────────────────────────────────────────────

describe('ScheduleTab – Unscheduled block tray', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "All blocks scheduled." when there are no unscheduled blocks', () => {
    setupWithBlocks([])
    expect(screen.getByText('All blocks scheduled.')).toBeInTheDocument()
  })

  it('renders unscheduled block title, duration, and task name in the tray', () => {
    setupWithBlocks([UNSCHEDULED_BLOCK])
    expect(screen.getByText('Read Chapter 3')).toBeInTheDocument()
    expect(screen.getByText('60 min')).toBeInTheDocument()
    expect(screen.getByText('History Essay')).toBeInTheDocument()
  })

  it('shows "Assign mode" banner when a tray block is clicked', async () => {
    const user = userEvent.setup()
    setupWithBlocks([UNSCHEDULED_BLOCK])

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))
    expect(screen.getByText('Assign mode')).toBeInTheDocument()
  })

  it('hides "Assign mode" banner when the same tray block is clicked again', async () => {
    const user = userEvent.setup()
    setupWithBlocks([UNSCHEDULED_BLOCK])

    const trayBtn = screen.getByRole('button', { name: /Read Chapter 3/i })
    await user.click(trayBtn)
    expect(screen.getByText('Assign mode')).toBeInTheDocument()

    await user.click(trayBtn)
    expect(screen.queryByText('Assign mode')).not.toBeInTheDocument()
  })

  it('pressing Escape cancels assign mode', async () => {
    const user = userEvent.setup()
    setupWithBlocks([UNSCHEDULED_BLOCK])

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))
    expect(screen.getByText('Assign mode')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Assign mode')).not.toBeInTheDocument()
  })
})

// ── Calendar error banner ─────────────────────────────────────────────────────

describe('ScheduleTab – Calendar error banner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows error banner when calendar events fail to load', async () => {
    setupCalendarError()
    await waitFor(() => {
      expect(screen.getByText(/Calendar events unavailable/)).toBeInTheDocument()
    })
  })
})

// ── Auto-reschedule messages ──────────────────────────────────────────────────

describe('ScheduleTab – Auto-reschedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "All conflicts resolved." when all blocks are placed', async () => {
    const user = userEvent.setup()
    setupWithConflictBlock({ unplacedCount: 0 })

    await user.click(screen.getByTitle('Auto-reschedule'))
    await waitFor(() => {
      expect(screen.getByText('All conflicts resolved.')).toBeInTheDocument()
    })
  })

  it('uses singular "block" when exactly one block could not be placed', async () => {
    const user = userEvent.setup()
    setupWithConflictBlock({ unplacedCount: 1 })

    await user.click(screen.getByTitle('Auto-reschedule'))
    await waitFor(() => {
      expect(screen.getByText(/1 block could not be placed/)).toBeInTheDocument()
    })
  })

  it('uses plural "blocks" when multiple blocks could not be placed', async () => {
    const user = userEvent.setup()
    setupWithConflictBlock({ unplacedCount: 3 })

    await user.click(screen.getByTitle('Auto-reschedule'))
    await waitFor(() => {
      expect(screen.getByText(/3 blocks could not be placed/)).toBeInTheDocument()
    })
  })

  it('shows error message when auto-reschedule throws', async () => {
    const user = userEvent.setup()
    setupWithConflictBlock('reject')

    await user.click(screen.getByTitle('Auto-reschedule'))
    await waitFor(() => {
      expect(screen.getByText('Auto-reschedule failed. Please try again.')).toBeInTheDocument()
    })
  })

  it('dismiss button removes the auto-reschedule message', async () => {
    const user = userEvent.setup()
    setupWithConflictBlock({ unplacedCount: 0 })

    await user.click(screen.getByTitle('Auto-reschedule'))
    await waitFor(() => expect(screen.getByText('All conflicts resolved.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByText('All conflicts resolved.')).not.toBeInTheDocument()
  })
})

// ── Export to GCal ────────────────────────────────────────────────────────────

function setupWithExport(exportResult: object | 'reject', calendarConnected = true) {
  mockUseQuery.mockImplementation(makeQueryImpl({
    ...BASE_SCHEDULE,
    calendarConnected,
    selectedCalendarIds: calendarConnected ? ['cal1'] : null,
  }, []))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockImplementation((actionRef: unknown) => {
    if (actionRef === 'exportStudyBlocksToCalendar') {
      return exportResult === 'reject'
        ? vi.fn().mockRejectedValue(new Error('token expired'))
        : vi.fn().mockResolvedValue(exportResult)
    }
    return makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: false }) as never
  })
  renderWithProviders(<ScheduleTab />)
}

describe('ScheduleTab – Export to GCal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not render Export button when calendar is not connected', () => {
    mockUseQuery.mockImplementation(makeQueryImpl(BASE_SCHEDULE, []))
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<ScheduleTab />)

    expect(screen.queryByRole('button', { name: /Export to GCal/i })).not.toBeInTheDocument()
  })

  it('renders Export button when calendar is connected', () => {
    setupWithExport({ exported: 0, patched: 0 })
    expect(screen.getByRole('button', { name: /Export to GCal/i })).toBeInTheDocument()
  })

  it('shows correct message when new blocks are exported', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 3, patched: 0 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText('3 blocks exported.')).toBeInTheDocument()
    })
  })

  it('uses singular "block" when exactly one block is exported', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 1, patched: 0 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText('1 block exported.')).toBeInTheDocument()
    })
  })

  it('shows correct message when existing blocks are patched', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 0, patched: 2 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText('2 updated.')).toBeInTheDocument()
    })
  })

  it('shows combined message when blocks are both exported and patched', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 2, patched: 1 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText('2 blocks exported, 1 updated.')).toBeInTheDocument()
    })
  })

  it('shows "Nothing to export." when no blocks need syncing', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 0, patched: 0 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText('Nothing to export.')).toBeInTheDocument()
    })
  })

  it('shows error message when export action throws', async () => {
    const user = userEvent.setup()
    setupWithExport('reject')

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => {
      expect(screen.getByText(/Export failed:/)).toBeInTheDocument()
    })
  })

  it('dismiss button removes the export message', async () => {
    const user = userEvent.setup()
    setupWithExport({ exported: 1, patched: 0 })

    await user.click(screen.getByRole('button', { name: /Export to GCal/i }))
    await waitFor(() => expect(screen.getByText('1 block exported.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByText('1 block exported.')).not.toBeInTheDocument()
  })
})
