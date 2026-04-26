import { useState } from 'react'
import { C, alpha } from '../../theme.js'

export const ONBOARDING_STORAGE_KEY = 'pf-onboarding-completed-v1'

const steps = [
  {
    title: '歡迎 · 持倉看板是什麼',
    body: '這裡把持倉、事件、研究與每日分析收斂成同一個投資工作台。',
  },
  {
    title: '先建組合',
    body: '先確認目前組合，之後所有 holdings、事件與報告都會跟著組合保存。',
  },
  {
    title: '加持倉',
    body: '從 Trade 上傳成交、貼文字，或用手動填單新增持倉。',
  },
  {
    title: '看每日分析',
    body: 'Daily 會整理收盤摘要、三個支柱、每檔今日動作與歷史命中率。',
  },
]

export default function OnboardingTour({ replayToken = 0, onNavigate }) {
  const [open, setOpen] = useState(() => {
    if (replayToken) return true
    if (typeof window === 'undefined') return false
    return !window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
  })
  const [index, setIndex] = useState(0)

  if (!open) return null

  const step = steps[index]
  const isLast = index === steps.length - 1
  const complete = () => {
    window.localStorage?.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString())
    setOpen(false)
  }
  const next = () => {
    if (index === 1) onNavigate?.('holdings')
    if (index === 2) onNavigate?.('trade')
    if (index === 3) onNavigate?.('daily')
    if (isLast) complete()
    else setIndex((current) => current + 1)
  }

  return (
    <div
      data-testid="onboarding-tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        background: alpha(C.ink, '45'),
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          borderRadius: 8,
          background: C.card,
          border: `1px solid ${C.border}`,
          padding: 16,
          boxShadow: C.shadow,
        }}
      >
        <div id="onboarding-title" style={{ color: C.text, fontSize: 18, fontWeight: 800 }}>
          {step.title}
        </div>
        <div style={{ color: C.textSec, fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
          {step.body}
        </div>
        <div style={{ color: C.textMute, fontSize: 12, marginTop: 12 }}>
          {index + 1} / {steps.length}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="ui-btn" onClick={complete}>
            跳過
          </button>
          <button
            type="button"
            className="ui-btn"
            data-testid="onboarding-next"
            onClick={next}
            style={{ flex: 1 }}
          >
            {isLast ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}
