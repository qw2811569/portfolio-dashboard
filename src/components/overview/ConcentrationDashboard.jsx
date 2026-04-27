import { createElement as h } from 'react'
import { Badge, Card } from '../common/index.js'
import { C, alpha } from '../../theme.js'
import { calculateConcentration } from '../../lib/concentrationMetrics.js'

function getRiskMeta(risk) {
  switch (risk) {
    case 'critical':
      return { label: '高度集中', badgeColor: 'warning', accent: C.down }
    case 'high':
      return { label: '偏高', badgeColor: 'warning', accent: C.warning }
    case 'moderate':
      return { label: '中度集中', badgeColor: 'mute', accent: C.iron }
    default:
      return { label: '分散', badgeColor: 'positive', accent: C.positive }
  }
}

function WeightBar({ label, value, tone = C.ink, solid = false }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)))

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: '56px minmax(0, 1fr) 40px',
        gap: 8,
        alignItems: 'center',
      },
    },
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.textSec,
          fontWeight: 600,
        },
      },
      label
    ),
    h(
      'div',
      {
        'aria-hidden': true,
        style: {
          height: 10,
          borderRadius: 999, // pill 999 keep: linear concentration track needs rounded caps
          overflow: 'hidden',
          background: solid ? alpha(tone, '18') : alpha(C.ink, '14'),
          border: `1px solid ${alpha(tone, '24')}`,
          position: 'relative',
        },
      },
      h('div', {
        style: {
          width: `${percent}%`,
          height: '100%',
          background: solid ? alpha(tone, 'b8') : alpha(C.ink, '70'),
          borderRadius: 999, // pill 999 keep: linear concentration fill needs rounded caps
        },
      })
    ),
    h(
      'div',
      {
        className: 'tn',
        style: {
          fontSize: 11,
          color: C.textSec,
          textAlign: 'right',
          fontFamily: 'var(--font-num)',
        },
      },
      `${percent}%`
    )
  )
}

export function ConcentrationDashboard({ holdings = [], stockMeta = null }) {
  const concentration = calculateConcentration(holdings, { stockMeta })
  const riskMeta = getRiskMeta(concentration.risk)

  return h(
    Card,
    {
      'data-testid': 'concentration-dashboard',
      style: {
        marginBottom: 8,
        background: alpha(C.card, 'fb'),
        border: `1px solid ${alpha(riskMeta.accent, '28')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 16,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          null,
          h(
            'div',
            {
              style: {
                fontSize: 12,
                color: C.textMute,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 4,
              },
            },
            '組合集中度'
          ),
          h(
            'div',
            {
              style: {
                fontSize: 12,
                color: C.textSec,
                lineHeight: 1.6,
              },
            },
            '檢查持股與產業是否過度擠在同一籃子。'
          )
        ),
        h(Badge, { color: riskMeta.badgeColor, size: 'sm' }, riskMeta.label)
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 8,
            alignItems: 'end',
          },
        },
        h(
          'div',
          null,
          h(
            'div',
            {
              style: {
                fontSize: 12,
                color: C.textMute,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 4,
              },
            },
            '集中度指數'
          ),
          h(
            'div',
            {
              className: 'tn',
              style: {
                fontSize: 'clamp(28px, 4vw, 40px)',
                lineHeight: 1,
                color: C.text,
                fontWeight: 600,
                fontFamily: 'var(--font-num)',
              },
            },
            concentration.hhi.toLocaleString()
          )
        ),
        h(
          'div',
          {
            style: {
              fontSize: 11,
              color: C.textSec,
              textAlign: 'right',
            },
          },
          concentration.hhi >= 2500
            ? '高度集中（> 2500）'
            : concentration.hhi >= 1500
              ? '中度集中（1500-2500）'
              : '低度集中（< 1500）'
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 8,
          },
        },
        h(WeightBar, { label: 'Top 1', value: concentration.top1Weight }),
        h(WeightBar, { label: '前 3 大', value: concentration.top3Weight }),
        h(WeightBar, { label: '前 5 大', value: concentration.top5Weight })
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 8,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textMute,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
            },
          },
          '產業分布'
        ),
        concentration.industryBreakdown.length === 0
          ? h('div', { style: { fontSize: 11, color: C.textMute } }, '目前沒有可計算的持股市值。')
          : concentration.industryBreakdown.slice(0, 5).map((item) =>
              h(WeightBar, {
                key: item.industry,
                label: item.industry,
                value: item.weight,
                tone: riskMeta.accent,
                solid: true,
              })
            )
      ),
      concentration.warnings.length > 0 &&
        h(
          'div',
          {
            style: {
              display: 'grid',
              gap: 4,
              padding: '12px 12px',
              borderRadius: 12,
              background: alpha(C.amber, '10'),
              border: `1px solid ${alpha(C.amber, '22')}`,
            },
          },
          concentration.warnings.map((warning) =>
            h(
              'div',
              {
                key: warning,
                style: {
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: C.textSec,
                },
              },
              `注意：${warning}`
            )
          )
        )
    )
  )
}
