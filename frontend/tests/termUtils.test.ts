import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPastTerm } from '../src/utils/termUtils'

describe('isPastTerm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for a past year', () => {
    expect(isPastTerm('Fall 2020')).toBe(true)
  })

  it('returns true for a past season in the same year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-10-01'))
    expect(isPastTerm('Spring 2024')).toBe(true)
  })

  it('returns false for a far future term', () => {
    expect(isPastTerm('Fall 2099')).toBe(false)
  })

  it('returns true for an empty string (treat as past to exclude from display)', () => {
    expect(isPastTerm('')).toBe(true)
  })

  it('returns true for an unrecognized format (treat as past to exclude from display)', () => {
    expect(isPastTerm('Unknown Term')).toBe(true)
  })

  it('returns true for a past Summer term', () => {
    expect(isPastTerm('Summer 2020')).toBe(true)
  })

  it('returns true for a past Intersession term', () => {
    expect(isPastTerm('Intersession 2020')).toBe(true)
  })

  it('returns false for the current term', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-10-01')) // Fall 2024
    expect(isPastTerm('Fall 2024')).toBe(false)
  })
})
