import { useEffect, useMemo, useState } from 'react'
import { daysBetween, parseFlexibleDate } from '../../lib/dateUtils.js'
import { formatStaleBadgeRelativeLabel } from '../../lib/staleBadge.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { C, alpha } from '../../theme.js'
import { Badge, Button, Card, Skeleton, SoftMessage, StaleBadge } from '../common'

const LOG_AUDIT_LIMIT = 80
const LOG_STALE_THRESHOLD_DAYS = 7

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const EYE_BROW_STYLE = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
}

const FILTER_INPUT_STYLE = {
  width: '100%',
  minHeight: 36,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.raised,
  color: C.text,
  fontSize: 12,
  padding: '8px 10px',
  boxSizing: 'border-box',
}

function buildTradeAuditUrl(portfolioId = '', limit = LOG_AUDIT_LIMIT) {
  if (typeof window === 'undefined') return ''
  const url = new URL('/api/trade-audit', window.location.origin)
  if (portfolioId) url.searchParams.set('portfolioId', portfolioId)
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

function normalizeTradeAction(value) {
  return String(value || '').trim() === '賣出' ? '賣出' : '買進'
}

function normalizeTradeQuestionList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

function normalizeTradeSignaturePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function buildTradeSignature(trade = {}) {
  return [
    normalizeTradeSignaturePart(trade.action),
    normalizeTradeSignaturePart(trade.code),
    normalizeTradeSignaturePart(trade.name),
    String(Number(trade.qty) || 0),
    String(Number(trade.price) || 0),
    normalizeTradeSignaturePart(trade.date),
    normalizeTradeSignaturePart(trade.time),
  ].join('|')
}

function buildTradeLogBuckets(tradeLog = []) {
  return (Array.isArray(tradeLog) ? tradeLog : []).reduce((buckets, item) => {
    const signature = buildTradeSignature(item)
    const current = buckets.get(signature) || []
    current.push(item)
    buckets.set(signature, current)
    return buckets
  }, new Map())
}

function takeMatchedTradeLogEntry(buckets, trade = {}) {
  const signature = buildTradeSignature(trade)
  const matches = buckets.get(signature)
  if (!matches?.length) return null
  const match = matches.shift()
  if (matches.length === 0) buckets.delete(signature)
  return match
}

function parseLocalizedTime(value = '') {
  const match = String(value || '')
    .trim()
    .match(/^(上午|下午)?\s*(\d{1,2}):(\d{2})$/u)

  if (!match) return null

  const meridiem = match[1] || ''
  let hours = Number(match[2])
  const minutes = Number(match[3])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  if (meridiem === '下午' && hours < 12) hours += 12
  if (meridiem === '上午' && hours === 12) hours = 0

  return { hours, minutes }
}

function getTradeTimestamp({ trade = {}, audit = null } = {}) {
  const auditTimestamp = parseFlexibleDate(audit?.ts)
  if (auditTimestamp) return auditTimestamp

  const tradeDate = parseFlexibleDate(trade?.date)
  if (!tradeDate) return null

  const time = parseLocalizedTime(trade?.time)
  if (!time) return tradeDate

  const timestamp = new Date(tradeDate.getTime())
  timestamp.setUTCHours(time.hours, time.minutes, 0, 0)
  return timestamp
}

function formatTimestamp(value) {
  const parsed = value instanceof Date ? value : parseFlexibleDate(value)
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return ''
  return TIMESTAMP_FORMATTER.format(parsed)
}

function formatTradeLine(item) {
  const qty = Number(item?.qty) || 0
  const price = Number(item?.price) || 0
  return `${qty.toLocaleString()} 股 @ ${price.toLocaleString()}`
}

function formatReasonPreview(item) {
  const qa = normalizeTradeQuestionList(item?.qa)
  const answered = qa.find((row) => String(row?.a || '').trim())
  if (answered) return String(answered.a).trim()
  if (qa[0]?.q) return `${qa[0].q}（未填）`
  return '這筆尚未補備忘，先保留成交脈絡與 稽核線索。'
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function getTradeMonth(item = {}) {
  const timestamp = item?.timestamp instanceof Date ? item.timestamp : parseFlexibleDate(item?.date)
  if (timestamp instanceof Date && !Number.isNaN(timestamp.getTime())) {
    const year = timestamp.getFullYear()
    const month = String(timestamp.getMonth() + 1).padStart(2, '0')
    return `${year}/${month}`
  }

  const rawDate = String(item?.date || '').replace(/-/g, '/')
  const match = rawDate.match(/^(\d{4})\/(\d{1,2})/)
  return match ? `${match[1]}/${String(match[2]).padStart(2, '0')}` : ''
}

function getTradeSearchText(item = {}) {
  const memoText = normalizeTradeQuestionList(item.qa)
    .flatMap((qa) => [qa?.q, qa?.a])
    .filter(Boolean)
    .join(' ')

  return normalizeSearchText(
    [
      item.code,
      item.name,
      item.reasonPreview,
      memoText,
      item.tradeLine,
      item.sourceLabel,
      item.timestampLabel,
    ].join(' ')
  )
}

function buildTradeFilterOptions(items = []) {
  const months = new Set()
  const stocks = new Map()

  items.forEach((item) => {
    const month = getTradeMonth(item)
    if (month) months.add(month)

    const code = String(item?.code || '').trim()
    if (code && !stocks.has(code)) {
      stocks.set(code, `${code} ${item?.name || ''}`.trim())
    }
  })

  return {
    months: Array.from(months).sort((a, b) => b.localeCompare(a)),
    stocks: Array.from(stocks.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value)),
  }
}

function filterJournalItems(items = [], filters = {}) {
  const query = normalizeSearchText(filters.query)
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (filters.action !== '全部' && item.action !== filters.action) return false
    if (filters.month !== '全部' && getTradeMonth(item) !== filters.month) return false
    if (filters.stock !== '全部' && item.code !== filters.stock) return false
    if (query && !getTradeSearchText(item).includes(query)) return false
    return true
  })
}

