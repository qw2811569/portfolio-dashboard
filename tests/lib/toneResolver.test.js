import { describe, expect, it } from 'vitest'
import { C } from '../../src/theme.js'
import { normalizeToneKey, resolveTone } from '../../src/lib/toneResolver.js'

describe('lib/toneResolver.js', () => {
  it('maps legacy tone keys to canonical keys', () => {
    expect(normalizeToneKey('blue')).toBe('info')
    expect(normalizeToneKey('teal')).toBe('positive')
    expect(normalizeToneKey('olive')).toBe('positive')
    expect(normalizeToneKey('amber')).toBe('warning')
    expect(normalizeToneKey('lavender')).toBe('mute')
    expect(normalizeToneKey('rose')).toBe('alert')
  })

  it('resolves canonical tone colors from legacy inputs', () => {
    expect(resolveTone('blue')).toBe(C.cta)
    expect(resolveTone('olive')).toBe(C.positive)
    expect(resolveTone('amber')).toBe(C.warning)
    expect(resolveTone('lavender')).toBe(C.iron)
    expect(resolveTone('rose')).toBe(C.cta)
  })

  it('falls back to the requested canonical tone when input is unknown', () => {
    expect(normalizeToneKey('mystery-tone', 'mute')).toBe('mute')
    expect(resolveTone('mystery-tone', 'mute')).toBe(C.iron)
  })
})
