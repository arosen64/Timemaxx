import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferencesForm, { DEFAULT_PREFERENCES } from '../src/components/PreferencesForm'
import { PreferencesData } from '../src/types'

function setup(overrides: Partial<PreferencesData> = {}, readOnly = false) {
  const onChange = vi.fn()
  const initial = { ...DEFAULT_PREFERENCES, ...overrides }

  function Wrapper() {
    const [data, setData] = useState<PreferencesData>(initial)
    return (
      <PreferencesForm
        data={data}
        onChange={(next) => { setData(next); onChange(next) }}
        readOnly={readOnly}
      />
    )
  }

  render(<Wrapper />)
  return { onChange }
}

describe('PreferencesForm', () => {
  it('renders all category labels', () => {
    setup()
    expect(screen.getByText(/time of day/i)).toBeInTheDocument()
    expect(screen.getByText(/day of week/i)).toBeInTheDocument()
    expect(screen.getByText(/work session style/i)).toBeInTheDocument()
    expect(screen.getByText(/deadline behavior/i)).toBeInTheDocument()
    expect(screen.getByText(/break preferences/i)).toBeInTheDocument()
    expect(screen.getByText(/subject\/task switching/i)).toBeInTheDocument()
  })

  describe('edit mode (default)', () => {
    it('renders options as buttons', () => {
      setup()
      expect(screen.getByRole('button', { name: 'Morning (8–11am)' })).toBeInTheDocument()
    })

    it('calls onChange when an option is toggled', async () => {
      const user = userEvent.setup()
      const { onChange } = setup()

      await user.click(screen.getByRole('button', { name: 'Morning (8–11am)' }))

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          traits: expect.objectContaining({ timeOfDay: ['Morning (8–11am)'] }),
        })
      )
    })

    it('shows the custom trait input', () => {
      setup()
      expect(screen.getAllByPlaceholderText(/add notes/i).length).toBeGreaterThan(0)
    })

    it('renders custom trait chips with a remove button', () => {
      setup({ traits: { timeOfDay: ['My custom trait'] } })
      const chip = screen.getByText('My custom trait').closest('span')!
      expect(within(chip).getByRole('button', { name: '×' })).toBeInTheDocument()
    })
  })

  describe('readOnly mode', () => {
    it('renders options as disabled buttons', () => {
      setup({}, true)
      expect(screen.getByRole('button', { name: 'Morning (8–11am)' })).toBeDisabled()
    })

    it('does not call onChange when an option is clicked', async () => {
      const user = userEvent.setup()
      const { onChange } = setup({}, true)

      await user.click(screen.getByText('Morning (8–11am)'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('hides the custom trait input', () => {
      setup({}, true)
      expect(screen.queryByPlaceholderText(/add notes/i)).not.toBeInTheDocument()
    })

    it('renders custom trait chips without a remove button', () => {
      setup({ traits: { timeOfDay: ['My custom trait'] } }, true)
      const chip = screen.getByText('My custom trait').closest('span')!
      expect(within(chip).queryByRole('button', { name: '×' })).not.toBeInTheDocument()
    })

    it('renders the focus block input as read-only', () => {
      setup({ focusBlockLength: 45 }, true)
      const input = screen.getByDisplayValue('45')
      expect(input).toHaveAttribute('readonly')
    })
  })
})
