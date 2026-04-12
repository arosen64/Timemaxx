import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import type React from 'react'
import TaskCard from '../../src/components/dashboard/TaskCard'

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: {
    queries: { studyBlocks: { getStudyBlocksByTask: 'getStudyBlocksByTask' } },
    mutations: { studyBlocks: { deleteStudyBlocksForTask: 'deleteStudyBlocksForTask' } },
  },
}))
vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn() }))

import { useQuery, useMutation } from 'convex/react'
const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)

const MOCK_TASK = {
  _id: 'task1' as any,
  title: 'Calculus Problem Set',
  description: 'Chapter 5 problems',
  taskType: 'Problem Set',
  timeEstimate: 90,
  isManualEstimate: false,
  dueDate: new Date('2026-04-01T23:59:00').getTime(),
  createdAt: Date.now(),
}

const DEFAULT_FEEDBACK = {
  draft: { rating: undefined as 'up' | 'down' | undefined, hours: '', minutes: '' },
  error: undefined as string | undefined,
  isSubmitting: false,
  isEditing: false,
  onToggleRating: vi.fn(),
  onHoursChange: vi.fn(),
  onMinutesChange: vi.fn(),
  onSubmit: vi.fn(),
  onStartEdit: vi.fn(),
}

function makeBlock(id: string, overrides: object = {}) {
  return {
    _id: id,
    title: `Study Block ${id}`,
    startTime: undefined,
    studyBlockLength: 60,
    ...overrides,
  }
}

