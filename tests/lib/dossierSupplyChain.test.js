import { describe, it, expect } from 'vitest'
import { buildSupplyChainContext, buildThemeContext } from '../../src/lib/dossierUtils.js'

describe('dossier supply chain integration', () => {
  describe('buildSupplyChainContext', () => {
    it('returns supply chain text for known stock', () => {
      const text = buildSupplyChainContext('3443')
      expect(text).toContain('台積電')
      expect(text).toContain('上游')
    })
    it('returns empty string for unknown stock', () => {
      expect(buildSupplyChainContext('9999')).toBe('')
    })
  })

  describe('buildThemeContext', () => {
    it('returns theme text for stock with themes', () => {
      const meta = { themes: ['AI伺服器', 'NVIDIA'] }
      const text = buildThemeContext('3443', meta)
      expect(text).toContain('AI伺服器')
      expect(text).toContain('NVIDIA')
    })
    it('returns empty string for stock without themes', () => {
      expect(buildThemeContext('9999', {})).toBe('')
      expect(buildThemeContext('9999', null)).toBe('')
    })
  })
})