function getHoldingsCountDelta(auditEntry = null) {
  const beforeCount = Array.isArray(auditEntry?.before?.holdings)
    ? auditEntry.before.holdings.length
    : 0
  const afterCount = Array.isArray(auditEntry?.after?.holdings)
    ? auditEntry.after.holdings.length
    : 0
  if (beforeCount === 0 && afterCount === 0) return ''
  const delta = afterCount - beforeCount
  if (delta === 0) return `${afterCount} 檔持倉`
  return `${beforeCount} -> ${afterCount} 檔`
}

function createJournalItem({ trade = {}, audit = null, source = 'trade-log', index = 0 }) {
  const safeTrade = trade && typeof trade === 'object' ? trade : {}
  const timestamp = getTradeTimestamp({ trade: safeTrade, audit })
  const updatedAt = audit?.ts || timestamp?.toISOString() || ''

  return {
    id:
      String(safeTrade.id || '').trim() ||
      `${source}-${audit?.ts || safeTrade.date || 'log'}-${safeTrade.code || 'item'}-${index}`,
    action: normalizeTradeAction(safeTrade.action),
    code: String(safeTrade.code || '').trim(),
    name: String(safeTrade.name || '').trim() || '未命名標的',
    qty: Number(safeTrade.qty) || 0,
    price: Number(safeTrade.price) || 0,
    date: String(safeTrade.date || '').trim(),
    time: String(safeTrade.time || '').trim(),
    qa: normalizeTradeQuestionList(safeTrade.qa),
    source,
    sourceLabel: source === 'trade-audit' ? '交易稽核' : '本機日誌',
    sourceTone: source === 'trade-audit' ? 'positive' : 'iron',
    audit,
    reasonPreview: formatReasonPreview(safeTrade),
    tradeLine: formatTradeLine(safeTrade),
    timestamp,
    updatedAt,
    timestampLabel:
      formatTimestamp(timestamp) || `${safeTrade.date || ''} ${safeTrade.time || ''}`.trim(),
    holdingsDelta: getHoldingsCountDelta(audit),
  }
}

