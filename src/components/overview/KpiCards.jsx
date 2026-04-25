import { createElement as h } from 'react'
import { Button, Card } from '../common/index.js'
import { ACTIVE_PORTFOLIO_KEY, OWNER_PORTFOLIO_ID } from '../../constants.js'
import { readStorageValue } from '../../lib/portfolioUtils.js'
import { C, alpha } from '../../theme.js'
import { calculateAnnualizedReturnFromHoldings } from '../../lib/portfolioMetrics.js'
import { usePortfolioMdd } from '../../hooks/usePortfolioMdd.js'

function formatPercent(value, { sign = true } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  const pct = value * 100
  const prefix = sign && pct > 0 ? '+' : ''
  return `${prefix}${pct.toFixed(1)}%`
}

function formatDateLabel(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '未知日期'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function flattenPortfolioHoldings(portfolios = []) {
  return (Array.isArray(portfolios) ? portfolios : []).flatMap((portfolio) =>
    Array.isArray(portfolio?.holdings) ? portfolio.holdings : []
  )
}

function resolveMddPortfolioId(portfolios = []) {
  const portfolioList = Array.isArray(portfolios) ? portfolios : []

  if (portfolioList.length === 0) return null
  if (portfolioList.length === 1) return String(portfolioList[0]?.id || '').trim() || null

  const activePortfolioId = String(readStorageValue(ACTIVE_PORTFOLIO_KEY) || '').trim()
  if (activePortfolioId && portfolioList.some((portfolio) => portfolio?.id === activePortfolioId)) {
    return activePortfolioId
  }

  const ownerPortfolio = portfolioList.find(
    (portfolio) => portfolio?.isOwner || portfolio?.id === OWNER_PORTFOLIO_ID
  )
  return String(ownerPortfolio?.id || portfolioList[0]?.id || '').trim() || null
}

function buildAnnualizedCard(holdings) {
  const annualized = calculateAnnualizedReturnFromHoldings(holdings)

  if (annualized.status === 'ok') {
    return {
      label: '年化報酬',
      value: formatPercent(annualized.annualizedReturn),
      variant:
        annualized.annualizedReturn > 0
          ? 'up'
          : annualized.annualizedReturn < 0
            ? 'down'
            : 'neutral',
      tooltip: `自 ${formatDateLabel(annualized.firstPurchaseDate)} 建倉至今，${Math.round(annualized.holdingDays)} 天化`,
      disabled: false,
    }
  }

  if (annualized.status === 'insufficient_period') {
    return {
      label: '年化報酬',
      value: '持有期不足',
      variant: 'neutral',
      tooltip: `自 ${formatDateLabel(annualized.firstPurchaseDate)} 建倉至今僅 ${Math.max(annualized.holdingDays, 0).toFixed(0)} 天，至少 30 天才顯示年化`,
      disabled: true,
    }
  }

  return {
    label: '年化報酬',
    value: '資料不足',
    variant: 'neutral',
    tooltip: '需要成本、現值與首筆買進日',
    disabled: true,
  }
}

function buildMddUnavailableCard() {
  return {
    label: '最大回撤',
    value: '需要歷史快照',
    variant: 'neutral',
    tooltip: '目前還沒有可查的歷史快照',
    disabled: true,
  }
}

function buildLoadingMddCard() {
  return {
    label: '最大回撤',
    value: '載入中…',
    variant: 'neutral',
    tooltip: '正在讀取歷史快照',
    disabled: false,
    loading: true,
  }
}

function buildErrorMddCard(_error, retry) {
  return {
    label: '最大回撤',
    value: '無法載入',
    variant: 'neutral',
    tooltip: '歷史快照暫時取不到，稍後再試。',
    disabled: false,
    actionLabel: '再試一次',
    onAction: retry,
  }
}

function buildInsufficientMddCard(data) {
  const snapshotDays = Number(data?.snapshots) || 0

  return {
    label: '最大回撤',
    value: '需要歷史快照',
    variant: 'neutral',
    tooltip: `已累積 ${snapshotDays}/7 天快照，至少 7 天才顯示最大回撤`,
    disabled: true,
  }
}

function buildReadyMddCard(data) {
  const peakDate = formatDateLabel(new Date(data?.peakDate))
  const troughDate = formatDateLabel(new Date(data?.troughDate))
  const peakLabel = typeof data?.peak === 'number' ? formatPercent(data.peak, { sign: false }) : '—'
  const troughLabel =
    typeof data?.trough === 'number' ? formatPercent(data.trough, { sign: false }) : '—'

  return {
    label: '最大回撤',
    value: formatPercent(-data.mdd, { sign: false }),
    variant: 'warning',
    tooltip: `峰值 ${peakDate}（${peakLabel}）→ 谷底 ${troughDate}（${troughLabel}）`,
    disabled: false,
  }
}

function buildMddCard(state) {
  if (state.loading) return buildLoadingMddCard()
  if (state.error) return buildErrorMddCard(state.error, state.retry)
  if (!state.data) return buildMddUnavailableCard()
  if (typeof state.data.mdd === 'number') return buildReadyMddCard(state.data)
  return buildInsufficientMddCard(state.data)
}

function KpiCard({
  label,
  value,
  variant = 'neutral',
  tooltip = '',
  disabled = false,
  loading = false,
  actionLabel = '',
  onAction = null,
}) {
  const valueColor = {
    up: C.text,
    down: 'var(--down)',
    warning: C.textSec,
    neutral: C.textSec,
  }[variant]

  return h(
    Card,
    {
      title: tooltip,
      'aria-disabled': disabled,
      'data-kpi-label': label,
      style: {
        background: `linear-gradient(180deg, ${alpha(C.cardBlue, 'c8')}, ${alpha(C.subtle, 'f4')})`,
        border: `1px solid ${alpha(C.ink, disabled ? '24' : '40')}`,
        padding: '16px 16px',
        minHeight: 126,
        opacity: disabled ? 0.82 : 1,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 16,
          height: '100%',
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
              marginBottom: 8,
            },
          },
          label
        ),
        loading
          ? h(
              'div',
              {
                'aria-label': `${label}-loading`,
                style: {
                  display: 'grid',
                  gap: 8,
                },
              },
              h('div', {
                style: {
                  width: '72%',
                  height: 18,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${alpha(C.ink, '10')}, ${alpha(C.ink, '28')}, ${alpha(C.ink, '10')})`,
                  backgroundSize: '200% 100%',
                  animation: 'overview-kpi-skeleton 1.4s ease-in-out infinite',
                },
              }),
              h('div', {
                style: {
                  width: '44%',
                  height: 12,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${alpha(C.ink, '0c')}, ${alpha(C.ink, '20')}, ${alpha(C.ink, '0c')})`,
                  backgroundSize: '200% 100%',
                  animation: 'overview-kpi-skeleton 1.4s ease-in-out infinite',
                },
              })
            )
          : h(
              'div',
              {
                className: 'tn',
                style: {
                  fontSize: 'clamp(28px, 4vw, 36px)',
                  lineHeight: 1,
                  fontWeight: 600,
                  color: valueColor,
                  fontFamily: 'var(--font-num)',
                },
              },
              value
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
        h(
          'div',
          {
            style: {
              fontSize: 11,
              lineHeight: 1.6,
              color: disabled ? C.textMute : C.textSec,
            },
          },
          tooltip
        ),
        actionLabel && typeof onAction === 'function'
          ? h(
              Button,
              {
                onClick: onAction,
                size: 'xs',
                color: 'blue',
                variant: 'ghost',
                style: { justifySelf: 'start' },
              },
              actionLabel
            )
          : null
      )
    )
  )
}

export function KpiCards({ portfolios = [], historicalSeries = null }) {
  void historicalSeries

  const holdings = flattenPortfolioHoldings(portfolios)
  const portfolioId = resolveMddPortfolioId(portfolios)
  const mddState = usePortfolioMdd(portfolioId)
  const cards = [buildAnnualizedCard(holdings), buildMddCard(mddState)]

  return h(
    'div',
    {
      className: 'kpi-cards',
      'data-testid': 'overview-kpi-cards',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 8,
        marginBottom: 8,
      },
    },
    h(
      'style',
      null,
      '@keyframes overview-kpi-skeleton { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }'
    ),
    cards.map((card) => h(KpiCard, { key: card.label, ...card }))
  )
}
