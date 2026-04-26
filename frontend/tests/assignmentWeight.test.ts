import { describe, expect, test } from 'vitest'
import { toAssignmentWeight } from '../src/utils/assignmentWeight'

describe('toAssignmentWeight', () => {
  test('converts raw points to percentage', () => {
    expect(toAssignmentWeight(30, 200)).toBe(15)
  })

  test('returns 100 when rawPoints equals totalPoints', () => {
    expect(toAssignmentWeight(100, 100)).toBe(100)
  })

  test('defaults totalPoints to 100 when undefined', () => {
    expect(toAssignmentWeight(25)).toBe(25)
  })

  test('returns 0 when totalPoints is 0', () => {
    expect(toAssignmentWeight(30, 0)).toBe(0)
  })

  test('returns 0 when rawPoints is 0', () => {
    expect(toAssignmentWeight(0, 200)).toBe(0)
  })
})
