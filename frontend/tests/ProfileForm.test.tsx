import React, { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import ProfileForm from '../src/components/ProfileForm'
import { ProfileData } from '../src/types'

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
function setup(overrides: Partial<ProfileData> = {}, errors = {}) {
  const onChange = vi.fn()
  const initial = { ...DEFAULT_DATA, ...overrides }

  function Wrapper() {
    const [data, setData] = useState<ProfileData>(initial)
    return (
      <ProfileForm
        data={data}
        onChange={(next) => { setData(next); onChange(next) }}
        errors={errors}
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

      await user.selectOptions(screen.getByRole('combobox'), 'Junior')

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

      const inputs = screen.getAllByRole('textbox')
      // First textbox is major, tag inputs follow — find by placeholder
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

  describe('courses', () => {
    it('adds a course entry when Add course is clicked', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      await user.click(screen.getByRole('button', { name: /add course/i }))

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ courses: [{ title: '', studyGoal: '' }] })
      )
    })

    it('removes a course when its × button is clicked', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({
        courses: [
          { title: 'CS 101', studyGoal: 'Do well' },
          { title: 'Math 201', studyGoal: 'Ace it' },
        ],
      })

      // The first × button in the course list removes the first course
      const removeButtons = screen.getAllByRole('button', { name: '×' })
      await user.click(removeButtons[0])

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          courses: [{ title: 'Math 201', studyGoal: 'Ace it' }],
        })
      )
    })

    it('updates course title when typed', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({
        courses: [{ title: '', studyGoal: '' }],
      })

      await user.type(screen.getByPlaceholderText(/cs 101/i), 'Bio 110')

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          courses: expect.arrayContaining([
            expect.objectContaining({ title: 'Bio 110' }),
          ]),
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
          courses: [{ title: 'CS 101', studyGoal: 'Ace it' }],
        })
      )
    })
  })
})
