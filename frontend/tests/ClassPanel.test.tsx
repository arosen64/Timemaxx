import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ClassPanel from '../src/components/schedule/ClassPanel'
import type { Id } from '../../backend/convex/_generated/dataModel'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      userCourses: { getUserCourses: 'getUserCourses' },
      tasks: { getTasksByCourseId: 'getTasksByCourseId' },
      subtasks: { getSubtasksForTask: 'getSubtasksForTask' },
    },
    mutations: {
      studyBlocks: { splitStudyBlock: 'splitStudyBlock' },
    },
    actions: {
      scheduleBlock: { scheduleBlock: 'scheduleBlock' },
      scheduleAllBlocks: { scheduleAllBlocks: 'scheduleAllBlocks' },
    },
    mutations: {
      studyBlocks: { splitStudyBlock: 'splitStudyBlock' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useAction: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useAction, useMutation } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseAction = vi.mocked(useAction)
const mockUseMutation = vi.mocked(useMutation)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COURSE = {
  _id: 'course1' as Id<'userCourses'>,
  title: 'Algorithms',
  courseCode: 'CS-601',
  term: 'Spring 2026',
  color: '#002D72',
}

const TASK = {
  _id: 'task1' as Id<'tasks'>,
  title: 'Homework 1',
  dueDate: Date.now() + 86400000 * 3,
  status: 'not_started',
}

const BLOCK = {
  _id: 'block1' as Id<'studyBlocks'>,
  taskId: 'task1' as Id<'tasks'>,
  title: 'Study Session 1',
  studyBlockLength: 60,
  taskTitle: 'Homework 1',
  taskDueDate: TASK.dueDate,
}

const SUBTASK = {
  _id: 'sub1' as Id<'subtasks'>,
  title: 'Read chapter 1',
  timeEstimate: 30,
}

const SUBTASK_BLOCK = {
  _id: 'block2' as Id<'studyBlocks'>,
  taskId: 'task1' as Id<'tasks'>,
  subtaskId: 'sub1' as Id<'subtasks'>,
  title: 'Study Session 2',
  studyBlockLength: 30,
  taskTitle: 'Homework 1',
  taskDueDate: TASK.dueDate,
}

const DEFAULT_PROPS = {
  unscheduledBlocks: [BLOCK],
  assigningBlockId: null,
  onToggleAssign: vi.fn(),
  timezone: 'UTC',
  onScheduleAllMsg: vi.fn(),
}

// ── Mock setup helpers ────────────────────────────────────────────────────────

function setupQueries({
  courses = [COURSE],
  tasks = [TASK],
  subtasks = [] as typeof SUBTASK[],
} = {}) {
  mockUseQuery.mockImplementation((...args: Parameters<typeof useQuery>) => {
    const ref = args[0] as unknown as string
    const queryArgs = args[1]
    if (queryArgs === 'skip') return undefined as never
    if (ref === 'getUserCourses') return courses as never
    if (ref === 'getTasksByCourseId') return tasks as never
    if (ref === 'getSubtasksForTask') return subtasks as never
    return undefined as never
  })
}

function setupMutations() {
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
}

function setupActions({
  scheduleAllResult = { scheduled: 1, skipped: 0, conflicted: 0 } as { scheduled: number; skipped: number; conflicted: number },
  scheduleAllRejects = false,
} = {}) {
  const scheduleAllMock = scheduleAllRejects
    ? vi.fn().mockRejectedValue(new Error('network error'))
    : vi.fn().mockResolvedValue(scheduleAllResult)
  const scheduleBlockMock = makeMutationFn()

  mockUseAction.mockImplementation((actionRef: unknown) => {
    const ref = actionRef as string
    if (ref === 'scheduleAllBlocks') return scheduleAllMock as never
    return scheduleBlockMock as never
  })

  mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined) as never)

  return { scheduleAllMock, scheduleBlockMock }
}

/** Drill down: render → click course → click task → arrive at level 2. */
async function drillToTaskDetail(
  user: ReturnType<typeof userEvent.setup>,
  props = DEFAULT_PROPS,
) {
  renderWithProviders(<ClassPanel {...props} />)
  await user.click(screen.getByText('Algorithms'))
  await user.click(screen.getByText('Homework 1'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setupMutations()
})

describe('ClassPanel – Level 0 (class list)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutations()
    setupActions()
  })

  it('shows a loading spinner while courses are loading', () => {
    mockUseQuery.mockReturnValue(undefined as never)
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    // spinner is present, no course names visible
    expect(screen.queryByText('Algorithms')).not.toBeInTheDocument()
  })

  it('renders course names filtered to the current term', () => {
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Algorithms')).toBeInTheDocument()
    expect(screen.getByText('CS-601')).toBeInTheDocument()
  })

  it('always renders the Other tasks bucket', () => {
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Other tasks')).toBeInTheDocument()
  })

  it('shows "No current classes" when no courses for the current term', () => {
    setupQueries({ courses: [] })
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('No current classes.')).toBeInTheDocument()
  })

  it('navigates to task list when a course is clicked', async () => {
    const user = userEvent.setup()
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Algorithms'))
    expect(screen.getByText('Homework 1')).toBeInTheDocument()
  })
})

