import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { getPeerRankingForHolding } from '../../lib/peerRanking.js'

const toneStyles = {
  leader: {
    color: C.textSec,
    background: C.upBg,
    borderColor: alpha(C.up, '28'),
    dot: C.up,
  },
  neutral: {
    color: C.textMute,
    background: alpha(C.textMute, '10'),
    borderColor: alpha(C.textMute, '20'),
  },
  laggard: {
    color: C.down,
    background: C.downBg,
    borderColor: alpha(C.down, '28'),
    dot: C.down,
  },
}

function formatDelta(value, label) {
  if (value == null || !label) return null
  const verb = value > 0 ? '領先' : value < 0 ? '落後' : '持平'
  return `${verb} ${Math.abs(value).toFixed(1)}% (vs ${label})`
}

export function PeerRankingBadge({ holding }) {
  const ranking = getPeerRankingForHolding(holding)
  if (ranking.stockChangePct == null) return null

  const chips = [
    formatDelta(ranking.vsIndustry, ranking.industryLabel),
    formatDelta(ranking.vsMarket, ranking.marketLabel),
  ].filter(Boolean)

  if (chips.length === 0) return null

  const tone = toneStyles[ranking.rank] || toneStyles.neutral

  return h(
    'div',
    {
      title: `${ranking.label} · benchmark: ${ranking.benchmarkSource}`,
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
      },
    },
    chips.map((chip) =>
      h(
        'span',
        {
          key: chip,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            lineHeight: 1.2,
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 8,
            border: `1px solid ${tone.borderColor}`,
            background: tone.background,
            color: tone.color,
          },
        },
        tone.dot &&
          h('span', {
            'aria-hidden': 'true',
            style: {
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tone.dot,
              flexShrink: 0,
            },
          }),
        chip
      )
    )
  )
}
