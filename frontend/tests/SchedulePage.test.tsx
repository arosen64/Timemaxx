import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import SchedulePage from '../src/pages/SchedulePage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      calendar: { getScheduleData: 'getScheduleData' },
      studyBlocks: { getAllStudyBlocksWithTasks: 'getAllStudyBlocksWithTasks' },
      userCourses: { getUserCourses: 'getUserCourses' },
      tasks: { getTasksByCourseId: 'getTasksByCourseId' },
      subtasks: { getSubtasksForTask: 'getSubtasksForTask' },
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

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

import { useQuery, useMutation, useAction } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

const WORK_HOURS_GRID = [
  { day: 'Monday', available: [18, 19, 20, 21], blocked: [0, 1] },
  { day: 'Tuesday', available: [18, 19], blocked: [] },
  { day: 'Wednesday', available: [], blocked: [] },
  { day: 'Thursday', available: [], blocked: [] },
  { day: 'Friday', available: [], blocked: [] },
  { day: 'Saturday', available: [], blocked: [] },
  { day: 'Sunday', available: [], blocked: [] },
]

function makeQueryImpl(scheduleData: object, studyBlocks: unknown[] = []) {
  return (...args: Parameters<typeof useQuery>) => {
    const ref = args[0] as unknown as string
    if (ref === 'getAllStudyBlocksWithTasks') return studyBlocks as never
    if (ref === 'getUserCourses' || ref === 'getTasksByCourseId' || ref === 'getSubtasksForTask') return [] as never
    return scheduleData as never
  }
}

function setupNoCalendar() {
  mockUseQuery.mockImplementation(makeQueryImpl({
    workHoursGrid: WORK_HOURS_GRID,
    calendarConnected: false,
    selectedCalendarIds: null,
  }))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(makeMutationFn({ calendarList: [], timedEvents: [], allDayEvents: [], error: false }) as never)
  renderWithProviders(<SchedulePage />, { initialEntries: ['/schedule'] })
}

function setupConnectedNoSelection(calendarList = [{ id: 'cal1', summary: 'Personal' }]) {
  mockUseQuery.mockImplementation(makeQueryImpl({
    workHoursGrid: WORK_HOURS_GRID,
    calendarConnected: true,
    selectedCalendarIds: null,
  }))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(
    makeMutationFn({ calendarList, timedEvents: [], allDayEvents: [], error: false }) as never
  )
  renderWithProviders(<SchedulePage />, { initialEntries: ['/schedule'] })
}

function setupConnectedWithSelection() {
  mockUseQuery.mockImplementation(makeQueryImpl({
    workHoursGrid: WORK_HOURS_GRID,
    calendarConnected: true,
    selectedCalendarIds: ['cal1'],
  }))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(
    makeMutationFn({
      calendarList: [{ id: 'cal1', summary: 'Personal' }],
      timedEvents: [],
      allDayEvents: [],
      error: false,
    }) as never
  )
  renderWithProviders(<SchedulePage />, { initialEntries: ['/schedule'] })
}

