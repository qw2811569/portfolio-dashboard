import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'

const SOURCE_META = {
  finmind: {
    label: 'FinMind 資料',
    text: C.textSec,
    border: alpha(C.blue, '24'),
    background: alpha(C.blue, '10'),
  },
  cnyes_aggregate: {
    label: 'FactSet 共識',
    text: C.textSec,
    border: alpha(C.up, '24'),
    background: alpha(C.up, '10'),
  },
  rss: {
    label: '新聞摘錄',
    text: C.textSec,
    border: alpha(C.amber, '28'),
    background: alpha(C.amber, '12'),
  },
  gemini_grounded: {
    label: 'AI 搜尋綜合',
    text: C.text,
    border: alpha(C.choco, '1f'),
    background: alpha(C.choco, '08'),
  },
  cmoney: {
    label: 'CMoney 投顧',
    text: C.text,
    border: alpha(C.orange, '28'),
    background: alpha(C.orange, '10'),
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
        padding: '4px 8px',
        fontSize: 12,
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
