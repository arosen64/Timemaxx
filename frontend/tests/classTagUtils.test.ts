import { describe, expect, test } from 'vitest'
import {
  buildClassTag,
  formatClassTagForDisplay,
  legacyNaiveClassTag,
} from '../src/utils/classTagUtils'

describe('classTagUtils', () => {
  test('buildClassTag strips duplicate catalog when title is SIS-shaped', () => {
    expect(
      buildClassTag('EN.601.423.SP26', 'EN.601.423: AI-Enabled Software Engineering')
    ).toBe('EN.601.423.SP26: AI-Enabled Software Engineering')
  })

  test('buildClassTag leaves plain titles unchanged aside from prefix', () => {
    expect(buildClassTag('EN.500.112.FA25', 'Gateway Computing')).toBe(
      'EN.500.112.FA25: Gateway Computing'
    )
  })

  test('legacyNaiveClassTag matches old dashboard concat', () => {
    expect(
      legacyNaiveClassTag('EN.601.423.SP26', 'EN.601.423: AI-Enabled Software Engineering')
    ).toBe('EN.601.423.SP26: EN.601.423: AI-Enabled Software Engineering')
  })

  test('formatClassTagForDisplay collapses legacy duplicate for subtitle', () => {
    expect(
      formatClassTagForDisplay(
        'EN.601.423.SP26: EN.601.423: AI-Enabled Software Engineering'
      )
    ).toBe('EN.601.423.SP26: AI-Enabled Software Engineering')
  })
})
