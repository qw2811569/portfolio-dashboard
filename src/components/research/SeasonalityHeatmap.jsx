import { createElement as h, useMemo } from 'react'
import { Card } from '../common'
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

function EmptySeasonalityCard({ name, code }) {
  return h(
    Card,
    {
      style: {
        border: '1px dashed var(--positive-soft)',
        background: `linear-gradient(180deg, ${alpha(C.card, 'f2')}, ${alpha(C.cardBlue, 'c8')})`,
      },
    },
    h(
      'div',
      {
        style: { fontSize: 10, color: 'var(--positive)', fontWeight: 700, letterSpacing: '0.06em' },
      },
      '營收季節性'
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.text, fontWeight: 600, marginTop: 6 } },
      `${name} · ${code}`
    ),
    h(
      'div',
      { style: { fontSize: 11, color: C.textMute, lineHeight: 1.7, marginTop: 10 } },
      '資料尚未取得'
    )
  )
}

function SeasonalityCard({ holding, revenueRows }) {
  const { metrics, rows, years } = useMemo(() => buildHeatmapRows(revenueRows), [revenueRows])

  if (metrics.matrix.length === 0 || years.length === 0) {
    return h(EmptySeasonalityCard, { name: holding.name, code: holding.code })
  }

  return h(
    Card,
    {
      highlighted: true,
      color: 'var(--positive)',
      style: {
        border: '1px solid var(--positive-soft)',
        background: `linear-gradient(180deg, ${alpha(C.card, 'fa')}, ${alpha(C.cardBlue, 'd4')})`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
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
              color: 'var(--positive)',
              fontWeight: 700,
              letterSpacing: '0.06em',
            },
          },
          '營收季節性'
        ),
        h(
          'div',
          { style: { fontSize: 12, color: C.text, fontWeight: 600, marginTop: 4 } },
          `${holding.name} · ${holding.code}`
        ),
        h(
          'div',
          { style: { fontSize: 10, color: C.textMute, marginTop: 4 } },
          `12 月 × ${years.length} 年`
        )
      ),
      h(
        'div',
        {
          style: {
            fontSize: 10,
            color: 'var(--positive)',
            border: '1px solid var(--positive-soft)',
            background: alpha(C.olive, '16'),
            borderRadius: 999,
            padding: '4px 8px',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          },
        },
        `${getSeasonalityLabel(metrics.seasonalityIndex)} · ${Math.round(metrics.seasonalityIndex * 100)}`
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '52px repeat(12, minmax(0, 1fr))',
          gap: 4,
          alignItems: 'stretch',
        },
      },
      h('div'),
      MONTH_LABELS.map((label) =>
        h(
          'div',
          {
            key: label,
            style: {
              fontSize: 9,
              color: C.textMute,
              textAlign: 'center',
              paddingBottom: 2,
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
              fontSize: 10,
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
                minHeight: 28,
                borderRadius: 7,
                border: `1px solid ${cell ? alpha(C.olive, '26') : alpha(C.textMute, '10')}`,
                background: cell ? getCellBackground(cell[4]) : alpha(C.textMute, '05'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                color: cell && Number(cell[4]) >= 1 ? C.text : C.textSec,
                fontFamily: 'var(--font-num)',
              },
            },
            cell ? formatRevenueInYi(cell[2]) : '—'
          )
        ),
      ])
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
          marginTop: 10,
          fontSize: 10,
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

export function SeasonalityHeatmap({ holdings }) {
  const cards = useMemo(
    () =>
      (Array.isArray(holdings) ? holdings : []).map((holding) => ({
        holding,
        revenueRows: readRevenueCache(holding.code),
      })),
    [holdings]
  )

  if (cards.length === 0) return null

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        marginBottom: 10,
      },
    },
    cards.map(({ holding, revenueRows }) =>
      h(SeasonalityCard, {
        key: holding.code,
        holding,
        revenueRows,
      })
    )
  )
}

export default SeasonalityHeatmap