function setup(overrides: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  const props = {
    task: MOCK_TASK,
    barColor: 'bg-red-500',
    isEstimating: false,
    feedback: DEFAULT_FEEDBACK,
    onStatusChange: vi.fn(),
    onEstimate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<TaskCard {...props} />)
  return props
}

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue([] as never)
    mockUseMutation.mockReturnValue(vi.fn() as never)
  })

  it('renders task title', () => {
    setup()
    expect(screen.getByText('Calculus Problem Set')).toBeInTheDocument()
  })

  it('renders task description', () => {
    setup()
    expect(screen.getByText('Chapter 5 problems')).toBeInTheDocument()
  })

  it('shows status dropdown with default not-started label', () => {
    setup()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })

  it('renders formatted time estimate "1h 30m"', () => {
    setup()
    expect(screen.getByText(/1h 30m/i)).toBeInTheDocument()
  })

  it('shows sparkle estimate button when timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    expect(screen.getByRole('button', { name: 'Estimate task time' })).toBeInTheDocument()
  })

  it('hides sparkle estimate button when timeEstimate is defined', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Estimate task time' })).not.toBeInTheDocument()
  })

  it('shows spinner (no sparkle button) when isEstimating is true and timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined }, isEstimating: true })
    expect(screen.queryByRole('button', { name: 'Estimate task time' })).not.toBeInTheDocument()
  })

  it('calls onEstimate when sparkle button clicked', async () => {
    const user = userEvent.setup()
    const props = setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    await user.click(screen.getByRole('button', { name: 'Estimate task time' }))
    expect(props.onEstimate).toHaveBeenCalledTimes(1)
  })

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    expect(props.onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(props.onDelete).toHaveBeenCalledTimes(1)
  })

  it('renders TaskFeedbackForm (thumbs-up button) when timeEstimate is defined', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs up' })).toBeInTheDocument()
  })

  it('does not render TaskFeedbackForm when timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    expect(screen.queryByRole('button', { name: 'Rate estimate thumbs up' })).not.toBeInTheDocument()
  })

  it('renders TaskFeedbackForm when task has subtasks and rollup estimate is ready', () => {
    setup({
      task: { ...MOCK_TASK, timeEstimate: 90 },
      subtasks: [
        {
          _id: 'sub1' as any,
          parentTaskId: MOCK_TASK._id,
          title: 'A',
          description: 'd',
          taskType: 'Problem Set',
          color: '#2563eb',
          timeEstimate: 45,
          order: 0,
          createdAt: Date.now(),
        },
        {
          _id: 'sub2' as any,
          parentTaskId: MOCK_TASK._id,
          title: 'B',
          description: 'd',
          taskType: 'Problem Set',
          color: '#2563eb',
          timeEstimate: 45,
          order: 1,
          createdAt: Date.now(),
        },
      ],
      estimatingSubtasks: new Set(),
    })
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs up' })).toBeInTheDocument()
  })

  it('does not render TaskFeedbackForm while a subtask is still estimating', () => {
    setup({
      task: { ...MOCK_TASK, timeEstimate: 45 },
      subtasks: [
        {
          _id: 'sub1' as any,
          parentTaskId: MOCK_TASK._id,
          title: 'A',
          description: 'd',
          taskType: 'Problem Set',
          color: '#2563eb',
          timeEstimate: undefined,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      estimatingSubtasks: new Set(['sub1' as any]),
    })
    expect(screen.queryByRole('button', { name: 'Rate estimate thumbs up' })).not.toBeInTheDocument()
  })

  // --- Expand / collapse ---
  // JSDOM does not compute CSS, so we check the panel's class directly
  // rather than toBeVisible(), which can't understand grid-rows-[0fr] overflow-hidden.

  function getPanel(container: HTMLElement) {
    return container.querySelector('[class*="transition-all"]') as HTMLElement
  }

  it('panel has grid-rows-[0fr] class by default (collapsed)', () => {
    mockUseQuery.mockReturnValue([makeBlock('b1')] as never)
    const { container } = renderWithProviders(
      <TaskCard
        task={MOCK_TASK}
        barColor="bg-red-500"
        onStatusChange={vi.fn()}
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(getPanel(container).className).toContain('grid-rows-[0fr]')
  })

  it('clicking the card switches panel to grid-rows-[1fr] (expanded)', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([makeBlock('b1')] as never)
    const { container } = renderWithProviders(
      <TaskCard
        task={MOCK_TASK}
        barColor="bg-red-500"
        onStatusChange={vi.fn()}
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    await user.click(screen.getByText('Calculus Problem Set'))
    expect(getPanel(container).className).toContain('grid-rows-[1fr]')
  })

  it('clicking the card again collapses the panel back to grid-rows-[0fr]', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([makeBlock('b1')] as never)
    const { container } = renderWithProviders(
      <TaskCard
        task={MOCK_TASK}
        barColor="bg-red-500"
        onStatusChange={vi.fn()}
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const title = screen.getByText('Calculus Problem Set')
    await user.click(title)
    await user.click(title)
    expect(getPanel(container).className).toContain('grid-rows-[0fr]')
  })

  it('two separate card instances expand independently', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([makeBlock('bA')] as never)

    const { container: c1 } = renderWithProviders(
      <TaskCard
        task={{ ...MOCK_TASK, _id: 'task-a' as any, title: 'Task A' }}
        barColor="bg-red-500"
        onStatusChange={vi.fn()}
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const { container: c2 } = renderWithProviders(
      <TaskCard
        task={{ ...MOCK_TASK, _id: 'task-b' as any, title: 'Task B' }}
        barColor="bg-red-500"
        onStatusChange={vi.fn()}
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(c1.querySelector('[class*="cursor-pointer"]')!)
    // Task A expanded, Task B still collapsed
    expect(c1.querySelector('[class*="grid-rows-\\[1fr\\]"]')).toBeInTheDocument()
    expect(c2.querySelector('[class*="grid-rows-\\[0fr\\]"]')).toBeInTheDocument()
  })

  it('clicking edit button does not toggle expand', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([makeBlock('b1')] as never)
    const { container } = renderWithProviders(
      <TaskCard
        task={MOCK_TASK}
        barColor="bg-red-500"
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onStatusChange={vi.fn()}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    expect(getPanel(container).className).toContain('grid-rows-[0fr]')
  })

  it('clicking delete button does not toggle expand', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([makeBlock('b1')] as never)
    const { container } = renderWithProviders(
      <TaskCard
        task={MOCK_TASK}
        barColor="bg-red-500"
        isEstimating={false}
        feedback={DEFAULT_FEEDBACK}
        onStatusChange={vi.fn()}
        onEstimate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(getPanel(container).className).toContain('grid-rows-[0fr]')
  })

  // --- Study block variants ---

  it('renders active block with navy background when startTime is now', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const activeBlock = makeBlock('active', {
      startTime: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      studyBlockLength: 60,
    })
    mockUseQuery.mockReturnValue([activeBlock] as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    const blockEl = screen.getByText('Study Block active').closest('div')!
    expect(blockEl).toHaveClass('bg-navy')
  })

  it('renders default block without navy background when not active', async () => {
    const user = userEvent.setup()
    const futureBlock = makeBlock('future', {
      startTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      studyBlockLength: 60,
    })
    mockUseQuery.mockReturnValue([futureBlock] as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    const blockEl = screen.getByText('Study Block future').closest('div')!
    expect(blockEl).not.toHaveClass('bg-navy')
  })

  // --- Empty state ---

  it('shows empty state message when task has no study blocks', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([] as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    expect(screen.getByText('No study sessions scheduled yet.')).toBeInTheDocument()
  })

  // --- Loading state ---

  it('shows loading spinner while study blocks are undefined', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue(undefined as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    expect(screen.getByText('Loading study blocks…')).toBeInTheDocument()
  })

  // --- See more / See less ---

  it('does not show "See more" when task has 5 or fewer study blocks', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([1, 2, 3, 4, 5].map((i) => makeBlock(`b${i}`)) as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    expect(screen.queryByText(/See more/)).not.toBeInTheDocument()
  })

  it('shows "See more (+N)" when task has more than 5 study blocks', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([1, 2, 3, 4, 5, 6, 7].map((i) => makeBlock(`b${i}`)) as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    expect(screen.getByText('See more (+2)')).toBeInTheDocument()
  })

  it('clicking "See more" reveals all blocks and shows "See less"', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([1, 2, 3, 4, 5, 6].map((i) => makeBlock(`b${i}`)) as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    await user.click(screen.getByText('See more (+1)'))
    expect(screen.getByText('Study Block b6')).toBeInTheDocument()
    expect(screen.getByText('See less')).toBeInTheDocument()
  })

  it('clicking "See less" collapses back to 5 blocks', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue([1, 2, 3, 4, 5, 6].map((i) => makeBlock(`b${i}`)) as never)
    setup()
    await user.click(screen.getByText('Calculus Problem Set'))
    await user.click(screen.getByText('See more (+1)'))
    await user.click(screen.getByText('See less'))
    expect(screen.queryByText('Study Block b6')).not.toBeInTheDocument()
    expect(screen.queryByText('See less')).not.toBeInTheDocument()
  })
})
