import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Button, Card } from './Base.jsx'

const RESOURCE_META = {
  holdings: {
    eyebrow: 'Portfolio onboarding',
    title: '還沒加股',
    description: '試試上傳成交單，先把第一筆持倉帶進來，主畫面就不會只剩空白。',
    actionLabel: '上傳成交單',
  },
  thesis: {
    eyebrow: 'Thesis placeholder',
    title: '這檔尚無論述',
    description: '你可以記下當初買進理由，之後比較容易分辨是節奏改了，還是 thesis 真的壞了。',
    actionLabel: '記下買進理由',
  },
  events: {
    eyebrow: 'Quiet window',
    title: '未來 30 天無重大事件',
    description: '這段時間先維持觀察節奏，若有新的法說、財報或產業催化，這裡會再補進來。',
    actionLabel: '',
  },
  research: {
    eyebrow: 'Research standby',
    title: '此股暫無深度研究',
    description: '明早 06:00 會自動更新，今晚先用持倉結構、事件與市場脈絡把方向看清楚。',
    actionLabel: '',
  },
}

function renderIllustration(resource) {
  const stroke = alpha(C.textSec, '88')
  const muted = alpha(C.textMute, '6a')
  const fill = alpha(C.border, '50')

  if (resource === 'events') {
    return h(
      'svg',
      {
        width: 96,
        height: 96,
        viewBox: '0 0 96 96',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('rect', {
        x: 18,
        y: 22,
        width: 60,
        height: 50,
        rx: 14,
        stroke,
        strokeWidth: 1.8,
      }),
      h('path', {
        d: 'M30 16v14M66 16v14M18 36h60',
        stroke,
        strokeWidth: 1.8,
        strokeLinecap: 'round',
      }),
      h('circle', {
        cx: 34,
        cy: 52,
        r: 4,
        stroke: muted,
        strokeWidth: 1.6,
      }),
      h('path', {
        d: 'M46 52h18M46 60h10',
        stroke: muted,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
      })
    )
  }

  if (resource === 'research') {
    return h(
      'svg',
      {
        width: 96,
        height: 96,
        viewBox: '0 0 96 96',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('circle', {
        cx: 42,
        cy: 42,
        r: 18,
        stroke,
        strokeWidth: 1.8,
      }),
      h('path', {
        d: 'M54.5 54.5L70 70',
        stroke,
        strokeWidth: 1.8,
        strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M34 42h16M42 34v16',
        stroke: muted,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
      }),
      h('rect', {
        x: 22,
        y: 60,
        width: 24,
        height: 10,
        rx: 5,
        fill,
      })
    )
  }

  if (resource === 'thesis') {
    return h(
      'svg',
      {
        width: 96,
        height: 96,
        viewBox: '0 0 96 96',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('path', {
        d: 'M28 24h26c8.8 0 16 7.2 16 16v24c0 4.4-3.6 8-8 8H36c-4.4 0-8-3.6-8-8V24z',
        stroke,
        strokeWidth: 1.8,
        strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'M36 40h26M36 50h18M36 60h12',
        stroke: muted,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
      })
    )
  }

  return h(
    'svg',
    {
      width: 96,
      height: 96,
      viewBox: '0 0 96 96',
      fill: 'none',
      'aria-hidden': 'true',
    },
    h('rect', {
      x: 20,
      y: 24,
      width: 56,
      height: 44,
      rx: 16,
      stroke,
      strokeWidth: 1.8,
    }),
    h('path', {
      d: 'M34 46h28',
      stroke,
      strokeWidth: 1.8,
      strokeLinecap: 'round',
    }),
    h('path', {
      d: 'M48 32v28',
      stroke,
      strokeWidth: 1.8,
      strokeLinecap: 'round',
    }),
    h('rect', {
      x: 28,
      y: 72,
      width: 40,
      height: 8,
      rx: 4,
      fill,
    })
  )
}

export function EmptyState({ resource = 'holdings', onAction }) {
  const meta = RESOURCE_META[resource] || RESOURCE_META.holdings
  const showAction = typeof onAction === 'function' && meta.actionLabel

  return h(
    Card,
    {
      'data-empty-state': resource,
      style: {
        marginBottom: 8,
        textAlign: 'center',
        padding: '28px 20px',
        borderStyle: 'solid',
        borderColor: alpha(C.border, 'd8'),
        background: alpha(C.card, 'f6'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          justifyItems: 'center',
          gap: 14,
        },
      },
      h(
        'div',
        {
          style: {
            width: 104,
            height: 104,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            border: `1px solid ${alpha(C.border, 'd6')}`,
            background: alpha(C.subtle, 'f0'),
            boxShadow: `${C.insetLine}, ${C.shadow}`,
          },
        },
        renderIllustration(resource)
      ),
      h(
        'div',
        {
          style: {
            fontSize: 11,
            color: C.textMute,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          },
        },
        meta.eyebrow
      ),
      h(
        'div',
        {
          style: {
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            lineHeight: 1.15,
            fontFamily: 'var(--font-headline)',
          },
        },
        meta.title
      ),
      h(
        'div',
        {
          style: {
            maxWidth: 420,
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.8,
          },
        },
        meta.description
      ),
      showAction &&
        h(
          Button,
          {
            onClick: onAction,
            style: {
              marginTop: 4,
              background: alpha(C.cta, '12'),
              border: `1px solid ${alpha(C.cta, '28')}`,
              color: C.text,
              padding: '10px 16px',
              textTransform: 'none',
              letterSpacing: '0.02em',
            },
          },
          meta.actionLabel
        )
    )
  )
}
