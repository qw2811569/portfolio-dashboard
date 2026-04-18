import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'

const SOURCE_META = {
  finmind: {
    label: 'FinMind 資料',
    text: '#20486B',
    border: '#9FBAD1',
    background: '#E8F1F7',
  },
  cnyes_aggregate: {
    label: 'FactSet 共識',
    text: '#435243',
    border: '#AFBAA5',
    background: '#E9EEE2',
  },
  rss: {
    label: '新聞摘錄',
    text: '#6A471A',
    border: '#D2B177',
    background: '#F6ECD9',
  },
  gemini_grounded: {
    label: 'AI 搜尋綜合',
    text: '#4F3624',
    border: '#BDA28A',
    background: '#EFE3D7',
  },
  cmoney: {
    label: 'CMoney 投顧',
    text: '#335242',
    border: '#9FB8A6',
    background: '#E6EFE9',
  },
  user_manual: {
    label: '手動輸入',
    text: C.textMute,
    border: alpha(C.textMute, '30'),
    background: alpha(C.textMute, '12'),
  },
}

export function DataSourceBadge({ source, style = {} }) {
  const meta = SOURCE_META[source] || SOURCE_META.user_manual

  return h(
    'span',
    {
      'data-source-badge': source || 'unknown',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 6px',
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: meta.text,
        userSelect: 'none',
        ...style,
      },
    },
    meta.label
  )
}
