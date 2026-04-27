import { createElement as h, useMemo } from 'react'
import { Card, StaleBadge } from '../common'
import { C, alpha } from '../../theme.js'
import { computeSeasonality } from '../../lib/seasonalityMetrics.js'

const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]
const CACHE_PREFIX = 'fm-cache-revenue-'

function readRevenueCache(code) {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(`${CACHE_PREFIX}${code}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.data) ? parsed.data : []
  } catch {
    return []
  }
}

function formatRevenueInYi(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const yi = number / 100000000
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: yi >= 100 ? 0 : 1,
    maximumFractionDigits: yi >= 100 ? 0 : 1,
  }).format(yi)
}

function formatPct(value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (Math.abs(number) < 0.05) return '0%'
  const rounded = number.toFixed(digits)
  return `${number > 0 ? '+' : ''}${rounded}%`
}

function getCellBackground(indexedToYearMean) {
  if (!Number.isFinite(indexedToYearMean)) return alpha(C.textMute, '08')
  const normalized = Math.max(0, Math.min(1, (indexedToYearMean - 0.65) / 0.85))
  const opacity = 0.12 + normalized * 0.5
  return alpha(C.up, Number(opacity.toFixed(3)))
}

function getSeasonalityLabel(index) {
  if (index >= 0.65) return '高度季節性'
  if (index >= 0.35) return '中度季節性'
  return '低季節性'
}

function buildHeatmapRows(revenueRows = []) {
  const metrics = computeSeasonality(revenueRows)
  const matrixByKey = new Map(
    metrics.matrix.map((entry) => [`${entry[0]}-${String(entry[1]).padStart(2, '0')}`, entry])
  )
  const years = Array.from(new Set(metrics.matrix.map((entry) => entry[0])))
    .sort((a, b) => b - a)
    .slice(0, 5)

  return {
    metrics,
    years,
    rows: years.map((year) => ({
      year,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        const cell = matrixByKey.get(`${year}-${String(month).padStart(2, '0')}`) || null
        const monthAvg = metrics.monthAvgs[month]
        const revenueDeltaPct =
          cell && Number.isFinite(Number(monthAvg)) && Number(monthAvg) !== 0
            ? ((Number(cell[2]) - Number(monthAvg)) / Number(monthAvg)) * 100
            : null

        return {
          month,
          cell,
          monthAvg,
          revenueDeltaPct,
        }
      }),
    })),
  }
}

function SeasonalityCardHeader({ name, code, updatedAt = null }) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 8,
      },
    },
    h(
      'div',
      null,
      h(
        'div',
        {
          style: { fontSize: 12, color: C.textSec, fontWeight: 700, letterSpacing: '0.06em' },
        },
        '營收季節性'
      ),
      h(
        'div',
        { style: { fontSize: 12, color: C.text, fontWeight: 600, marginTop: 4 } },
        `${name} · ${code}`
      )
    ),
    h(StaleBadge, {
      resource: 'fundamentals',
      updatedAt,
      title: 'fundamentals freshness',
      'data-testid': `research-fundamentals-stale-badge-${code}`,
    })
  )
}

function EmptySeasonalityCard({ name, code, updatedAt = null }) {
  return h(
    Card,
    {
      style: {
        border: '1px dashed var(--positive-soft)',
        background: alpha(C.card, 'f2'),
      },
    },
    h(SeasonalityCardHeader, { name, code, updatedAt }),
    h('div', { style: { fontSize: 11, color: C.textMute, lineHeight: 1.7 } }, '資料尚未取得')
  )
}

function EmptySeasonalitySection({ holdingsCount }) {
  return h(
    Card,
    {
      style: {
        border: '1px dashed var(--positive-soft)',
        background: alpha(C.card, 'f2'),
        marginBottom: 8,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
        },
      },
      h('div', { style: { fontSize: 12, color: C.textSec, fontWeight: 700 } }, '營收季節性'),
      h(
        'div',
        { style: { fontSize: 12, color: C.textMute, lineHeight: 1.7 } },
        `資料尚未收齊，等下次更新${holdingsCount ? `（${holdingsCount} 檔）` : ''}`
      )
    )
  )
}

function MissingSeasonalitySummary({ missingCards }) {
  const labels = missingCards
    .map(({ holding }) => [holding?.code, holding?.name].filter(Boolean).join(' '))
    .filter(Boolean)

  return h(
    Card,
    {
      variant: 'subtle',
      style: {
        border: `1px solid ${C.borderSub}`,
        background: alpha(C.card, 'f2'),
        marginBottom: 8,
        gridColumn: '1 / -1',
      },
      'data-testid': 'seasonality-missing-summary',
    },
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textMute,
          lineHeight: 1.7,
        },
      },
      `另 ${missingCards.length} 檔尚未取得月營收：${labels.join(' / ')}`
    )
  )
}

function SeasonalityCard({ holding, revenueRows, updatedAt = null }) {
  const { metrics, rows, years } = useMemo(() => buildHeatmapRows(revenueRows), [revenueRows])

  if (metrics.matrix.length === 0 || years.length === 0) {
    return h(EmptySeasonalityCard, { name: holding.name, code: holding.code, updatedAt })
  }

  return h(
    Card,
    {
      highlighted: true,
      color: C.textSec,
      style: {
        border: '1px solid var(--positive-soft)',
        background: alpha(C.card, 'fa'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 8,
          marginBottom: 8,
        },
      },
      h(SeasonalityCardHeader, { name: holding.name, code: holding.code, updatedAt }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          },
        },
        h('div', { style: { fontSize: 12, color: C.textMute } }, `12 月 × ${years.length} 年`),
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textSec,
              border: '1px solid var(--positive-soft)',
              background: alpha(C.iron, '16'),
              borderRadius: 8,
              padding: '4px 8px',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            },
          },
          `${getSeasonalityLabel(metrics.seasonalityIndex)} · ${Math.round(metrics.seasonalityIndex * 100)}`
        )
      )
    ),
    h('style', null, liveHeatmapMobileStyle),
    h(
      'div',
      {
        className: 'seasonality-heatmap-scroll',
        'data-testid': `seasonality-heatmap-scroll-${holding.code}`,
        style: {
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
        },
      },
      h(
        'div',
        {
          className: 'seasonality-heatmap-grid',
          style: {
            display: 'grid',
            gridTemplateColumns: '52px repeat(12, minmax(44px, 1fr))',
            gap: 4,
            alignItems: 'stretch',
            minWidth: 640,
          },
        },
        h('div'),
        MONTH_LABELS.map((label) =>
          h(
            'div',
            {
              key: label,
              style: {
                fontSize: 11,
                color: C.textMute,
                textAlign: 'center',
                paddingBottom: 4,
              },
            },
            label
          )
        ),
        rows.flatMap((row) => [
          h(
            'div',
            {
              key: `${row.year}-label`,
              style: {
                fontSize: 12,
                color: C.textSec,
                fontFamily: 'var(--font-num)',
                display: 'flex',
                alignItems: 'center',
              },
            },
            String(row.year)
          ),
          ...row.months.map(({ month, cell, revenueDeltaPct }) =>
            h(
              'div',
              {
                key: `${row.year}-${month}`,
                title: cell
                  ? `${row.year}-${String(month).padStart(2, '0')} 營收 ${formatRevenueInYi(cell[2])} 億 (vs 該月歷史 ${formatPct(revenueDeltaPct)})`
                  : `${row.year}-${String(month).padStart(2, '0')} 無資料`,
                style: {
                  minHeight: 36,
                  borderRadius: 7,
                  border: `1px solid ${cell ? alpha(C.iron, '26') : alpha(C.textMute, '10')}`,
                  background: cell ? getCellBackground(cell[4]) : alpha(C.textMute, '05'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: cell && Number(cell[4]) >= 1 ? C.text : C.textSec,
                  fontFamily: 'var(--font-num)',
                  lineHeight: 1.15,
                  textAlign: 'center',
                },
              },
              cell ? formatRevenueInYi(cell[2]) : '—'
            )
          ),
        ])
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
          marginTop: 8,
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.7,
        },
      },
      h(
        'div',
        null,
        `旺月：${metrics.bestMonths.map((month) => MONTH_LABELS[month - 1]).join('、') || '—'}`
      ),
      h(
        'div',
        null,
        `淡月：${metrics.worstMonths.map((month) => MONTH_LABELS[month - 1]).join('、') || '—'}`
      ),
      h(
        'div',
        { style: { color: C.textMute } },
        '色階以各年平均營收為基準標準化，避免長期成長把季節性洗掉。'
      )
    )
  )
}

const liveHeatmapMobileStyle = `
@media (max-width: 768px) {
  .seasonality-heatmap-scroll {
    margin-left: -2px;
    margin-right: -2px;
  }

  .seasonality-heatmap-grid {
    min-width: 720px !important;
    grid-template-columns: 56px repeat(12, minmax(50px, 1fr)) !important;
  }
}
`

export function SeasonalityHeatmap({ holdings, holdingDossiers = [] }) {
  const dossierByCode = useMemo(
    () =>
      new Map(
        (Array.isArray(holdingDossiers) ? holdingDossiers : []).map((dossier) => [
          dossier.code,
          dossier,
        ])
      ),
    [holdingDossiers]
  )

  const cards = useMemo(
    () =>
      (Array.isArray(holdings) ? holdings : []).map((holding) => ({
        holding,
        revenueRows: readRevenueCache(holding.code),
        updatedAt: dossierByCode.get(holding.code)?.fundamentals?.updatedAt || null,
      })),
    [dossierByCode, holdings]
  )

  if (cards.length === 0) return null

  const dataCards = cards.filter(({ revenueRows }) => revenueRows.length > 0)
  const missingCards = cards.filter(({ revenueRows }) => revenueRows.length === 0)

  if (dataCards.length === 0) return h(EmptySeasonalitySection, { holdingsCount: cards.length })

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gap: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        marginBottom: 8,
      },
    },
    dataCards.map(({ holding, revenueRows, updatedAt }) =>
      h(SeasonalityCard, {
        key: holding.code,
        holding,
        revenueRows,
        updatedAt,
      })
    ),
    missingCards.length > 0 && h(MissingSeasonalitySummary, { missingCards })
  )
}

export default SeasonalityHeatmap
