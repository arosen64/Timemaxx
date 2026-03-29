import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMutation } from 'convex/react'
import CoursesList from '../src/components/CoursesList'
import { Course } from '../src/types'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    mutations: {
      userCourses: {
        deleteUserCourse: 'deleteUserCourse',
        updateUserCourse: 'updateUserCourse',
      },
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined)),
}))

const mockUseMutation = vi.mocked(useMutation)

function setup(initialCourses: Course[]) {
  const onCoursesChange = vi.fn()
  function Wrapper() {
    const [courses, setCourses] = useState<Course[]>(initialCourses)
    return (
      <CoursesList
        courses={courses}
        onCoursesChange={(next) => {
          setCourses(next)
          onCoursesChange(next)
        }}
      />
    )
  }
  render(<Wrapper />)
  return { onCoursesChange }
}

describe('CoursesList', () => {
  beforeEach(() => {
    mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined) as never)
  })

  it('renders all course titles', () => {
    setup([
      { title: 'CS 101', studyGoal: 'Do well' },
      { title: 'Math 201', studyGoal: 'Ace it' },
    ])
    expect(screen.getByText('CS 101')).toBeInTheDocument()
    expect(screen.getByText('Math 201')).toBeInTheDocument()
  })

  it('shows the added courses count', () => {
    setup([
      { title: 'CS 101', studyGoal: 'Do well' },
      { title: 'Math 201', studyGoal: 'Ace it' },
    ])
    expect(screen.getByText('Added courses (2)')).toBeInTheDocument()
  })

  it('filters courses by search query', async () => {
    const user = userEvent.setup()
    setup([
      { title: 'CS 101', studyGoal: 'Do well' },
      { title: 'Math 201', studyGoal: 'Ace it' },
    ])

    await user.type(screen.getByPlaceholderText(/search added courses/i), 'Math')

    expect(screen.getByText('Math 201')).toBeInTheDocument()
    expect(screen.queryByText('CS 101')).not.toBeInTheDocument()
  })

  it('shows no-match message when search has no results', async () => {
    const user = userEvent.setup()
    setup([{ title: 'CS 101', studyGoal: 'Do well' }])

    await user.type(screen.getByPlaceholderText(/search added courses/i), 'Biology')

    expect(screen.getByText(/no courses match/i)).toBeInTheDocument()
  })

  it('removes a course without userCourseId without prompting', async () => {
    const user = userEvent.setup()
    const { onCoursesChange } = setup([{ title: 'CS 101', studyGoal: 'Do well' }])

    await user.click(screen.getByRole('button', { name: '×' }))

    expect(onCoursesChange).toHaveBeenCalledWith([])
  })

  it('removes a course with userCourseId after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const { onCoursesChange } = setup([
      { title: 'CS 101', studyGoal: 'Do well', userCourseId: 'course-id-1' },
    ])

    await user.click(screen.getByRole('button', { name: '×' }))

    await waitFor(() => expect(onCoursesChange).toHaveBeenCalledWith([]))
  })

  it('does not remove a course when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const { onCoursesChange } = setup([
      { title: 'CS 101', studyGoal: 'Do well', userCourseId: 'course-id-1' },
    ])

    await user.click(screen.getByRole('button', { name: '×' }))

    expect(onCoursesChange).not.toHaveBeenCalled()
  })

  it('updates study goal when a radio is selected', async () => {
    const user = userEvent.setup()
    const { onCoursesChange } = setup([{ title: 'CS 101', studyGoal: 'Just pass' }])

    await user.click(screen.getByRole('radio', { name: 'Ace it' }))

    expect(onCoursesChange).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'CS 101', studyGoal: 'Ace it' }),
    ])
  })

  it('shows grade selector for courses that have a grade', () => {
    setup([{ title: 'CS 101', grade: 'A' }])
    expect(screen.getByText('Grade:')).toBeInTheDocument()
  })

  describe('pagination', () => {
    const manyCourses: Course[] = Array.from({ length: 6 }, (_, i) => ({
      title: `Course ${i + 1}`,
      studyGoal: 'Do well',
    }))

    it('shows pagination controls when courses exceed page size', () => {
      setup(manyCourses)
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })

    it('Prev button is disabled on the first page', () => {
      setup(manyCourses)
      expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    })

    it('navigates to the next page on Next click', async () => {
      const user = userEvent.setup()
      setup(manyCourses)

      await user.click(screen.getByRole('button', { name: /next/i }))

      expect(screen.getByText('Course 5')).toBeInTheDocument()
      expect(screen.queryByText('Course 1')).not.toBeInTheDocument()
    })
  })
})
