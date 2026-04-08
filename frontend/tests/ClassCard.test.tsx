import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ClassCard from '../src/components/classes/ClassCard'
import type { Id } from '../../../backend/convex/_generated/dataModel'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    mutations: {
      userCourses: { updateUserCourse: 'updateUserCourse' },
    },
  },
}))

vi.mock('../src/components/classes/SyllabusUploadModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="syllabus-upload-modal" /> : null,
}))

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}))

import { useMutation } from 'convex/react'

const mockUseMutation = vi.mocked(useMutation)

const defaultProps = {
  id: 'uc1' as Id<'userCourses'>,
  courseCode: 'CS101',
  title: 'Intro to CS',
  term: 'Spring 2026',
  grade: undefined as string | undefined,
  studyGoal: undefined as string | undefined,
  difficultyRating: undefined as number | undefined,
  color: undefined as string | undefined,
  isPast: false,
  hasSyllabus: false,
  taskCount: 0,
  onRemove: vi.fn().mockResolvedValue(undefined) as () => Promise<void>,
}

function setup(overrides: Partial<typeof defaultProps> = {}) {
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  return renderWithProviders(<ClassCard {...defaultProps} {...overrides} />)
}

describe('ClassCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('current course — no syllabus', () => {
    it('shows Upload Syllabus button', () => {
      setup()
      expect(screen.getByRole('button', { name: /upload syllabus/i })).toBeInTheDocument()
    })

    it('does not render a grade selector', () => {
      setup()
      expect(screen.queryByText('Select grade…')).not.toBeInTheDocument()
    })

    it('renders a study goal selector', () => {
      setup()
      expect(screen.getByRole('combobox', { name: /study goal/i })).toBeInTheDocument()
    })

    it('pre-populates study goal selector with initial value', () => {
      setup({ studyGoal: 'Do well' })
      expect(screen.getByRole('combobox', { name: /study goal/i })).toHaveValue('Do well')
    })

    it('calls updateUserCourse when a study goal is selected', async () => {
      const user = userEvent.setup()
      const updateUserCourse = makeMutationFn()
      mockUseMutation.mockReturnValue(updateUserCourse as never)
      renderWithProviders(<ClassCard {...defaultProps} />)
      await user.selectOptions(screen.getByRole('combobox', { name: /study goal/i }), 'Ace it')
      expect(updateUserCourse).toHaveBeenCalledWith(expect.objectContaining({ studyGoal: 'Ace it' }))
    })
  })

  describe('current course — with syllabus', () => {
    it('shows task count', () => {
      setup({ hasSyllabus: true, taskCount: 3 })
      expect(screen.getByText('3 tasks confirmed')).toBeInTheDocument()
    })

    it('shows Re-upload button', () => {
      setup({ hasSyllabus: true, taskCount: 3 })
      expect(screen.getByRole('button', { name: /re-upload/i })).toBeInTheDocument()
    })
  })

  describe('past course', () => {
    it('shows grade selector', () => {
      setup({ isPast: true })
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('shows Save button', () => {
      setup({ isPast: true })
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    })

    it('does not show Upload Syllabus button', () => {
      setup({ isPast: true })
      expect(screen.queryByRole('button', { name: /upload syllabus/i })).not.toBeInTheDocument()
    })
  })

  describe('remove flow', () => {
    it('shows Remove? confirmation when trash icon is clicked', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /remove intro to cs/i }))
      expect(screen.getByText('Remove?')).toBeInTheDocument()
    })

    it('hides confirmation and does not call onRemove when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn().mockResolvedValue(undefined) as () => Promise<void>
      setup({ onRemove })
      await user.click(screen.getByRole('button', { name: /remove intro to cs/i }))
      await user.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(screen.queryByText('Remove?')).not.toBeInTheDocument()
      expect(onRemove).not.toHaveBeenCalled()
    })

    it('calls onRemove when Yes is clicked', async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn().mockResolvedValue(undefined) as () => Promise<void>
      setup({ onRemove })
      await user.click(screen.getByRole('button', { name: /remove intro to cs/i }))
      await user.click(screen.getByRole('button', { name: /^yes$/i }))
      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    it('shows task count warning when taskCount > 0 and confirmation is showing', async () => {
      const user = userEvent.setup()
      setup({ taskCount: 2 })
      await user.click(screen.getByRole('button', { name: /remove intro to cs/i }))
      expect(screen.getByText(/2 linked task/i)).toBeInTheDocument()
    })
  })

  describe('color picker', () => {
    it('renders the color swatch button with aria-label', () => {
      setup()
      expect(screen.getByRole('button', { name: /set course color/i })).toBeInTheDocument()
    })

    it('applies provided color as background style on the swatch', () => {
      setup({ color: '#ff0000' })
      const swatch = screen.getByRole('button', { name: /set course color/i })
      expect(swatch).toHaveStyle({ backgroundColor: '#ff0000' })
    })

    it('renders swatch with bg-bg-gray class when no color is provided', () => {
      setup()
      const swatch = screen.getByRole('button', { name: /set course color/i })
      expect(swatch).toHaveClass('bg-bg-gray')
    })

    it('calls updateUserCourse with chosen color when color input changes', async () => {
      const updateUserCourse = makeMutationFn()
      mockUseMutation.mockReturnValue(updateUserCourse as never)
      renderWithProviders(<ClassCard {...defaultProps} color="#aabbcc" />)
      const input = document.querySelector('input[type="color"]') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#123456' } })
      expect(updateUserCourse).toHaveBeenCalledWith(
        expect.objectContaining({ userCourseId: 'uc1', color: '#123456' })
      )
    })
  })

  describe('syllabus upload modal', () => {
    it('opens modal when Upload Syllabus is clicked', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /upload syllabus/i }))
      expect(screen.getByTestId('syllabus-upload-modal')).toBeInTheDocument()
    })

    it('opens modal when Re-upload is clicked', async () => {
      const user = userEvent.setup()
      setup({ hasSyllabus: true, taskCount: 3 })
      await user.click(screen.getByRole('button', { name: /re-upload/i }))
      expect(screen.getByTestId('syllabus-upload-modal')).toBeInTheDocument()
    })
  })

  describe('past course grade save', () => {
    it('calls updateUserCourse with selected grade when Save is clicked', async () => {
      const user = userEvent.setup()
      const updateUserCourse = makeMutationFn()
      mockUseMutation.mockReturnValue(updateUserCourse as never)
      renderWithProviders(<ClassCard {...defaultProps} isPast={true} />)
      await user.selectOptions(screen.getByRole('combobox'), 'A')
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(updateUserCourse).toHaveBeenCalledWith(expect.objectContaining({ grade: 'A' }))
    })

    it('shows validation error when Save is clicked without selecting a grade', async () => {
      const user = userEvent.setup()
      setup({ isPast: true })
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(screen.getByText('Please select a grade before saving.')).toBeInTheDocument()
    })
  })

  describe('past course grade blur revert', () => {
    it('reverts grade to original value on blur without saving', async () => {
      const user = userEvent.setup()
      setup({ isPast: true, grade: 'B' })
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'A')
      expect(select).toHaveValue('A')
      await user.click(document.body)
      expect(select).toHaveValue('B')
    })

    it('does not revert grade after a successful save', async () => {
      const user = userEvent.setup()
      const updateUserCourse = makeMutationFn()
      mockUseMutation.mockReturnValue(updateUserCourse as never)
      renderWithProviders(<ClassCard {...defaultProps} isPast={true} grade="B" />)
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'A')
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      await user.click(document.body)
      expect(select).toHaveValue('A')
    })

    it('clears error on blur', async () => {
      const user = userEvent.setup()
      setup({ isPast: true })
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(screen.getByText('Please select a grade before saving.')).toBeInTheDocument()
      // Re-focus the select, then blur it by clicking away
      await user.click(screen.getByRole('combobox'))
      await user.click(document.body)
      expect(screen.queryByText('Please select a grade before saving.')).not.toBeInTheDocument()
    })
  })
})
