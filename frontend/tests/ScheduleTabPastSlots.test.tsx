/**
 * Tests that the ScheduleTab never allows a study block to be placed in the past.
 *
 * Clock is frozen at 2026-03-28T14:01:00Z.
 *
 * Date constants are chosen to be timezone-independent:
 * - YESTERDAY ('2026-03-27') slot 0 midnight is always in the past regardless
 *   of the test runner's local timezone (the latest UTC equivalent is noon UTC,
 *   still well before 14:01Z the next day).
 * - NEXT_WEEK ('2026-04-04') slot 0 is always in the future.
 *
 * Only `Date` is faked — setTimeout/setInterval/Promise are real so that
 * waitFor and async React updates work normally.
 */
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ScheduleTab from '../src/components/schedule/ScheduleTab'

// ── Convex mocks ─────────────────────────────────────────────────────────────

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
      scheduleAllBlocks: { scheduleAllBlocks: 'scheduleAllBlocks' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

// ── TimeGrid mock: captures highlighted slots and slot-interaction callbacks ──

vi.mock('../src/components/schedule/TimeGrid', () => ({
  default: vi.fn(),
}))

import { useQuery, useMutation, useAction } from 'convex/react'
import TimeGrid from '../src/components/schedule/TimeGrid'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)
const MockTimeGrid = vi.mocked(TimeGrid as any)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_NOW = new Date('2026-03-28T14:01:00.000Z')

// Yesterday: all 48 slots are guaranteed past in any timezone because even the
// last slot (23:30 local, UTC+ worst case UTC+14) ends at most 37.5h before
// FAKE_NOW, which is safely before 14:01Z on March 28.
const YESTERDAY = '2026-03-27'

// Next week: all slots are guaranteed future in any timezone.
const NEXT_WEEK = '2026-04-04'

// Task due date well past all test slots.
const FAR_FUTURE_DUE = new Date('2026-05-01T00:00:00.000Z').getTime()

const UNSCHEDULED_BLOCK = {
  _id: 'block1' as any,
  taskId: 'task1' as any,
  title: 'Read Chapter 3',
  startTime: undefined,
  studyBlockLength: 60,
  isConflicted: undefined,
  taskTitle: 'History Essay',
  taskDueDate: FAR_FUTURE_DUE,
}

