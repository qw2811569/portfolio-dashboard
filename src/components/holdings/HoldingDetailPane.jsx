import { useEffect, useId, useRef, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import HoldingSparkline from './HoldingSparkline.jsx'

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
  if (number == null) return '—'
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}%`
}

function formatDateLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw.replace(/-/g, '/')
  return parsed.toISOString().slice(0, 10).replace(/-/g, '/')
}

function getFocusableNodes(container) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((node) => {
    if (!(node instanceof HTMLElement)) return false
    if (node.hasAttribute('disabled')) return false
    return node.tabIndex >= 0 && node.offsetParent !== null
  })
}

function getPillarTone(status = 'intact') {
  if (status === 'broken') {
    return {
      label: '主線失真',
      color: C.down,
      background: alpha(C.down, '12'),
      border: alpha(C.down, '30'),
    }
  }
  if (status === 'wobbly') {
    return {
      label: '主線搖晃',
      color: C.amber,
      background: alpha(C.amber, '14'),
      border: alpha(C.amber, '30'),
    }
  }
  return {
    label: '主線仍在',
    color: C.positive,
    background: alpha(C.positive, '14'),
    border: alpha(C.positive, '28'),
  }
}

function getFreshnessTone(status = 'missing') {
  if (status === 'fresh') return { color: C.positive, background: alpha(C.positive, '14') }
  if (status === 'aging') return { color: C.amber, background: alpha(C.amber, '14') }
  if (status === 'stale') return { color: C.down, background: alpha(C.down, '12') }
  return { color: C.textMute, background: alpha(C.textMute, '10') }
}

function formatFreshnessLabel(status = 'missing') {
  if (status === 'fresh') return '新'
  if (status === 'aging') return '稍舊'
  if (status === 'stale') return '偏舊'
  return '待補'
}

function SoftEmpty({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: C.textMute,
        lineHeight: 1.8,
        padding: '12px 14px',
        borderRadius: C.radii.md,
        background: alpha(C.textMute, '08'),
        border: `1px dashed ${alpha(C.textMute, '22')}`,
      }}
    >
      {children}
    </div>
  )
}

function SectionCard({ title, eyebrow = '', children }) {
  return (
    <section
      style={{
        borderRadius: 12,
        border: `1px solid ${alpha(C.text, '10')}`,
        background: alpha(C.raised, 'fc'),
        padding: '14px 14px',
        boxShadow: `${C.insetLine}, ${C.shadow}`,
      }}
    >
      <div style={{ fontSize: 11, color: C.textMute, letterSpacing: '0.08em', fontWeight: 700 }}>
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: eyebrow ? 4 : 0,
          marginBottom: 10,
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
          fontFamily: 'var(--font-headline)',
        }}
      >
        {title}
      </div>
      {children}
    </section>
  )
}

function MetricGrid({ rows = [] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            borderRadius: C.radii.md,
            border: `1px solid ${alpha(C.text, '10')}`,
            background: alpha(C.surface, 'f2'),
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 11, color: C.textMute, marginBottom: 4 }}>{row.label}</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.4,
              fontFamily: 'var(--font-num)',
            }}
          >
            {row.value}
          </div>
          {row.hint ? (
            <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.6, marginTop: 4 }}>
              {row.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function HoldingDetailPane({ open = false, detail = null, onClose = () => {} }) {
  const isMobile = useIsMobile()
  const titleId = useId()
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [dragState, setDragState] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => {
    if (!open || !detail) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableNodes(panelRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [detail, onClose, open])

  useEffect(() => {
    if (!open || !isMobile || !dragState) return undefined

    const handlePointerMove = (event) => {
      const nextOffset = Math.max(0, event.clientY - dragState.startY)
      setDragOffset(nextOffset)
    }

    const handlePointerUp = () => {
      if (dragOffset >= 90) {
        onClose()
      }
      setDragState(null)
      setDragOffset(0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragOffset, dragState, isMobile, onClose, open])

  if (!open || !detail) return null

  const pillarTone = getPillarTone(detail?.pillarStatus)
  const valuation = detail?.valuation || {}
  const freshness = detail?.freshness || {}
  const thesis = detail?.thesis
  const flow = detail?.institutionalFlow
  const position = detail?.position || {}

  return (
    <div
      data-testid="holding-detail-pane-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: alpha(C.text, '54'),
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: isMobile ? 'flex-end' : 'flex-start',
        padding: isMobile ? 0 : 12,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={isMobile ? 'holding-detail-pane-mobile' : 'holding-detail-pane-desktop'}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(468px, calc(100vw - 24px))',
          height: isMobile ? '90vh' : 'calc(100vh - 24px)',
          maxHeight: isMobile ? '90vh' : 'calc(100vh - 24px)',
          borderRadius: isMobile ? `${C.radii.lg} ${C.radii.lg} 0 0` : C.radii.lg,
          border: `1px solid ${alpha(C.text, '12')}`,
          background: alpha(C.raised, 'fd'),
          boxShadow: `0 28px 80px ${alpha(C.text, '24')}`,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
          transform: isMobile ? `translateY(${dragOffset}px)` : 'translateX(0)',
          transition: dragState ? 'none' : 'transform 180ms ease, opacity 180ms ease',
        }}
      >
        <div
          style={{
            padding: isMobile ? '10px 14px 12px' : '16px 18px 14px',
            borderBottom: `1px solid ${alpha(C.text, '10')}`,
            background: alpha(C.raised, 'ff'),
          }}
        >
          {isMobile ? (
            <div
              data-testid="holding-detail-pane-drag-handle"
              onPointerDown={(event) => {
                if (event.button !== 0 && event.pointerType === 'mouse') return
                setDragState({ startY: event.clientY })
                setDragOffset(0)
              }}
              style={{
                width: 64,
                height: 6,
                borderRadius: 8,
                background: alpha(C.textMute, '32'),
                margin: '0 auto 12px',
                touchAction: 'none',
              }}
            />
          ) : null}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMute,
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                HOLDING DOSSIER
              </div>
              <div
                id={titleId}
                style={{
                  fontSize: 22,
                  lineHeight: 1.2,
                  color: C.text,
                  fontWeight: 700,
                  fontFamily: 'var(--font-headline)',
                }}
              >
                {detail.displayName}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: C.textSec,
                    fontFamily: 'var(--font-num)',
                  }}
                >
                  {detail.code}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: pillarTone.color,
                    background: pillarTone.background,
                    border: `1px solid ${pillarTone.border}`,
                  }}
                >
                  {pillarTone.label}
                </span>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              data-testid="holding-detail-pane-close-top"
              aria-label={`關閉 ${detail.displayName} 詳情`}
              onClick={() => onClose()}
              style={{
                minWidth: 44,
                minHeight: 44,
                borderRadius: 8,
                border: `1px solid ${alpha(C.text, '12')}`,
                background: alpha(C.card, 'f2'),
                color: C.textSec,
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginTop: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: C.textMute, marginBottom: 4 }}>持股</div>
              <div
                style={{
                  fontSize: 13,
                  color: C.text,
                  fontWeight: 700,
                  fontFamily: 'var(--font-num)',
                }}
              >
                {(Number(position?.qty) || 0).toLocaleString()} 股
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMute, marginBottom: 4 }}>現價</div>
              <div
                style={{
                  fontSize: 13,
                  color: C.text,
                  fontWeight: 700,
                  fontFamily: 'var(--font-num)',
                }}
              >
                {formatCurrency(valuation.currentPrice)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMute, marginBottom: 4 }}>目標</div>
              <div
                style={{
                  fontSize: 13,
                  color: C.text,
                  fontWeight: 700,
                  fontFamily: 'var(--font-num)',
                }}
              >
                {formatCurrency(valuation.targetPrice)}
              </div>
            </div>
          </div>
        </div>

        <div
          tabIndex={0}
          aria-label={`${detail.displayName} 詳情內容`}
          data-testid="holding-detail-pane-content"
          style={{
            overflowY: 'auto',
            padding: isMobile ? '14px 14px 18px' : '18px 18px 22px',
            display: 'grid',
            gap: 14,
          }}
        >
          <SectionCard title="主線與 thesis" eyebrow="THESIS">
            {thesis ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {thesis.text ? (
                  <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.8 }}>
                    {thesis.text}
                  </div>
                ) : null}
                {thesis.pillars?.length ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {thesis.pillars.map((pillar) => {
                      const tone = getPillarTone(pillar.status)
                      return (
                        <div
                          key={pillar.id}
                          style={{
                            borderRadius: C.radii.md,
                            border: `1px solid ${tone.border}`,
                            background: alpha(C.card, 'f3'),
                            padding: '10px 12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
                              {pillar.label}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: tone.color,
                                background: tone.background,
                                borderRadius: 8,
                                padding: '3px 8px',
                              }}
                            >
                              {tone.label}
                            </span>
                          </div>
                          {pillar.lastChecked ? (
                            <div style={{ fontSize: 11, color: C.textMute, marginTop: 6 }}>
                              最後確認 {formatDateLabel(pillar.lastChecked)}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                {thesis.updatedAt ? (
                  <div style={{ fontSize: 11, color: C.textMute }}>
                    最近整理於 {formatDateLabel(thesis.updatedAt)}
                  </div>
                ) : null}
              </div>
            ) : (
              <SoftEmpty>
                這檔 thesis 還沒整理成長文，先用快看 pane 也可以，之後再慢慢補齊。
              </SoftEmpty>
            )}
          </SectionCard>

          <SectionCard title="估值與資料新鮮度" eyebrow="VALUATION">
            <div style={{ display: 'grid', gap: 12 }}>
              <MetricGrid
                rows={[
                  {
                    label: 'PER',
                    value: valuation.pe == null ? '—' : valuation.pe.toFixed(1),
                  },
                  {
                    label: 'PBR',
                    value: valuation.pbr == null ? '—' : valuation.pbr.toFixed(2),
                  },
                  {
                    label: '殖利率',
                    value:
                      valuation.dividendYield == null
                        ? '—'
                        : formatPercent(valuation.dividendYield * 100, 1),
                  },
                  {
                    label: '估值帶',
                    value:
                      valuation.peBand?.lower != null || valuation.peBand?.upper != null
                        ? `${formatCurrency(valuation.peBand?.lower)} - ${formatCurrency(valuation.peBand?.upper)}`
                        : '—',
                    hint:
                      valuation.targetDate && valuation.targetSource
                        ? `${formatDateLabel(valuation.targetDate)} · ${valuation.targetSource}`
                        : '',
                  },
                ]}
              />
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['targets', '目標價'],
                  ['fundamentals', '基本面'],
                  ['research', '研究'],
                  ['daily', '近況'],
                ].map(([key, label]) => {
                  const tone = getFreshnessTone(freshness?.statuses?.[key])
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderRadius: 12,
                        padding: '8px 10px',
                        border: `1px solid ${alpha(C.text, '10')}`,
                        background: alpha(C.card, 'f1'),
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: C.text }}>{label}</div>
                        <div style={{ fontSize: 11, color: C.textMute }}>
                          {freshness?.[key] ? formatDateLabel(freshness[key]) : '還沒接到這一塊'}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: tone.color,
                          background: tone.background,
                          borderRadius: 8,
                          padding: '4px 8px',
                        }}
                      >
                        {formatFreshnessLabel(freshness?.statuses?.[key])}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="近三日提要" eyebrow="DAILY">
            {detail.recentDailyMentions?.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {detail.recentDailyMentions.map((item) => (
                  <div
                    key={`${item.date}-${item.reportStage}`}
                    style={{
                      borderRadius: C.radii.md,
                      border: `1px solid ${alpha(C.text, '10')}`,
                      background: alpha(C.card, 'f3'),
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: C.textMute }}>
                        {formatDateLabel(item.date)} · {item.reportStage}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8 }}>
                      {item.mention}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SoftEmpty>最近三天還沒有明確提到這檔，暫時先保留安靜，不硬拼摘要。</SoftEmpty>
            )}
          </SectionCard>

          <SectionCard title="最新研究切片" eyebrow="RESEARCH">
            {detail.latestResearchSlice ? (
              <div
                style={{
                  borderRadius: C.radii.md,
                  border: `1px solid ${alpha(C.text, '10')}`,
                  background: alpha(C.card, 'f3'),
                  padding: '12px 12px',
                }}
              >
                <div style={{ fontSize: 11, color: C.textMute, marginBottom: 6 }}>
                  {formatDateLabel(detail.latestResearchSlice.date)}
                </div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginBottom: 8 }}>
                  {detail.latestResearchSlice.headline}
                </div>
                <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8 }}>
                  {detail.latestResearchSlice.summary}
                </div>
              </div>
            ) : (
              <SoftEmpty>
                這檔最近沒有新的研究切片，先留白，等下一次研究或策略腦更新再接上。
              </SoftEmpty>
            )}
          </SectionCard>

          <SectionCard title="相關事件" eyebrow="EVENTS">
            {detail.relatedEvents?.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {detail.relatedEvents.map((event) => (
                  <div
                    key={`${event.type}-${event.date}-${event.label}`}
                    style={{
                      borderRadius: C.radii.md,
                      border: `1px solid ${alpha(C.text, '10')}`,
                      background: alpha(C.card, 'f3'),
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>
                        {event.label}
                      </span>
                      <span style={{ fontSize: 11, color: C.textMute }}>
                        {formatDateLabel(event.date)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMute, marginTop: 6 }}>
                      {event.type}
                      {event.status ? ` · ${event.status}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SoftEmpty>
                目前沒有特別黏在這檔上的事件。這不是壞事，只是今天不用多背一塊背景。
              </SoftEmpty>
            )}
          </SectionCard>

          <SectionCard title="法人 5 日流向" eyebrow="X3">
            {flow ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    borderRadius: C.radii.md,
                    border: `1px solid ${alpha(C.text, '10')}`,
                    background: alpha(C.card, 'f3'),
                    padding: '12px 12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: C.textMute, marginBottom: 4 }}>
                      近 5 日合計
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        color: flow.total5d >= 0 ? C.positive : C.down,
                        fontWeight: 700,
                        fontFamily: 'var(--font-num)',
                      }}
                    >
                      {flow.total5d >= 0 ? '+' : ''}
                      {Math.round(flow.total5d).toLocaleString('zh-TW')}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMute, marginTop: 4 }}>
                      最新 {formatDateLabel(flow.lastUpdated)}
                    </div>
                  </div>
                  <HoldingSparkline
                    history={flow.series}
                    color={flow.total5d >= 0 ? C.positive : C.down}
                  />
                </div>
              </div>
            ) : (
              <SoftEmpty>法人流向這塊今天還沒接上，不先硬畫一條漂亮但沒根據的線。</SoftEmpty>
            )}
          </SectionCard>
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: isMobile
              ? '12px 14px calc(env(safe-area-inset-bottom) + 14px)'
              : '12px 18px 16px',
            borderTop: `1px solid ${alpha(C.text, '10')}`,
            background: alpha(C.raised, 'fe'),
          }}
        >
          <button
            type="button"
            data-testid="holding-detail-pane-close-bottom"
            onClick={() => onClose()}
            style={{
              width: '100%',
              minHeight: 46,
              borderRadius: 8,
              border: `1px solid ${alpha(C.text, '14')}`,
              background: alpha(C.surface, 'f4'),
              color: C.textSec,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ✕ 關閉詳情
          </button>
        </div>
      </div>
    </div>
  )
}
