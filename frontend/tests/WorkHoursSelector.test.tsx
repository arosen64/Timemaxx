import { render, screen, fireEvent } from '@testing-library/react'
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from '../src/components/WorkHoursSelector'
import { WorkHoursData } from '../src/types'

describe('WorkHoursSelector', () => {
  it('renders all day headers', () => {
    render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  describe('edit mode (default)', () => {
    it('shows paint mode toggle buttons', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: /available/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /never work/i })).toBeInTheDocument()
    })

    it('shows the erase hint', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} />)
      expect(screen.getByText(/click a painted cell to erase it/i)).toBeInTheDocument()
    })

    it('calls onChange when a cell is clicked', () => {
      const onChange = vi.fn()
      const { container } = render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={onChange} />)
      const cell = container.querySelector('[class*="cursor-crosshair"]')!
      fireEvent.mouseDown(cell)
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('readOnly mode', () => {
    it('does not show paint mode toggle buttons', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} readOnly />)
      expect(screen.queryByRole('button', { name: /available/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /never work/i })).not.toBeInTheDocument()
    })

    it('does not show the erase hint', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} readOnly />)
      expect(screen.queryByText(/click a painted cell to erase it/i)).not.toBeInTheDocument()
    })

    it('shows a color legend', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} readOnly />)
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('Never work')).toBeInTheDocument()
    })

    it('does not call onChange when a cell is clicked', () => {
      const onChange = vi.fn()
      const { container } = render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={onChange} readOnly />)
      const cell = container.querySelector('[class*="cursor-default"]')!
      fireEvent.mouseDown(cell)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('data sync', () => {
    it('updates displayed slots when the data prop changes', () => {
      const onChange = vi.fn()
      const { container, rerender } = render(
        <WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={onChange} readOnly />
      )

      const initialTealCount = container.querySelectorAll('[class*="bg-teal"]').length

      const updatedData: WorkHoursData = {
        ...DEFAULT_WORK_HOURS,
        Monday: { available: [0, 1, 2], blocked: [] },
      }
      rerender(<WorkHoursSelector data={updatedData} onChange={onChange} readOnly />)

      expect(container.querySelectorAll('[class*="bg-teal"]').length).toBeGreaterThan(initialTealCount)
    })
  })
})