function mergeJournalItems({ tradeLog = [], auditEntries = [] }) {
  const tradeLogBuckets = buildTradeLogBuckets(tradeLog)
  const items = []

  ;(Array.isArray(auditEntries) ? auditEntries : []).forEach((auditEntry, auditIndex) => {
    const appendedEntries = Array.isArray(auditEntry?.after?.appendedTradeLogEntries)
      ? auditEntry.after.appendedTradeLogEntries
      : []

    if (appendedEntries.length === 0) {
      items.push(
        createJournalItem({
          trade: {
            action: '買進',
            code: '',
            name: auditEntry?.action || 'trade.confirm',
            qty: 0,
            price: 0,
            date: '',
            time: '',
            qa: [],
          },
          audit: auditEntry,
          source: 'trade-audit',
          index: auditIndex,
        })
      )
      return
    }

    appendedEntries.forEach((entry, tradeIndex) => {
      const matchedTradeLogEntry = takeMatchedTradeLogEntry(tradeLogBuckets, entry)
      items.push(
        createJournalItem({
          trade: {
            ...matchedTradeLogEntry,
            ...entry,
            qa: normalizeTradeQuestionList(entry?.qa).length
              ? entry.qa
              : normalizeTradeQuestionList(matchedTradeLogEntry?.qa),
          },
          audit: auditEntry,
          source: 'trade-audit',
          index: auditIndex + tradeIndex,
        })
      )
    })
  })

  for (const bucket of tradeLogBuckets.values()) {
    bucket.forEach((entry, index) => {
      items.push(
        createJournalItem({
          trade: entry,
          source: 'trade-log',
          index,
        })
      )
    })
  }

  return items.sort((left, right) => {
    const rightTimestamp = right?.timestamp?.getTime() || Number(right?.id) || 0
    const leftTimestamp = left?.timestamp?.getTime() || Number(left?.id) || 0
    return rightTimestamp - leftTimestamp
  })
}

function resolveFreshnessState(entries = []) {
  const latestEntry = (Array.isArray(entries) ? entries : []).find((item) => item?.updatedAt)
  const latestDate = parseFlexibleDate(latestEntry?.updatedAt)

  if (!latestDate) {
    return {
      status: 'missing',
      label: '尚無寫入',
      updatedAt: '',
      exactLabel: '尚無交易紀錄',
    }
  }

  const ageDays = daysBetween(new Date(), latestDate)
  const status = ageDays != null && ageDays > LOG_STALE_THRESHOLD_DAYS ? 'stale' : 'fresh'
  return {
    status,
    label: `最後寫入 · ${formatStaleBadgeRelativeLabel(latestDate) || formatTimestamp(latestDate)}`,
    updatedAt: latestDate.toISOString(),
    exactLabel: formatTimestamp(latestDate),
  }
}

function SummaryStat({ label, value }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${alpha(C.borderStrong, 'b8')}`,
        background: alpha(C.subtle, 'ea'),
        boxShadow: C.insetLine,
      }}
    >
      <div style={{ ...EYE_BROW_STYLE, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.textSec, lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  )
}

function DetailMetric({ label, value }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${alpha(C.borderStrong, 'b8')}`,
        background: alpha(C.subtle, 'ea'),
        boxShadow: C.insetLine,
      }}
    >
      <div style={{ ...EYE_BROW_STYLE, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

function LogPanelSkeleton({ isMobile = false }) {
  return (
    <div
      data-testid="trade-log-panel"
      data-layout={isMobile ? 'mobile-single-column' : 'desktop-split'}
    >
      <Card
        variant="subtle"
        style={{ marginBottom: 12, padding: isMobile ? '18px 16px' : '22px 20px' }}
      >
        <div style={{ ...EYE_BROW_STYLE, marginBottom: 10 }}>交易日誌整理中</div>
        <Skeleton variant="text" count={2} />
        <div style={{ height: 14 }} />
        <Skeleton variant="card" count={2} />
      </Card>
      <Card variant="subtle" style={{ padding: isMobile ? '16px 14px' : '18px 16px' }}>
        <div style={{ ...EYE_BROW_STYLE, marginBottom: 10 }}>交易稽核讀取中</div>
        <Skeleton variant="row" count={3} />
      </Card>
    </div>
  )
}

function EmptyLogState() {
  return (
    <Card
      data-testid="trade-log-empty"
      style={{
        textAlign: 'center',
        padding: '28px 20px',
        background: alpha(C.raised, 'f6'),
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          margin: '0 auto 14px',
          borderRadius: '50%',
          border: `1px solid ${alpha(C.borderStrong, 'a8')}`,
          background: alpha(C.subtle, 'f2'),
          display: 'grid',
          placeItems: 'center',
          fontSize: 24,
          color: C.textMute,
        }}
      >
        ◌
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        還沒有交易紀錄
      </div>
      <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7 }}>
        上傳成交後，這裡會保留每筆備忘、稽核紀錄與時間線，方便回頭復盤。
      </div>
    </Card>
  )
}

