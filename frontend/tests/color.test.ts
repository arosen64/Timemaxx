import { mixHexWithWhite, FALLBACK_COURSE_COLOR } from '../src/utils/color'

describe('mixHexWithWhite', () => {
  it('returns the base color unchanged at pct=0', () => {
    expect(mixHexWithWhite('#2563eb', 0)).toBe('#2563eb')
  })

  it('returns white at pct=1', () => {
    expect(mixHexWithWhite('#2563eb', 1)).toBe('#ffffff')
  })

  it('returns midpoint gray for black at pct=0.5', () => {
    expect(mixHexWithWhite('#000000', 0.5)).toBe('#808080')
  })

  it('handles uppercase hex input', () => {
    expect(mixHexWithWhite('#2563EB', 0)).toBe('#2563eb')
    expect(mixHexWithWhite('#2563EB', 1)).toBe('#ffffff')
  })

  it('produces lighter shades as pct increases', () => {
    const shade1 = mixHexWithWhite('#2563eb', 0.25)
    const shade2 = mixHexWithWhite('#2563eb', 0.50)
    const shade3 = mixHexWithWhite('#2563eb', 0.75)
    const toR = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(toR(shade1)).toBeLessThan(toR(shade2))
    expect(toR(shade2)).toBeLessThan(toR(shade3))
  })

  it('generates correct cascade for 4 subtasks', () => {
    const base = '#2563eb'
    const n = 4
    const shades = Array.from({ length: n }, (_, i) =>
      mixHexWithWhite(base, (1 / n) * i)
    )
    expect(shades[0]).toBe('#2563eb') // first subtask = base color
    expect(shades[3]).not.toBe('#ffffff') // last subtask is lighter but not white
  })

  it('clamps pct above 1 to white', () => {
    expect(mixHexWithWhite('#2563eb', 1.5)).toBe('#ffffff')
  })

  it('clamps pct below 0 to base color', () => {
    expect(mixHexWithWhite('#2563eb', -0.5)).toBe('#2563eb')
  })
})

describe('FALLBACK_COURSE_COLOR', () => {
  it('is a valid hex color string', () => {
    expect(FALLBACK_COURSE_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})
