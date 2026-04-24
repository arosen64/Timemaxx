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
    it('does not show paint mode toggle buttons', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} />)
      expect(screen.queryByRole('button', { name: /available/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /never work/i })).not.toBeInTheDocument()
    })

    it('shows the instruction text', () => {
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

    it('shows a color legend with Never work', () => {
      render(<WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={vi.fn()} readOnly />)
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
    it('updates displayed slots when blocked data prop changes', () => {
      const onChange = vi.fn()
      const { container, rerender } = render(
        <WorkHoursSelector data={DEFAULT_WORK_HOURS} onChange={onChange} />
      )

      const initialBlockedCount = container.querySelectorAll('[class*="bg-slate-blue"]').length

      const updatedData: WorkHoursData = {
        ...DEFAULT_WORK_HOURS,
        Monday: { blocked: [0, 1, 2] },
      }
      rerender(<WorkHoursSelector data={updatedData} onChange={onChange} />)

      expect(container.querySelectorAll('[class*="bg-slate-blue"]').length).toBeGreaterThan(initialBlockedCount)
    })
  })
})
