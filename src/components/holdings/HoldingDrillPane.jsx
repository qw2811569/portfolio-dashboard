import { useEffect, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { DataError, SoftMessage, StaleBadge } from '../common/index.js'
import { getViewModeComplianceMessage, isViewModeEnabled } from '../../lib/viewModeContract.js'
import { normalizeDataError } from '../../lib/dataError.js'

const valuationCache = new Map()

const panelCard = {
  background: `linear-gradient(180deg, ${C.card}, ${alpha(C.subtle, 'f6')})`,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '12px 12px 8px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
  minHeight: 122,
}

const eyebrow = {
  fontSize: 9,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 700,
  marginBottom: 8,
}

const pillTone = {
  positive: { color: C.up, background: C.upBg, border: alpha(C.up, '28') },
  warning: { color: C.amber, background: alpha(C.amber, '12'), border: alpha(C.amber, '30') },
  negative: { color: C.down, background: C.downBg, border: alpha(C.down, '30') },
  muted: {
    color: C.textMute,
    background: alpha(C.textMute, '10'),
    border: alpha(C.textMute, '22'),
  },
}

const pillarTone = {
  intact: { dot: C.up, label: '維持' },
  weakened: { dot: C.amber, label: '轉弱' },
  broken: { dot: C.down, label: '失真' },
}

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCurrency(value, { digits = 0, fallback = '—' } = {}) {
  const number = toFiniteNumber(value)
  if (number == null) return fallback
  return `${number.toLocaleString('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} 元`
}

function formatPercent(value, digits = 1) {
  const number = toFiniteNumber(value)
  if (number == null) return null
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}%`
}

function formatDateLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10).replace(/-/g, '/')
  return parsed.toISOString().slice(0, 10).replace(/-/g, '/')
}

function normalizePillarStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (['broken', 'invalidated'].includes(normalized)) return 'broken'
  if (['watch', 'behind', 'weakened'].includes(normalized)) return 'weakened'
  return 'intact'
}

function resolveTargetSourceLabel(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase()

  if (normalized === 'per-band') return '歷史 PER 區間'
  if (normalized === 'cnyes') return 'Cnyes 共識'
  if (normalized === 'cmoney') return 'CMoney 投顧'
  if (normalized === 'gemini') return 'AI 搜尋整理'
  if (normalized === 'analyst' || normalized === 'analyst-reports') return '券商報告'
  if (normalized === 'seed') return '手動 dossier'
  return ''
}

function getCurrentPrice(holding, dossier) {
  return toFiniteNumber(
    holding?.price ?? holding?.currentPrice ?? dossier?.position?.price ?? dossier?.currentPrice
  )
}

function getThesisStatement(thesis) {
  return String(thesis?.statement || thesis?.reason || thesis?.expectation || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildTargetSnapshot(dossier) {
  const targets = Array.isArray(dossier?.targets) ? dossier.targets : []
  const aggregate =
    dossier?.targetAggregate && typeof dossier.targetAggregate === 'object'
      ? dossier.targetAggregate
      : null
  const thesisTarget = toFiniteNumber(dossier?.thesis?.targetPrice)

  if (targets.length > 0) {
    const topTarget = targets[0]
    return {
      kind: topTarget?.targetType === 'aggregate' ? 'aggregate' : 'report',
      label: topTarget?.targetType === 'aggregate' ? '市場共識中位' : '最新目標價',
      firm: String(topTarget?.firm || '').trim() || resolveTargetSourceLabel(dossier?.targetSource),
      target: toFiniteNumber(topTarget?.target),
      reportsCount: targets.length,
      date: topTarget?.date || aggregate?.rateDate || null,
    }
  }

  if (aggregate) {
    return {
      kind: 'aggregate',
      label: '市場共識中位',
      firm: resolveTargetSourceLabel(dossier?.targetSource),
      target: toFiniteNumber(
        aggregate?.medianTarget ?? aggregate?.meanTarget ?? aggregate?.highTarget ?? aggregate?.max
      ),
      reportsCount: toFiniteNumber(aggregate?.firmsCount ?? aggregate?.numEst),
      date: aggregate?.rateDate || null,
    }
  }

  if (thesisTarget != null) {
    return {
      kind: 'thesis',
      label: '原始 thesis 目標',
      firm: '自己的交易計畫',
      target: thesisTarget,
      reportsCount: null,
      date: dossier?.thesis?.updatedAt || dossier?.thesis?.createdAt || null,
    }
  }

  return null
}

function useHoldingValuation(code) {
  const normalizedCode = String(code || '').trim()
  const cached = normalizedCode ? valuationCache.get(normalizedCode) : null
  const [resolved, setResolved] = useState(() => ({
    code: cached ? normalizedCode : '',
    data: cached || null,
    error: null,
    pending: false,
  }))

  useEffect(() => {
    if (!normalizedCode) return undefined
    if (cached) return undefined

    const controller = new AbortController()
    let active = true

    fetch(`/api/valuation?code=${encodeURIComponent(normalizedCode)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (response.status === 304) {
          return { status: 'pending', data: null, error: null }
        }
        if (!response.ok) {
          const error = new Error(`valuation fetch failed (${response.status})`)
          error.status = response.status
          throw error
        }

        const payload = await response.json()
        valuationCache.set(normalizedCode, payload)
        return { code: normalizedCode, data: payload, error: null, pending: false }
      })
      .then((nextValue) => {
        if (!active) return
        if (nextValue.status === 'pending') {
          setResolved({
            code: normalizedCode,
            data: null,
            error: null,
            pending: true,
          })
          return
        }
        setResolved(nextValue)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setResolved({
          code: normalizedCode,
          data: null,
          error,
          pending: false,
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [cached, normalizedCode])

  if (!normalizedCode) {
    return { status: 'idle', data: null, error: null }
  }
  if (cached) {
    return { status: 'ready', data: cached, error: null }
  }
  if (resolved.code !== normalizedCode) {
    return { status: 'loading', data: null, error: null }
  }
  if (resolved.pending) {
    return { status: 'pending', data: null, error: null }
  }
  if (resolved.error) {
    return { status: 'error', data: null, error: resolved.error }
  }
  if (resolved.data) {
    return { status: 'ready', data: resolved.data, error: null }
  }
  return { status: 'loading', data: null, error: null }
}

function TonePill({ tone = 'muted', children }) {
  const meta = pillTone[tone] || pillTone.muted

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: C.text,
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1.2,
      }}
    >
      <span aria-hidden="true" style={{ color: meta.color, fontSize: 10 }}>
        {tone === 'positive' ? '▼' : tone === 'negative' ? '▲' : tone === 'warning' ? '▲' : '•'}
      </span>
      <span>{children}</span>
    </span>
  )
}

