import { C, alpha } from '../../theme.js'
import { groupHoldingsByStrategy } from '../../lib/holdings.js'

const STRATEGY_BAR_COLOR = C.charcoal
const DOMINANT_STRATEGY_BAR_COLOR = C.cta

function buildStockMetaWithDossiers(stockMeta, holdingDossiers) {
  const merged = { ...(stockMeta && typeof stockMeta === 'object' ? stockMeta : {}) }

  for (const dossier of Array.isArray(holdingDossiers) ? holdingDossiers : []) {
    const code = String(dossier?.code || '').trim()
    if (!code) continue
    merged[code] = {
      ...(merged[code] || {}),
      ...(dossier?.stockMeta || {}),
      classification: dossier?.classification || merged[code]?.classification,
    }
  }

  return merged
}

export default function HoldingsByStrategyBreakdown({
  holdings = [],
  totalVal = 0,
  stockMeta = null,
  holdingDossiers = [],
  compact = false,
}) {
  const mergedMeta = buildStockMetaWithDossiers(stockMeta, holdingDossiers)
  const rows = groupHoldingsByStrategy(holdings, mergedMeta)
  const total =
    totalVal > 0 ? totalVal : rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  const maxValue = Math.max(0, ...rows.map((row) => Number(row.value) || 0))

  return (
    <div style={{ display: 'grid', gap: compact ? 10 : 16 }}>
      <div style={{ display: 'grid', gap: compact ? 2 : 4 }}>
        <div
          style={{
            fontSize: compact ? 12 : 14,
            color: C.textMute,
            fontFamily: 'var(--font-body)',
          }}
        >
          持倉結構
        </div>
        {!compact && (
          <div
            style={{
              fontSize: 12,
              color: C.textMute,
              lineHeight: 1.6,
            }}
          >
            依策略分類看資金配置，先確認組合是不是符合原本打法。
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: compact ? 8 : 10 }}>
        {rows.length === 0 ? (
          <div
            style={{
              padding: '16px 0',
              color: C.textMute,
              fontSize: 13,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            尚無可計算市值的持倉。
          </div>
        ) : (
          rows.map((row) => {
            const pct = total > 0 ? (row.value / total) * 100 : row.weight * 100
            const safePct = Math.max(2, Math.min(100, pct))
            const color =
              maxValue > 0 && Number(row.value) === maxValue
                ? DOMINANT_STRATEGY_BAR_COLOR
                : STRATEGY_BAR_COLOR

            return (
              <div
                key={row.key}
                data-testid="holdings-strategy-row"
                style={{
                  display: 'grid',
                  gap: compact ? 4 : 6,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'baseline',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: C.text,
                        fontSize: compact ? 12 : 13,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.label}
                    </div>
                    {!compact && (
                      <div style={{ color: C.textMute, fontSize: 11, marginTop: 2 }}>
                        {row.count} 檔 · {Math.round(row.value).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div
                    className="tn"
                    style={{ color: C.textSec, fontWeight: 700, fontSize: compact ? 12 : 13 }}
                  >
                    {pct.toFixed(1)}%
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  style={{
                    height: compact ? 6 : 8,
                    borderRadius: 999,
                    overflow: 'hidden',
                    background: alpha(C.text, '10'),
                  }}
                >
                  <div
                    data-testid="strategy-bar-fill"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 999,
                      background: color,
                      transform: `scaleX(${safePct / 100})`,
                      transformOrigin: 'left center',
                      '--bar-pct': `scaleX(${safePct / 100})`,
                      animation: 'strategy-bar-grow 300ms ease-out 1',
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
