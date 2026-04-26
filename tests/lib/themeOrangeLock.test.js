import { describe, expect, it } from 'vitest'
import { C, TOKENS, alpha } from '../../src/theme.js'

describe('lib/theme orange lock', () => {
  it('keeps former card color aliases on the same neutral surface', () => {
    expect(C.cardBlue).toBe(TOKENS.surface)
    expect(C.cardAmber).toBe(TOKENS.surface)
    expect(C.cardOlive).toBe(TOKENS.surface)
    expect(C.cardRose).toBe(TOKENS.surface)
  })

  it('maps former cool and warm washes to charcoal or iron alpha', () => {
    expect(C.cyanBg).toBe(alpha(TOKENS.charcoal, '0c'))
    expect(C.mintBg).toBe(alpha(TOKENS.charcoal, '0c'))
    expect(C.lavBg).toBe(alpha(TOKENS.iron, '0c'))
    expect(C.chocoBg).toBe(alpha(TOKENS.charcoal, '0c'))
  })

  it('keeps fill aliases neutral except tomato as the single CTA orange', () => {
    expect(C.fillTeal).toBe(TOKENS.charcoal)
    expect(C.fillAmber).toBe(TOKENS.charcoal)
    expect(C.fillTomato).toBe(TOKENS.cta)
  })
})
