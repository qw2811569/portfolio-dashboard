import { createElement as h } from 'react'
import { Badge, Card } from '../common/index.js'
import { C, alpha } from '../../theme.js'
import { calculateConcentration } from '../../lib/concentrationMetrics.js'

function getRiskMeta(risk) {
  switch (risk) {
    case 'critical':
      return { label: '高度集中', badgeColor: 'amber', accent: C.down }
    case 'high':
      return { label: '偏高', badgeColor: 'amber', accent: C.amber }
    case 'moderate':
      return { label: '中度集中', badgeColor: 'olive', accent: C.olive }
    default:
      return { label: '分散', badgeColor: 'teal', accent: C.teal }
  }
}

function WeightBar({ label, value, tone = C.blue, solid = false }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)))

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: '56px minmax(0, 1fr) 40px',
        gap: 10,
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
          borderRadius: 999,
          overflow: 'hidden',
          background: solid
            ? alpha(tone, '18')
            : `linear-gradient(90deg, ${alpha(C.blue, '14')}, ${alpha(C.olive, '10')})`,
          border: `1px solid ${alpha(tone, '24')}`,
          position: 'relative',
        },
      },
      h('div', {
        style: {
          width: `${percent}%`,
          height: '100%',
          background: solid
            ? `linear-gradient(90deg, ${alpha(tone, '78')}, ${alpha(tone, 'b8')})`
            : `linear-gradient(90deg, ${alpha(C.blue, '70')}, ${alpha(C.olive, 'b8')})`,
          borderRadius: 999,
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
        background: `linear-gradient(180deg, ${alpha(C.cardBlue, 'd6')}, ${alpha(C.card, 'fb')})`,
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
                fontSize: 10,
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
            gap: 10,
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
                fontSize: 10,
                color: C.textMute,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 6,
              },
            },
            'HHI'
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
            ? 'HHI > 2500'
            : concentration.hhi >= 1500
              ? 'HHI 1500-2500'
              : 'HHI < 1500'
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 10,
          },
        },
        h(WeightBar, { label: 'Top 1', value: concentration.top1Weight }),
        h(WeightBar, { label: 'Top 3', value: concentration.top3Weight }),
        h(WeightBar, { label: 'Top 5', value: concentration.top5Weight })
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 10,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 10,
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
              gap: 6,
              padding: '12px 14px',
              borderRadius: 16,
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
              `⚠ ${warning}`
            )
          )
        )
    )
  )
}
