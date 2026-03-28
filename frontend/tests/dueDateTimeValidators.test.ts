import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  combineDateMsWithTime,
  DEFAULT_DUE_TIME,
  msToTimeInputValue,
  parseTimeInputValue,
  validateDueDate,
  validateDueDateAndTime,
} from '../src/validators'

describe('DEFAULT_DUE_TIME', () => {
  it('is 11:59 PM in 24h form', () => {
    expect(DEFAULT_DUE_TIME).toBe('23:59')
  })
})

describe('validateDueDate — past date message', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mentions past explicitly', () => {
    expect(validateDueDate('03/10/2026')).toContain('in the past')
  })
})

describe('validateDueDateAndTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects past calendar day with clear copy', () => {
    expect(validateDueDateAndTime('03/10/2026', '23:59')).toContain('due date is in the past')
  })

  it('rejects today when time already passed', () => {
    expect(validateDueDateAndTime('03/15/2026', '08:00')).toContain('due date and time are in the past')
  })

  it('accepts later today', () => {
    expect(validateDueDateAndTime('03/15/2026', '23:59')).toBeNull()
  })
})

describe('time parsing', () => {
  it('parseTimeInputValue accepts HH:mm', () => {
    expect(parseTimeInputValue('09:05')).toEqual({ hours: 9, minutes: 5 })
    expect(parseTimeInputValue('bad')).toBeNull()
  })

  it('combineDateMsWithTime + msToTimeInputValue round-trip', () => {
    const midnight = new Date(2026, 2, 1, 0, 0, 0, 0).getTime()
    const target = new Date(2026, 2, 1, 8, 7, 0, 0).getTime()
    expect(combineDateMsWithTime(midnight, msToTimeInputValue(target))).toBe(target)
  })
})