const WORK_HOURS_GRID = [
  { day: 'Monday', available: [], blocked: [] },
  { day: 'Tuesday', available: [], blocked: [] },
  { day: 'Wednesday', available: [], blocked: [] },
  { day: 'Thursday', available: [], blocked: [] },
  { day: 'Friday', available: [], blocked: [] },
  { day: 'Saturday', available: [], blocked: [] },
  { day: 'Sunday', available: [], blocked: [] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

type CapturedGridProps = {
  highlightedSlots: Set<string>
  onSlotClick: (dateStr: string, slot: number) => void
  onDrop: (dateStr: string, slot: number) => void
}

function getCaptured(): CapturedGridProps {
  const lastCall = MockTimeGrid.mock.calls.at(-1)?.[0]
  if (!lastCall) throw new Error('TimeGrid was never rendered')
  return lastCall as CapturedGridProps
}

function setup(editMutation = makeMutationFn()) {
  mockUseQuery.mockImplementation((...args: Parameters<typeof useQuery>) => {
    if (args[0] === 'getAllStudyBlocksWithTasks') return [UNSCHEDULED_BLOCK] as never
    return { workHoursGrid: WORK_HOURS_GRID, calendarConnected: false, selectedCalendarIds: null } as never
  })
  mockUseMutation.mockReturnValue(editMutation as never)
  mockUseAction.mockReturnValue(
    makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: false }) as never,
  )
  renderWithProviders(<ScheduleTab />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScheduleTab – past-slot guards', () => {
  beforeEach(() => {
    // Only mock Date — leave setTimeout/setInterval/Promise real so waitFor works.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FAKE_NOW)
    vi.clearAllMocks()
    MockTimeGrid.mockImplementation(() => null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── highlightedSlots filtering ──────────────────────────────────────────────

  it('does not highlight any slot from yesterday when in assign mode', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))

    await waitFor(() => {
      const { highlightedSlots } = getCaptured()
      // No slot on yesterday's date should ever be highlighted.
      const yesterdaySlots = [...highlightedSlots].filter((k) => k.startsWith(`${YESTERDAY}:`))
      expect(yesterdaySlots).toHaveLength(0)
    })
  })

  it('highlights future slots from next week when in assign mode', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))

    await waitFor(() => {
      const { highlightedSlots } = getCaptured()
      const nextWeekSlots = [...highlightedSlots].filter((k) => k.startsWith(`${NEXT_WEEK}:`))
      expect(nextWeekSlots.length).toBeGreaterThan(0)
    })
  })

  it('every entry in highlightedSlots starts at or after Date.now()', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))

    await waitFor(() => {
      const { highlightedSlots } = getCaptured()
      expect(highlightedSlots.size).toBeGreaterThan(0)
      for (const key of highlightedSlots) {
        const [dateStr, slotStr] = key.split(':')
        const slotStartMs =
          new Date(`${dateStr}T00:00:00`).getTime() + Number(slotStr) * 30 * 60 * 1000
        expect(slotStartMs).toBeGreaterThanOrEqual(FAKE_NOW.getTime())
      }
    })
  })

  // ── handleSlotClick guard ──────────────────────────────────────────────────

  it('does not call editStudyBlockTime when onSlotClick is called with a past slot', async () => {
    const user = userEvent.setup()
    const editMutation = makeMutationFn()
    setup(editMutation)

    // Enter assign mode so assigningBlockId is non-null.
    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))
    await waitFor(() => expect(MockTimeGrid.mock.calls.length).toBeGreaterThan(1))

    // Call with yesterday's slot 0 — guaranteed past in any timezone.
    await act(async () => {
      await getCaptured().onSlotClick(YESTERDAY, 0)
    })

    expect(editMutation).not.toHaveBeenCalled()
  })

  it('calls editStudyBlockTime when onSlotClick is called with a future slot', async () => {
    const user = userEvent.setup()
    const editMutation = makeMutationFn()
    setup(editMutation)

    await user.click(screen.getByRole('button', { name: /Read Chapter 3/i }))
    await waitFor(() => expect(MockTimeGrid.mock.calls.length).toBeGreaterThan(1))

    // Call with next week slot 0 — guaranteed future in any timezone.
    await act(async () => {
      await getCaptured().onSlotClick(NEXT_WEEK, 0)
    })

    await waitFor(() => expect(editMutation).toHaveBeenCalledOnce())
    expect(editMutation).toHaveBeenCalledWith(
      expect.objectContaining({ studyBlockId: 'block1' }),
    )
  })

  // ── handleDrop guard ───────────────────────────────────────────────────────

  it('does not call editStudyBlockTime when onDrop is called with a past slot', async () => {
    const editMutation = makeMutationFn()
    setup(editMutation)

    await waitFor(() => expect(MockTimeGrid.mock.calls.length).toBeGreaterThan(0))

    // Call with yesterday's slot 0 — guaranteed past in any timezone.
    await act(async () => {
      await getCaptured().onDrop(YESTERDAY, 0)
    })

    expect(editMutation).not.toHaveBeenCalled()
  })

  it('does not call editStudyBlockTime when onDrop is called with yesterday slot 47', async () => {
    // Slot 47 is 23:30 local — the latest slot of the day.
    const editMutation = makeMutationFn()
    setup(editMutation)

    await waitFor(() => expect(MockTimeGrid.mock.calls.length).toBeGreaterThan(0))

    await act(async () => {
      await getCaptured().onDrop(YESTERDAY, 47)
    })

    expect(editMutation).not.toHaveBeenCalled()
  })
})