describe('ClassPanel – Level 1 (task list)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupActions()
  })

  it('shows tasks for the selected course', async () => {
    const user = userEvent.setup()
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Algorithms'))
    expect(screen.getByText('Homework 1')).toBeInTheDocument()
  })

  it('shows "No tasks for this class" when task list is empty', async () => {
    const user = userEvent.setup()
    setupQueries({ tasks: [] })
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Algorithms'))
    expect(screen.getByText('No tasks for this class.')).toBeInTheDocument()
  })

  it('back button returns to class list', async () => {
    const user = userEvent.setup()
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Algorithms'))
    await user.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Algorithms')).toBeInTheDocument()
    expect(screen.queryByText('Homework 1')).not.toBeInTheDocument()
  })

  it('navigates to task detail when a task is clicked', async () => {
    const user = userEvent.setup()
    setupQueries()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    await user.click(screen.getByText('Algorithms'))
    await user.click(screen.getByText('Homework 1'))
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument()
  })
})

describe('ClassPanel – Level 2 (task detail)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows task-level blocks under "General Blocks"', async () => {
    const user = userEvent.setup()
    setupQueries()
    setupActions()
    await drillToTaskDetail(user)
    expect(screen.getByText('GENERAL BLOCKS')).toBeInTheDocument()
    expect(screen.getByText('Study Session 1')).toBeInTheDocument()
  })

  it('shows subtask blocks grouped under their subtask', async () => {
    const user = userEvent.setup()
    setupQueries({ subtasks: [SUBTASK] })
    setupActions()
    const props = { ...DEFAULT_PROPS, unscheduledBlocks: [SUBTASK_BLOCK] }
    await drillToTaskDetail(user, props)
    expect(screen.getByText('Read chapter 1')).toBeInTheDocument()
    expect(screen.getByText('Study Session 2')).toBeInTheDocument()
  })

  it('shows "No subtasks or unscheduled blocks" when task has none', async () => {
    const user = userEvent.setup()
    setupQueries()
    setupActions()
    const props = { ...DEFAULT_PROPS, unscheduledBlocks: [] }
    await drillToTaskDetail(user, props)
    expect(screen.getByText('No subtasks or unscheduled blocks.')).toBeInTheDocument()
  })

  it('disables Schedule button when no unscheduled blocks for the task', async () => {
    const user = userEvent.setup()
    setupQueries()
    setupActions()
    const props = { ...DEFAULT_PROPS, unscheduledBlocks: [] }
    await drillToTaskDetail(user, props)
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled()
  })

  it('back button returns to task list', async () => {
    const user = userEvent.setup()
    setupQueries()
    setupActions()
    await drillToTaskDetail(user)
    await user.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Homework 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schedule' })).not.toBeInTheDocument()
  })
})

describe('ClassPanel – Schedule button (scheduleAllBlocks wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls scheduleAllBlocks with the selected taskId and timezone', async () => {
    const user = userEvent.setup()
    setupQueries()
    const { scheduleAllMock } = setupActions({ scheduleAllResult: { scheduled: 1, skipped: 0, conflicted: 0 } })
    await drillToTaskDetail(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(scheduleAllMock).toHaveBeenCalledWith({ taskId: 'task1', timezone: 'UTC' })
  })

  it('shows "All N blocks scheduled." when all blocks are placed', async () => {
    const user = userEvent.setup()
    setupQueries()
    const onMsg = vi.fn()
    setupActions({ scheduleAllResult: { scheduled: 3, skipped: 0, conflicted: 0 } })
    await drillToTaskDetail(user, { ...DEFAULT_PROPS, onScheduleAllMsg: onMsg })
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(onMsg).toHaveBeenCalledWith('All 3 blocks scheduled.'))
  })

  it('uses singular "block" when exactly one block is scheduled', async () => {
    const user = userEvent.setup()
    setupQueries()
    const onMsg = vi.fn()
    setupActions({ scheduleAllResult: { scheduled: 1, skipped: 0, conflicted: 0 } })
    await drillToTaskDetail(user, { ...DEFAULT_PROPS, onScheduleAllMsg: onMsg })
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(onMsg).toHaveBeenCalledWith('All 1 block scheduled.'))
  })

  it('shows partial count message when some blocks are skipped', async () => {
    const user = userEvent.setup()
    setupQueries()
    const onMsg = vi.fn()
    setupActions({ scheduleAllResult: { scheduled: 2, skipped: 1, conflicted: 0 } })
    await drillToTaskDetail(user, { ...DEFAULT_PROPS, onScheduleAllMsg: onMsg })
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(onMsg).toHaveBeenCalledWith('2 scheduled, 1 skipped.'))
  })

  it('shows error message when scheduleAllBlocks throws', async () => {
    const user = userEvent.setup()
    setupQueries()
    const onMsg = vi.fn()
    setupActions({ scheduleAllRejects: true })
    await drillToTaskDetail(user, { ...DEFAULT_PROPS, onScheduleAllMsg: onMsg })
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() =>
      expect(onMsg).toHaveBeenCalledWith('Scheduling failed: network error')
    )
  })

  it('appends conflicted note when some blocks need auto-reschedule', async () => {
    const user = userEvent.setup()
    setupQueries()
    const onMsg = vi.fn()
    setupActions({ scheduleAllResult: { scheduled: 2, skipped: 0, conflicted: 1 } })
    await drillToTaskDetail(user, { ...DEFAULT_PROPS, onScheduleAllMsg: onMsg })
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() =>
      expect(onMsg).toHaveBeenCalledWith('All 2 blocks scheduled. 1 conflicted block needs auto-reschedule.')
    )
  })

  it('does not call scheduleAllBlocks if no task is selected', () => {
    setupQueries()
    const { scheduleAllMock } = setupActions()
    renderWithProviders(<ClassPanel {...DEFAULT_PROPS} />)
    // Still on level 0 — schedule button not present
    expect(screen.queryByRole('button', { name: 'Schedule' })).not.toBeInTheDocument()
    expect(scheduleAllMock).not.toHaveBeenCalled()
  })
})
