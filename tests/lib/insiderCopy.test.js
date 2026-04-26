import { describe, expect, it } from 'vitest'
import { INSIDER_COMPLIANCE_COPY } from '../../src/lib/insiderCopy.js'

describe('insider compliance copy', () => {
  it('exports V-A / V-B / V-C compliance copy', () => {
    expect(INSIDER_COMPLIANCE_COPY.A).toBe(
      '此部位屬公司代表持股，系統僅提供風險與事件紀錄，不產生買賣建議。'
    )
    expect(INSIDER_COMPLIANCE_COPY.B).toBe(
      '此檔為管理階層相關部位，以下內容以資訊整理與風險提示為主。'
    )
    expect(INSIDER_COMPLIANCE_COPY.C).toBe(
      '因持股身分特殊，本段分析不提供操作方向，僅保留事件、論述與部位變化記錄。'
    )
  })
})
