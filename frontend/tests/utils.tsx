import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'

interface RenderWithProvidersOptions extends RenderOptions {
  initialEntries?: MemoryRouterProps['initialEntries']
}

export function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ['/'], ...renderOptions }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/** Returns a mock mutation function that resolves successfully by default. */
export function makeMutationFn(resolved: unknown = undefined) {
  return vi.fn().mockResolvedValue(resolved)
}