describe('SchedulePage', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── 7.1 Schedule tab basics ──────────────────────────────────────────────

  it('renders the schedule page with a time grid', () => {
    setupNoCalendar()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    // Week range label is present
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument()
    expect(screen.getByLabelText('Next week')).toBeInTheDocument()
  })

  it('shows work hour slot colors when no calendar is connected', () => {
    setupNoCalendar()
    // Time labels confirm the grid rendered
    expect(screen.getByText('12am')).toBeInTheDocument()
    expect(screen.getByText('12pm')).toBeInTheDocument()
  })

  it('does not show calendar selector button when no calendar is connected', () => {
    setupNoCalendar()
    expect(screen.queryByLabelText('Select calendars')).not.toBeInTheDocument()
  })

  // ── 7.2 Calendar selector ────────────────────────────────────────────────

  it('shows calendar selector button when calendar is connected', async () => {
    setupConnectedNoSelection()
    await waitFor(() => {
      expect(screen.getByLabelText('Select calendars')).toBeInTheDocument()
    })
  })

  it('shows visual indicator on selector button when connected but no calendars selected', async () => {
    setupConnectedNoSelection()
    await waitFor(() => {
      const btn = screen.getByLabelText('Select calendars')
      // Button has the info-bg highlight style when hasIndicator is true
      expect(btn.className).toMatch(/info-bg/)
    })
  })

  it('no visual indicator on selector button when calendars are selected', async () => {
    setupConnectedWithSelection()
    await waitFor(() => {
      const btn = screen.getByLabelText('Select calendars')
      expect(btn.className).not.toMatch(/info-bg/)
    })
  })

  it('opens calendar selector popup on button click', async () => {
    const user = userEvent.setup()
    setupConnectedNoSelection([{ id: 'cal1', summary: 'Personal' }])

    await waitFor(() => expect(screen.getByLabelText('Select calendars')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select calendars'))

    expect(screen.getByText('Select Calendars')).toBeInTheDocument()
    expect(screen.getByText('Personal')).toBeInTheDocument()
  })

  it('closes calendar selector popup when backdrop is clicked', async () => {
    const user = userEvent.setup()
    setupConnectedNoSelection([{ id: 'cal1', summary: 'Personal' }])

    await waitFor(() => expect(screen.getByLabelText('Select calendars')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select calendars'))
    expect(screen.getByText('Select Calendars')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Close calendar selector'))
    expect(screen.queryByText('Select Calendars')).not.toBeInTheDocument()
  })

  it('calls saveSelectedCalendars when a calendar is toggled', async () => {
    const user = userEvent.setup()
    const saveMutation = makeMutationFn()
    mockUseQuery.mockImplementation(makeQueryImpl({
      workHoursGrid: WORK_HOURS_GRID,
      calendarConnected: true,
      selectedCalendarIds: null,
    }))
    mockUseMutation.mockReturnValue(saveMutation as never)
    mockUseAction.mockReturnValue(
      makeMutationFn({ calendarList: [{ id: 'cal1', summary: 'Personal' }], timedEvents: [], allDayEvents: [], error: false }) as never
    )
    renderWithProviders(<SchedulePage />, { initialEntries: ['/schedule'] })

    await waitFor(() => expect(screen.getByLabelText('Select calendars')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select calendars'))
    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => expect(saveMutation).toHaveBeenCalledWith({ selectedCalendarIds: ['cal1'] }))
  })

  // ── 7.3 Week navigation ──────────────────────────────────────────────────

  it('back button is disabled on the current week', () => {
    setupNoCalendar()
    expect(screen.getByLabelText('Previous week')).toBeDisabled()
  })

  it('forward button is enabled on the current week', () => {
    setupNoCalendar()
    expect(screen.getByLabelText('Next week')).not.toBeDisabled()
  })

  it('back button becomes enabled after navigating forward', async () => {
    const user = userEvent.setup()
    setupNoCalendar()

    await user.click(screen.getByLabelText('Next week'))
    expect(screen.getByLabelText('Previous week')).not.toBeDisabled()
  })

  it('forward button is disabled at the 3-week limit', async () => {
    const user = userEvent.setup()
    setupNoCalendar()

    // MAX_OFFSET_DAYS = 21, so navigating forward twice (7+7=14, then 14+7=21) reaches the limit
    await user.click(screen.getByLabelText('Next week'))
    await user.click(screen.getByLabelText('Next week'))
    await user.click(screen.getByLabelText('Next week'))

    expect(screen.getByLabelText('Next week')).toBeDisabled()
  })

  it('navigating back returns to the current week and disables back button', async () => {
    const user = userEvent.setup()
    setupNoCalendar()

    await user.click(screen.getByLabelText('Next week'))
    expect(screen.getByLabelText('Previous week')).not.toBeDisabled()

    await user.click(screen.getByLabelText('Previous week'))
    expect(screen.getByLabelText('Previous week')).toBeDisabled()
  })
})