function JournalListItem({ item, isActive, isMobile, onSelect }) {
  return (
    <button
      type="button"
      data-testid="trade-log-entry-button"
      data-source={item.source}
      aria-pressed={isActive}
      onClick={() => onSelect(item.id)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 12,
        border: `1px solid ${isActive ? alpha(C.positive, '40') : alpha(C.borderStrong, 'b8')}`,
        background: isActive ? alpha(C.positive, '12') : alpha(C.raised, 'f4'),
        boxShadow: isActive
          ? `${C.insetLine}, ${C.shadow}, 0 0 0 1px ${alpha(C.positive, '14')}`
          : `${C.insetLine}, ${C.shadow}`,
        padding: isMobile ? '12px 12px' : '14px 14px',
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge color={item.action === '賣出' ? 'alert' : 'up'} size="xs">
            {item.action}
          </Badge>
          <Badge color={item.sourceTone} size="xs">
            {item.sourceLabel}
          </Badge>
          <span style={{ fontSize: 12, color: C.textMute }}>{item.code || '未帶代碼'}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMute }}>{item.timestampLabel}</div>
      </div>

      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: C.text,
            marginBottom: 4,
            lineHeight: 1.4,
          }}
        >
          {item.name}
        </div>
        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>{item.tradeLine}</div>
        <div
          style={{
            fontSize: 12,
            color: C.textMute,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: isMobile ? 3 : 2,
            overflow: 'hidden',
          }}
        >
          {item.reasonPreview}
        </div>
      </div>
    </button>
  )
}

