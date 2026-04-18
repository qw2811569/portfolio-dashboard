import { describe, expect, it } from 'vitest'

import { C, TOKENS, alpha, applyThemeVars } from '../../src/theme.js'

describe('theme facade', () => {
  it('keeps generated tokens immutable', () => {
    expect(Object.isFrozen(TOKENS)).toBe(true)
    expect(() => {
      TOKENS.ink = '#ffffff'
    }).toThrow()
    expect(TOKENS.ink).toBe('#0b120e')
  })

  it('maps legacy aliases to canonical positive and negative tones', () => {
    expect(C.up).toBe(TOKENS.positive)
    expect(C.down).toBe(TOKENS.negative)
  })

  it('supports numeric alpha edges and leaves invalid opacity untouched', () => {
    expect(alpha('#ef7d2f', 0)).toBe('#ef7d2f00')
    expect(alpha('#ef7d2f', 1)).toBe('#ef7d2fff')
    expect(alpha('#ef7d2f', 'nope')).toBe('#ef7d2f')
  })

  it('applies canonical vars and app aliases to a target node', () => {
    const target = document.createElement('div')
    applyThemeVars(target)

    expect(target.style.getPropertyValue('--positive')).toBe(TOKENS.positive)
    expect(target.style.getPropertyValue('--font-headline')).toBe(TOKENS.fontHeadline)
    expect(target.style.getPropertyValue('--app-bg')).toBe(C.bg)
  })
})
