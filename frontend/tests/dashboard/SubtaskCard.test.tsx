import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import SubtaskCard from '../../src/components/dashboard/SubtaskCard'
import type { SubtaskType } from '../../src/components/dashboard/types'
import type { StudyBlockLike } from '../../src/components/dashboard/StudyBlockRow'

const MOCK_SUBTASK: SubtaskType = {
  _id: 'sub1' as any,
  parentTaskId: 'task1' as any,
  title: 'Read Chapter 3',
  description: 'Read and take notes',
  taskType: 'Reading',
  color: '#2563eb',
  timeEstimate: 45,
  order: 0,
  createdAt: Date.now(),
}

function makeBlock(id: string): StudyBlockLike {
  return { _id: id as any, title: `Block ${id}`, startTime: undefined, studyBlockLength: 30 }
}

function setup(props: Partial<React.ComponentProps<typeof SubtaskCard>> = {}) {
  const defaults = {
    subtask: MOCK_SUBTASK,
    blocks: [],
    isEstimating: false,
    onEstimate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn(),
  }
  return renderWithProviders(<SubtaskCard {...defaults} {...props} />)
}

describe('SubtaskCard', () => {
  it('renders subtask title', () => {
    setup()
    expect(screen.getByText('Read Chapter 3')).toBeInTheDocument()
  })

  it('renders formatted time estimate', () => {
    setup()
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('does not render chevron button when there are no blocks', () => {
    setup({ blocks: [] })
    expect(screen.queryByRole('button', { name: /study blocks/i })).not.toBeInTheDocument()
  })

  it('blocks panel is collapsed by default when blocks exist', () => {
    const { container } = setup({ blocks: [makeBlock('b1')] })
    const panel = container.querySelector('[class*="grid-rows-"]') as HTMLElement
    expect(panel.className).toContain('grid-rows-[0fr]')
  })

  it('clicking chevron expands the blocks panel', async () => {
    const user = userEvent.setup()
    const { container } = setup({ blocks: [makeBlock('b1')] })
    await user.click(screen.getByRole('button', { name: 'Show study blocks' }))
    const panel = container.querySelector('[class*="grid-rows-"]') as HTMLElement
    expect(panel.className).toContain('grid-rows-[1fr]')
  })

  it('clicking chevron again collapses the blocks panel', async () => {
    const user = userEvent.setup()
    const { container } = setup({ blocks: [makeBlock('b1')] })
    const btn = screen.getByRole('button', { name: 'Show study blocks' })
    await user.click(btn)
    await user.click(screen.getByRole('button', { name: 'Hide study blocks' }))
    const panel = container.querySelector('[class*="grid-rows-"]') as HTMLElement
    expect(panel.className).toContain('grid-rows-[0fr]')
  })

  it('chevron icon wrapper gains rotate-180 class when expanded', async () => {
    const user = userEvent.setup()
    const { container } = setup({ blocks: [makeBlock('b1')] })
    await user.click(screen.getByRole('button', { name: 'Show study blocks' }))
    const iconSpan = container.querySelector('[class*="rotate-180"]')
    expect(iconSpan).toBeInTheDocument()
  })

  it('hides action buttons in read-only mode', () => {
    setup({ isReadOnly: true })
    expect(screen.queryByRole('button', { name: 'Edit subtask' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete subtask' })).not.toBeInTheDocument()
  })

  it('shows chevron toggle in read-only mode when blocks exist', () => {
    setup({ blocks: [makeBlock('b1')], isReadOnly: true })
    expect(screen.getByRole('button', { name: 'Show study blocks' })).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    setup({ onEdit })
    await user.click(screen.getByRole('button', { name: 'Edit subtask' }))
    expect(onEdit).toHaveBeenCalledWith(MOCK_SUBTASK)
  })

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    setup({ onDelete })
    await user.click(screen.getByRole('button', { name: 'Delete subtask' }))
    expect(onDelete).toHaveBeenCalledWith(MOCK_SUBTASK._id)
  })

  it('shows estimate button when timeEstimate is undefined', () => {
    setup({ subtask: { ...MOCK_SUBTASK, timeEstimate: undefined } })
    expect(screen.getByRole('button', { name: 'Estimate subtask time' })).toBeInTheDocument()
  })

  it('shows spinner instead of estimate button while estimating', () => {
    setup({ subtask: { ...MOCK_SUBTASK, timeEstimate: undefined }, isEstimating: true })
    expect(screen.queryByRole('button', { name: 'Estimate subtask time' })).not.toBeInTheDocument()
  })
})
