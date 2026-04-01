import { describe, it, expect } from 'vitest'
import {
  buildHoldingCoverageContext,
  buildSupplyChainContext,
  buildThemeContext,
} from '../../src/lib/dossierUtils.js'

describe('dossier supply chain integration', () => {
  describe('buildSupplyChainContext', () => {
    it('returns supply chain text for known stock', () => {
      const text = buildSupplyChainContext('3443')
      expect(text).toContain('台積電')
      expect(text).toContain('上游')
    })

    it('trims supply chain entries when limits are provided', () => {
      const text = buildSupplyChainContext('3443', {
        upstreamLimit: 1,
        downstreamLimit: 1,
        customerLimit: 2,
        supplierLimit: 2,
      })
      const [upstreamLine = '', downstreamLine = '', customerLine = '', supplierLine = ''] =
        text.split('\n')

      expect(upstreamLine).toContain('上游: 台積電')
      expect(upstreamLine).not.toContain('Arm')
      expect(downstreamLine).toContain('下游: 雲端 AI 客戶')
      expect(downstreamLine).not.toContain('HPC 新創')
      expect(customerLine).toContain('主要客戶: 雲端 AI 客戶, HPC 新創')
      expect(customerLine).not.toContain('資料中心業者')
      expect(supplierLine).toContain('主要供應商: 台積電, Arm')
      expect(supplierLine).not.toContain('EDA 工具商')
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

    it('limits theme count and reuses it in global coverage summaries', () => {
      const meta = { themes: ['CoWoS', 'NVIDIA', 'AI伺服器'] }
      const themeText = buildThemeContext('3443', meta, { maxThemes: 2 })
      const coverageText = buildHoldingCoverageContext(
        {
          code: '3443',
          name: '創意',
          stockMeta: meta,
        },
        {
          maxThemes: 1,
          upstreamLimit: 1,
          downstreamLimit: 1,
          customerLimit: 1,
          supplierLimit: 1,
        }
      )

      expect(themeText).toContain('CoWoS')
      expect(themeText).toContain('NVIDIA')
      expect(themeText).not.toContain('AI伺服器')
      expect(coverageText).toContain('創意(3443)')
      expect(coverageText).toContain('上游: 台積電')
      expect(coverageText).not.toContain('Arm')
      expect(coverageText).toContain('相關主題: CoWoS')
      expect(coverageText).not.toContain('NVIDIA')
    })
  })
})
