import { formatEstimatedTime } from '../src/utils/timeUtils'

describe('formatEstimatedTime', () => {
  it('returns "—" for 0 minutes', () => {
    expect(formatEstimatedTime(0)).toBe('—')
  })

  it('returns "—" for negative values', () => {
    expect(formatEstimatedTime(-5)).toBe('—')
  })

  it('returns minutes only for values under 60', () => {
    expect(formatEstimatedTime(45)).toBe('45m')
    expect(formatEstimatedTime(59)).toBe('59m')
    expect(formatEstimatedTime(1)).toBe('1m')
  })

  it('returns hours and minutes for exactly 60', () => {
    expect(formatEstimatedTime(60)).toBe('1h 0m')
  })

  it('returns hours and minutes for values over 60', () => {
    expect(formatEstimatedTime(90)).toBe('1h 30m')
    expect(formatEstimatedTime(135)).toBe('2h 15m')
  })

  it('rounds fractional minutes under 60', () => {
    expect(formatEstimatedTime(45.4)).toBe('45m')
    expect(formatEstimatedTime(45.6)).toBe('46m')
  })

  it('rounds fractional minutes that cross the 60-minute boundary', () => {
    expect(formatEstimatedTime(59.6)).toBe('1h 0m')
  })
})