function JournalDetail({ item, isMobile }) {
  const auditEntry = item?.audit
  const targetUpdateCount = Array.isArray(auditEntry?.after?.targetPriceUpdates)
    ? auditEntry.after.targetPriceUpdates.length
    : 0

  return (
    <Card
      data-testid="trade-log-detail"
      style={{
        padding: isMobile ? '16px 14px' : '18px 18px',
        position: isMobile ? 'static' : 'sticky',
        top: isMobile ? 'auto' : 112,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ ...EYE_BROW_STYLE, marginBottom: 8 }}>交易明細</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
            {item.name}
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 6 }}>
            {item.code || '未帶代碼'} · {item.tradeLine}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge color={item.action === '賣出' ? 'alert' : 'up'} size="xs">
            {item.action}
          </Badge>
          <Badge color={item.sourceTone} size="xs">
            {item.sourceLabel}
          </Badge>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <DetailMetric label="成交時間" value={item.timestampLabel || '未提供'} />
        <DetailMetric label="持倉變化" value={item.holdingsDelta || '沿用既有持倉快照'} />
        <DetailMetric label="紀錄來源" value={item.sourceLabel} />
        <DetailMetric label="更新節點" value={formatTimestamp(item.updatedAt) || '未提供'} />
      </div>

      {item.qa.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, marginBottom: auditEntry ? 14 : 0 }}>
          <div style={{ ...EYE_BROW_STYLE }}>交易備忘</div>
          {item.qa.map((qaItem, index) => (
            <div
              key={`${item.id}-qa-${index}`}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${alpha(C.borderStrong, 'b8')}`,
                background: alpha(C.subtle, 'f0'),
                boxShadow: C.insetLine,
              }}
            >
              <div style={{ fontSize: 12, color: C.textMute, marginBottom: 6, lineHeight: 1.6 }}>
                {qaItem.q}
              </div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7 }}>
                {qaItem.a || '（未填）'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SoftMessage style={{ marginBottom: auditEntry ? 14 : 0 }}>
          這筆還沒有補備忘，先保留成交與 稽核線索，之後可回來補理由與出場計畫。
        </SoftMessage>
      )}

      {auditEntry && (
        <div data-testid="trade-log-audit-detail">
          <div style={{ ...EYE_BROW_STYLE, marginBottom: 8 }}>交易稽核</div>
          <SoftMessage tone="positive" style={{ marginBottom: 10 }}>
            本筆來自交易確認稽核，前後快照與免責聲明確認時間都已保留。
          </SoftMessage>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <DetailMetric label="稽核時間" value={formatTimestamp(auditEntry.ts) || '未提供'} />
            <DetailMetric
              label="免責聲明確認"
              value={formatTimestamp(auditEntry.disclaimerAckedAt) || '尚未記錄'}
            />
            <DetailMetric
              label="tradeLog 計數"
              value={`${auditEntry?.before?.tradeLogCount ?? '-'} -> ${auditEntry?.after?.tradeLogCount ?? '-'}`}
            />
            <DetailMetric
              label="目標價更新"
              value={targetUpdateCount > 0 ? `${targetUpdateCount} 筆` : '無'}
            />
            <DetailMetric label="來源檔" value={auditEntry.sourceFile || 'trade-audit'} />
            <DetailMetric label="動作" value={String(auditEntry.action || 'trade.confirm')} />
          </div>
        </div>
      )}
    </Card>
  )
}

export function LogPanel({ tradeLog = null, portfolioId = '' }) {
  const isMobile = useIsMobile()
  const [auditPayload, setAuditPayload] = useState({
    entries: [],
    error: null,
    loadedKey: '',
  })
  const [selectedItemId, setSelectedItemId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('全部')
  const [monthFilter, setMonthFilter] = useState('全部')
  const [stockFilter, setStockFilter] = useState('全部')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const normalizedPortfolioId = String(portfolioId || '').trim()
  const auditRequestKey = normalizedPortfolioId ? `${normalizedPortfolioId}:${refreshNonce}` : ''

  useEffect(() => {
    if (!auditRequestKey) return undefined

    const url = buildTradeAuditUrl(normalizedPortfolioId)
    if (!url || typeof fetch !== 'function') return undefined

    let cancelled = false

    fetch(url)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || `trade audit fetch failed (${response.status})`)
        }
        return payload
      })
      .then((payload) => {
        if (cancelled) return
        setAuditPayload({
          entries: Array.isArray(payload?.entries) ? payload.entries : [],
          error: null,
          loadedKey: auditRequestKey,
        })
      })
      .catch((error) => {
        if (cancelled) return
        setAuditPayload({
          entries: [],
          error,
          loadedKey: auditRequestKey,
        })
      })

    return () => {
      cancelled = true
    }
  }, [auditRequestKey, normalizedPortfolioId])

  const auditState = useMemo(() => {
    if (!auditRequestKey) {
      return {
        entries: [],
        status: 'idle',
        error: null,
      }
    }

    if (auditPayload.loadedKey !== auditRequestKey) {
      return {
        entries: [],
        status: 'loading',
        error: null,
      }
    }

    if (auditPayload.error) {
      return {
        entries: [],
        status: 'error',
        error: auditPayload.error,
      }
    }

    return {
      entries: Array.isArray(auditPayload.entries) ? auditPayload.entries : [],
      status: 'ready',
      error: null,
    }
  }, [auditPayload.entries, auditPayload.error, auditPayload.loadedKey, auditRequestKey])

  const resolvedAuditEntries = useMemo(() => auditState.entries, [auditState.entries])
  const resolvedAuditStatus = auditState.status
  const resolvedAuditError = auditState.error
  const journalItems = useMemo(
    () =>
      mergeJournalItems({
        tradeLog: Array.isArray(tradeLog) ? tradeLog : [],
        auditEntries: resolvedAuditEntries,
      }),
    [tradeLog, resolvedAuditEntries]
  )
  const filterOptions = useMemo(() => buildTradeFilterOptions(journalItems), [journalItems])
  const filteredJournalItems = useMemo(
    () =>
      filterJournalItems(journalItems, {
        query: searchQuery,
        action: actionFilter,
        month: monthFilter,
        stock: stockFilter,
      }),
    [actionFilter, journalItems, monthFilter, searchQuery, stockFilter]
  )
  const freshness = useMemo(() => resolveFreshnessState(journalItems), [journalItems])
  const selectedItem = useMemo(
    () =>
      filteredJournalItems.find((item) => item.id === selectedItemId) ||
      filteredJournalItems[0] ||
      null,
    [filteredJournalItems, selectedItemId]
  )

  const auditCount = resolvedAuditEntries.length
  const localOnlyCount = journalItems.filter((item) => item.source === 'trade-log').length
  const shouldShowSkeleton =
    resolvedAuditStatus === 'loading' && journalItems.length === 0 && normalizedPortfolioId

  if (shouldShowSkeleton) {
    return <LogPanelSkeleton isMobile={isMobile} />
  }

  return (
    <div
      data-testid="trade-log-panel"
      data-layout={isMobile ? 'mobile-single-column' : 'desktop-split'}
    >
      <Card
        style={{
          marginBottom: 12,
          padding: isMobile ? '18px 16px' : '22px 20px',
          background: alpha(C.raised, 'f6'),
        }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ maxWidth: isMobile ? '100%' : 560 }}>
              <div style={{ ...EYE_BROW_STYLE, marginBottom: 8 }}>交易日誌</div>
              <div
                style={{
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 700,
                  color: C.text,
                  lineHeight: 1.22,
                  letterSpacing: '-0.02em',
                  marginBottom: 8,
                }}
              >
                歷史成交、備忘與稽核紀錄在這裡對上線。
              </div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7 }}>
                先看清單，點進去再核對備忘、成交筆數與免責聲明確認時間，回頭查帳不必翻多個頁面。
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: isMobile ? 'flex-start' : 'flex-end',
              }}
            >
              <StaleBadge
                status={freshness.status}
                label={freshness.label}
                title="交易日誌新鮮度"
              />
              <Badge color="iron" size="xs">
                {filteredJournalItems.length === journalItems.length
                  ? `${journalItems.length} 筆紀錄`
                  : `${filteredJournalItems.length}/${journalItems.length} 筆`}
              </Badge>
              {auditCount > 0 && (
                <Badge color="positive" size="xs">
                  {auditCount} 筆交易稽核
                </Badge>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <SummaryStat label="最後寫入" value={freshness.exactLabel} />
            <SummaryStat
              label="稽核紀錄"
              value={auditCount > 0 ? `${auditCount} 筆已接入` : '尚未抓到'}
            />
            <SummaryStat
              label="本機備援"
              value={localOnlyCount > 0 ? `${localOnlyCount} 筆` : '無'}
            />
          </div>

          <div
            data-testid="trade-log-filters"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1.3fr) repeat(3, 1fr)',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.textMute }}>
              搜尋
              <input
                data-testid="trade-log-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="代碼、名稱或備忘"
                style={FILTER_INPUT_STYLE}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.textMute }}>
              動作
              <select
                data-testid="trade-log-action-filter"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                style={FILTER_INPUT_STYLE}
              >
                <option value="全部">全部</option>
                <option value="買進">買進</option>
                <option value="賣出">賣出</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.textMute }}>
              月份
              <select
                data-testid="trade-log-month-filter"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                style={FILTER_INPUT_STYLE}
              >
                <option value="全部">全部</option>
                {filterOptions.months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.textMute }}>
              標的
              <select
                data-testid="trade-log-stock-filter"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                style={FILTER_INPUT_STYLE}
              >
                <option value="全部">全部</option>
                {filterOptions.stocks.map((stock) => (
                  <option key={stock.value} value={stock.value}>
                    {stock.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      {resolvedAuditStatus === 'loading' && journalItems.length > 0 && (
        <SoftMessage style={{ marginBottom: 12 }}>
          交易稽核還在整理中，先顯示本機交易日誌；整理完會自動補上細節。
        </SoftMessage>
      )}

      {resolvedAuditStatus === 'error' && (
        <Card style={{ marginBottom: 12, padding: '12px 12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <SoftMessage tone="warning" style={{ flex: '1 1 320px', marginBottom: 0 }}>
              交易稽核暫時讀不到，先用本機日誌撐住畫面。
              {resolvedAuditError?.message ? ` ${resolvedAuditError.message}` : ''}
            </SoftMessage>
            <Button
              size="sm"
              color="amber"
              style={{ textTransform: 'none' }}
              onClick={() => setRefreshNonce((value) => value + 1)}
            >
              再試一次
            </Button>
          </div>
        </Card>
      )}

      {journalItems.length === 0 ? (
        <EmptyLogState />
      ) : (
        <div
          data-testid="trade-log-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(0, 1.35fr) minmax(300px, 0.95fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <Card style={{ padding: isMobile ? '14px 12px' : '16px 16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ ...EYE_BROW_STYLE, marginBottom: 6 }}>日誌列表</div>
                <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
                  {filteredJournalItems.length === journalItems.length
                    ? '先挑一筆，再到右側細節 看 備忘與稽核 細節。'
                    : `目前符合條件 ${filteredJournalItems.length} 筆。`}
                </div>
              </div>
              <Badge color={isMobile ? 'warning' : 'iron'} size="xs">
                {isMobile ? 'Mobile single column' : 'Desktop split view'}
              </Badge>
            </div>

            {filteredJournalItems.length === 0 ? (
              <SoftMessage data-testid="trade-log-filter-empty">
                沒有符合條件的交易紀錄。
              </SoftMessage>
            ) : (
              <div data-testid="trade-log-list" style={{ display: 'grid', gap: 10 }}>
                {filteredJournalItems.map((item) => (
                  <JournalListItem
                    key={item.id}
                    item={item}
                    isActive={selectedItem?.id === item.id}
                    isMobile={isMobile}
                    onSelect={setSelectedItemId}
                  />
                ))}
              </div>
            )}
          </Card>

          {selectedItem && <JournalDetail item={selectedItem} isMobile={isMobile} />}
        </div>
      )}
    </div>
  )
}
