import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import ProfileForm from '../src/components/ProfileForm'
import { ProfileData } from '../src/types'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    actions: {
      jhuCourses: {
        getAvailableTerms: 'getAvailableTerms',
        getAvailableSchools: 'getAvailableSchools',
        getCoursesByTerm: 'getCoursesByTerm',
      },
    },
    mutations: {
      userCourses: { addUserCourse: 'addUserCourse', deleteUserCourse: 'deleteUserCourse' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined)),
  useAction: vi.fn().mockReturnValue(vi.fn().mockResolvedValue([])),
  useQuery: vi.fn().mockReturnValue(undefined),
}))

const DEFAULT_DATA: ProfileData = {
  major: '',
  year: '',
  difficultSubjects: [],
  enjoyedSubjects: [],
  courses: [],
}

/**
 * Renders ProfileForm inside a stateful wrapper so controlled inputs
 * actually update as the user types. The onChange spy is called on every change.
 */
function setup(overrides: Partial<ProfileData> = {}, errors = {}, readOnly = false) {
  const onChange = vi.fn()
  const initial = { ...DEFAULT_DATA, ...overrides }

  function Wrapper() {
    const [data, setData] = useState<ProfileData>(initial)
    return (
      <ProfileForm
        data={data}
        onChange={(next) => { setData(next); onChange(next) }}
        errors={errors}
        readOnly={readOnly}
      />
    )
  }

  render(<Wrapper />)
  return { onChange }
}

describe('ProfileForm', () => {
  describe('major field', () => {
    it('renders with the current major value', () => {
      setup({ major: 'Biology' })
      expect(screen.getByDisplayValue('Biology')).toBeInTheDocument()
    })

    it('calls onChange with updated major when typed', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      await user.type(screen.getByPlaceholderText(/computer science/i), 'Math')

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ major: 'Math' })
      )
    })

    it('shows error message when major error is provided', () => {
      setup({}, { major: 'Major is required' })
      expect(screen.getByText('Major is required')).toBeInTheDocument()
    })
  })

  describe('year field', () => {
    it('calls onChange with selected year', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      await user.selectOptions(document.getElementById('year-select')!, 'Junior')

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: 'Junior' })
      )
    })

    it('shows error message when year error is provided', () => {
      setup({}, { year: 'Please select your year' })
      expect(screen.getByText('Please select your year')).toBeInTheDocument()
    })
  })

  describe('difficult subjects tag input', () => {
    it('adds a tag when Enter is pressed', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      // Find by placeholder directly
      const tagInput = screen.getByPlaceholderText(/organic chemistry/i)
      await user.type(tagInput, 'Calculus{Enter}')

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ difficultSubjects: ['Calculus'] })
      )
    })

    it('renders existing difficult subject tags', () => {
      setup({ difficultSubjects: ['Organic Chemistry', 'Physics'] })
      expect(screen.getByText('Organic Chemistry')).toBeInTheDocument()
      expect(screen.getByText('Physics')).toBeInTheDocument()
    })

    it('removes a tag when its × button is clicked', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({ difficultSubjects: ['Calculus', 'Physics'] })

      // Find the remove button within the Calculus tag span
      const calculusTag = screen.getByText('Calculus').closest('span')!
      await user.click(within(calculusTag).getByRole('button'))

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ difficultSubjects: ['Physics'] })
      )
    })
  })

  describe('enjoyed subjects tag input', () => {
    it('adds a tag when comma is pressed', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      const tagInput = screen.getByPlaceholderText(/linear algebra/i)
      await user.type(tagInput, 'Statistics,')

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ enjoyedSubjects: ['Statistics'] })
      )
    })
  })

  describe('readOnly mode', () => {
    it('renders the major value in a non-editable input', () => {
      setup({ major: 'Biology' }, {}, true)
      const input = screen.getByDisplayValue('Biology')
      expect(input).toHaveAttribute('readonly')
    })

    it('hides hint text for tag inputs', () => {
      setup({}, {}, true)
      expect(screen.queryByText(/press enter or comma/i)).not.toBeInTheDocument()
    })

    it('renders existing tags without remove buttons', () => {
      setup({ difficultSubjects: ['Calculus', 'Physics'] }, {}, true)
      expect(screen.getByText('Calculus')).toBeInTheDocument()
      const calculusTag = screen.getByText('Calculus').closest('span')!
      expect(within(calculusTag).queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows "None" when a tag list is empty', () => {
      setup({ difficultSubjects: [] }, {}, true)
      // "None" appears for both difficult and enjoyed subjects
      expect(screen.getAllByText('None').length).toBeGreaterThanOrEqual(1)
    })

    it('does not render the course remove button', () => {
      setup({ courses: [{ title: 'CS 101', studyGoal: 'Do well' }] }, {}, true)
      expect(screen.getByText('CS 101')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '×' })).not.toBeInTheDocument()
    })

    it('does not show error messages even when errors are provided', () => {
      setup({}, { major: 'Major is required', year: 'Please select your year' }, true)
      expect(screen.queryByText('Major is required')).not.toBeInTheDocument()
      expect(screen.queryByText('Please select your year')).not.toBeInTheDocument()
    })
  })

  describe('courses', () => {
    it('removes a course when its × button is clicked', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({
        courses: [
          { title: 'CS 101', studyGoal: 'Do well' },
          { title: 'Math 201', studyGoal: 'Ace it' },
        ],
      })

      const removeButtons = screen.getAllByRole('button', { name: '×' })
      await user.click(removeButtons[0])

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          courses: [expect.objectContaining({ title: 'Math 201' })],
        })
      )
    })

    it('updates study goal when a radio option is selected', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({
        courses: [{ title: 'CS 101', studyGoal: '' }],
      })

      await user.click(screen.getByRole('radio', { name: 'Ace it' }))

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          courses: [expect.objectContaining({ title: 'CS 101', studyGoal: 'Ace it' })],
        })
      )
    })
  })
})