function ValuationSkeleton() {
  return (
    <div style={panelCard}>
      <div style={eyebrow}>估值區間</div>
      <div
        aria-label="valuation-loading"
        style={{
          display: 'grid',
          gap: 8,
        }}
      >
        {[68, 100, 84].map((width, index) => (
          <div
            key={index}
            style={{
              width: `${width}%`,
              height: 10,
              borderRadius: 999,
              background: alpha(C.textMute, '14'),
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ThesisCard({ dossier }) {
  const thesis = dossier?.thesis
  const statement = getThesisStatement(thesis)
  const pillars = Array.isArray(thesis?.pillars)
    ? thesis.pillars
        .map((pillar, index) => ({
          id:
            pillar?.id || pillar?.label || pillar?.text || `${pillar?.status || 'pillar'}-${index}`,
          label: String(pillar?.label || pillar?.text || '').trim(),
          status: normalizePillarStatus(pillar?.status),
        }))
        .filter((pillar) => pillar.label)
        .slice(0, 3)
    : []

  return (
    <div style={{ ...panelCard, minHeight: 148 }}>
      <div style={eyebrow}>當初買進理由</div>
      {statement ? (
        <p
          style={{
            margin: 0,
            color: C.text,
            fontSize: 11,
            lineHeight: 1.6,
            fontWeight: 600,
          }}
        >
          {statement}
        </p>
      ) : (
        <SoftMessage>這檔當初買進理由還沒整理成卡片，先留一個位置等 thesis 補齊。</SoftMessage>
      )}
      {pillars.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: 8,
            marginTop: 8,
          }}
        >
          {pillars.map((pillar) => {
            const meta = pillarTone[pillar.status] || pillarTone.intact
            return (
              <div
                key={pillar.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '10px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: meta.dot,
                    boxShadow: `0 0 0 2px ${alpha(meta.dot, '1c')}`,
                  }}
                />
                <span style={{ color: C.text }}>{pillar.label}</span>
                <span style={{ color: C.textMute, fontSize: 9 }}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      ) : statement ? (
        <SoftMessage style={{ marginTop: 8 }}>
          pillar 追蹤點還沒拆開，先用一句 thesis 扛著看。
        </SoftMessage>
      ) : null}
    </div>
  )
}

function ValuationCard({ holding, dossier }) {
  const currentPrice = getCurrentPrice(holding, dossier)
  const valuationState = useHoldingValuation(holding?.code)
  const valuation = valuationState.data

  if (valuationState.status === 'loading') {
    return <ValuationSkeleton />
  }

  if (valuationState.status === 'pending') {
    return (
      <div style={panelCard}>
        <div style={eyebrow}>估值區間</div>
        <SoftMessage>估值計算中 · 明早 06:00 自動更新</SoftMessage>
      </div>
    )
  }

  if (valuationState.status === 'error') {
    return (
      <div style={panelCard}>
        <div style={eyebrow}>估值區間</div>
        <SoftMessage>估值資料暫時還沒跟上，晚點再回來看一眼。</SoftMessage>
      </div>
    )
  }

  if (valuation?.method === 'eps-negative') {
    return (
      <div style={panelCard}>
        <div style={eyebrow}>估值區間</div>
        <SoftMessage tone="negative">EPS 負 · 本益比不適用</SoftMessage>
      </div>
    )
  }

  if (valuation?.method !== 'historical-per-band') {
    const isEmerging = String(dossier?.stockMeta?.market || '').trim() === '興櫃'
    return (
      <div style={panelCard}>
        <div style={eyebrow}>估值區間</div>
        <SoftMessage>
          {isEmerging
            ? '興櫃公開資訊少 · 本系統先不硬算估值。'
            : '財報樣本還不夠齊，這一段先保持誠實空檔。'}
        </SoftMessage>
      </div>
    )
  }

  const lowerBound = toFiniteNumber(valuation?.lowerBound)
  const midPoint = toFiniteNumber(valuation?.midPoint)
  const upperBound = toFiniteNumber(valuation?.upperBound)
  const bandSpan =
    lowerBound != null && upperBound != null && upperBound > lowerBound
      ? upperBound - lowerBound
      : 0
  const markerRatio =
    bandSpan > 0 && currentPrice != null
      ? Math.min(1, Math.max(0, (currentPrice - lowerBound) / bandSpan))
      : 0.5
  const position = String(valuation?.positionInBand || 'within')
    .trim()
    .toLowerCase()
  const positionTone =
    position === 'below' ? 'positive' : position === 'above' ? 'warning' : 'muted'
  const positionLabel =
    position === 'below' ? '偏低一點' : position === 'above' ? '偏貴' : '落在區間內'

  return (
    <div style={panelCard}>
      <div style={eyebrow}>估值區間</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
          {formatCurrency(lowerBound)} - {formatCurrency(upperBound)}
        </div>
        <TonePill tone={positionTone}>{positionLabel}</TonePill>
      </div>
      <div
        style={{
          position: 'relative',
          height: 8,
          marginTop: 12,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${alpha(C.up, '24')}, ${alpha(C.amber, '16')})`,
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -3,
            left: `calc(${markerRatio * 100}% - 5px)`,
            width: 10,
            height: 14,
            borderRadius: 999,
            background: C.text,
            boxShadow: `0 0 0 2px ${C.card}`,
          }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 4,
          marginTop: 8,
          fontSize: 9,
        }}
      >
        <div style={{ color: C.textMute }}>
          低標
          <div style={{ color: C.text, fontFamily: 'var(--font-num)', marginTop: 4 }}>
            {formatCurrency(lowerBound)}
          </div>
        </div>
        <div style={{ color: C.textMute }}>
          中位
          <div style={{ color: C.text, fontFamily: 'var(--font-num)', marginTop: 4 }}>
            {formatCurrency(midPoint)}
          </div>
        </div>
        <div style={{ color: C.textMute }}>
          現價
          <div style={{ color: C.text, fontFamily: 'var(--font-num)', marginTop: 4 }}>
            {formatCurrency(currentPrice)}
          </div>
        </div>
      </div>
      <div style={{ color: C.textMute, fontSize: 9, lineHeight: 1.6, marginTop: 8 }}>
        {valuation?.note || '歷史區間估值'}
      </div>
    </div>
  )
}

function TargetCard({ holding, dossier }) {
  const targetFetchError = normalizeDataError(dossier?.targetFetchError, {
    resource: 'target-prices',
  })
  const target = buildTargetSnapshot(dossier)
  const currentPrice = getCurrentPrice(holding, dossier)
  const isEmerging = String(dossier?.stockMeta?.market || '').trim() === '興櫃'

  if (targetFetchError?.status) {
    return (
      <div style={panelCard}>
        <div style={eyebrow}>目標與空間</div>
        <DataError
          status={targetFetchError.status}
          resource="target-prices"
          retryBehavior="manual"
          onRetry={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
        />
      </div>
    )
  }

  if (!target || target.target == null) {
    return (
      <div style={panelCard}>
        <div style={eyebrow}>目標與空間</div>
        <SoftMessage>
          {isEmerging ? '興櫃無券商覆蓋' : '券商目標價還沒收齊，先把 thesis 與估值帶著看。'}
        </SoftMessage>
      </div>
    )
  }

  const upside =
    currentPrice != null && currentPrice > 0
      ? ((target.target - currentPrice) / currentPrice) * 100
      : null
  const upsideTone =
    upside == null
      ? 'muted'
      : upside >= 0
        ? 'positive'
        : Math.abs(upside) >= 10
          ? 'negative'
          : 'warning'
  const sourceLabel =
    target.kind === 'thesis'
      ? '原始 thesis'
      : target.firm || resolveTargetSourceLabel(dossier?.targetSource)

  return (
    <div style={panelCard}>
      <div style={eyebrow}>目標與空間</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          <div style={{ color: C.textMute, fontSize: 9, marginBottom: 4 }}>{target.label}</div>
          <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
            {formatCurrency(target.target)}
          </div>
        </div>
        {upside != null ? <TonePill tone={upsideTone}>{formatPercent(upside)}</TonePill> : null}
      </div>
      <div style={{ color: C.text, fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
        {sourceLabel}
        {target.reportsCount && target.reportsCount > 1 ? ` · ${target.reportsCount} 筆` : ''}
        {target.date ? ` · ${formatDateLabel(target.date)}` : ''}
      </div>
      <div style={{ color: C.textMute, fontSize: 9, lineHeight: 1.6, marginTop: 4 }}>
        {upside == null
          ? '現價還沒跟上來時，先把這個價位當成錨。'
          : upside >= 0
            ? '距離目標還留有空間，節奏可以慢慢看。'
            : '現價已經先跑在前面，這裡多看一眼會比較安心。'}
      </div>
    </div>
  )
}

function FreshnessCard({ dossier, holding }) {
  const targetSourceLabel = resolveTargetSourceLabel(dossier?.targetSource)
  const thesisUpdatedAt = formatDateLabel(dossier?.thesis?.updatedAt || dossier?.thesis?.createdAt)
  const fundamentalsUpdatedAt = formatDateLabel(dossier?.fundamentals?.updatedAt)
  const holdingType = String(holding?.type || dossier?.position?.type || '').trim()

  return (
    <div style={panelCard}>
      <div style={eyebrow}>資料新鮮度</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <StaleBadge
          dossier={dossier}
          field="targets"
          label="目標價"
          title="目標價 freshness"
          style={{ textTransform: 'none' }}
        />
        <StaleBadge
          dossier={dossier}
          field="fundamentals"
          label="財報"
          title="fundamentals freshness"
          style={{ textTransform: 'none' }}
        />
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 8, fontSize: 9, lineHeight: 1.6 }}>
        {targetSourceLabel ? (
          <div style={{ color: C.text }}>目標來源 · {targetSourceLabel}</div>
        ) : null}
        {fundamentalsUpdatedAt ? (
          <div style={{ color: C.textMute }}>財報更新 · {fundamentalsUpdatedAt}</div>
        ) : null}
        {thesisUpdatedAt ? (
          <div style={{ color: C.textMute }}>thesis 更新 · {thesisUpdatedAt}</div>
        ) : null}
        {holdingType ? <div style={{ color: C.textMute }}>部位類型 · {holdingType}</div> : null}
        {!targetSourceLabel && !fundamentalsUpdatedAt && !thesisUpdatedAt && !holdingType ? (
          <SoftMessage style={{ marginTop: 4 }}>
            這檔的 metadata 還在慢慢補，先把已知資訊擺在前面。
          </SoftMessage>
        ) : null}
      </div>
    </div>
  )
}

function CompressedHoldingPane({ holding, dossier, viewMode }) {
  const pillars = Array.isArray(dossier?.thesis?.pillars) ? dossier.thesis.pillars : []
  const intactCount = pillars.filter(
    (pillar) => normalizePillarStatus(pillar?.status) === 'intact'
  ).length
  const weakenedCount = pillars.filter(
    (pillar) => normalizePillarStatus(pillar?.status) === 'weakened'
  ).length
  const brokenCount = pillars.filter(
    (pillar) => normalizePillarStatus(pillar?.status) === 'broken'
  ).length
  const complianceNote = getViewModeComplianceMessage(viewMode)
  const holdingType = String(holding?.type || dossier?.position?.type || '').trim()

  return (
    <div style={{ ...panelCard, minHeight: 0 }}>
      <div style={eyebrow}>持股 aggregate status</div>
      <div style={{ color: C.textSec, fontSize: 10, lineHeight: 1.7, marginBottom: 8 }}>
        {complianceNote || 'insider-compressed 僅顯示組合層級摘要。'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {pillars.length > 0 ? <TonePill tone="muted">pillar {pillars.length} 項</TonePill> : null}
        {intactCount > 0 ? <TonePill tone="positive">維持 {intactCount}</TonePill> : null}
        {weakenedCount > 0 ? <TonePill tone="warning">轉弱 {weakenedCount}</TonePill> : null}
        {brokenCount > 0 ? <TonePill tone="negative">失真 {brokenCount}</TonePill> : null}
        {holdingType ? <TonePill tone="muted">{holdingType}</TonePill> : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <StaleBadge
          dossier={dossier}
          field="targets"
          label="目標價"
          title="目標價 freshness"
          style={{ textTransform: 'none' }}
        />
        <StaleBadge
          dossier={dossier}
          field="fundamentals"
          label="財報"
          title="fundamentals freshness"
          style={{ textTransform: 'none' }}
        />
      </div>
      {!pillars.length && !holdingType ? (
        <SoftMessage style={{ marginTop: 8 }}>
          這檔目前只保留資料新鮮度與 aggregate 追蹤狀態。
        </SoftMessage>
      ) : null}
    </div>
  )
}

export default function HoldingDrillPane({ holding, dossier = null, viewMode = 'retail' }) {
  const showPillarDiff = isViewModeEnabled('showPillarDiff', viewMode)
  const showValuationDetail = isViewModeEnabled('showValuationDetail', viewMode)

  if (!showPillarDiff || !showValuationDetail) {
    return (
      <div
        data-testid={`holding-drill-${holding?.code || 'unknown'}`}
        style={{
          display: 'grid',
          gap: 8,
        }}
      >
        <CompressedHoldingPane holding={holding} dossier={dossier} viewMode={viewMode} />
      </div>
    )
  }

  return (
    <div
      data-testid={`holding-drill-${holding?.code || 'unknown'}`}
      style={{
        display: 'grid',
        gap: 8,
      }}
    >
      <ThesisCard dossier={dossier} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        <ValuationCard holding={holding} dossier={dossier} />
        <TargetCard holding={holding} dossier={dossier} />
        <FreshnessCard holding={holding} dossier={dossier} />
      </div>
    </div>
  )
}
