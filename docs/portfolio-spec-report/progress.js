export const STATUS_META = {
  shipBefore: { label: 'Ship-Before', color: 'var(--cta)' },
  beta1: { label: 'Beta+1', color: 'var(--warning)' },
  backlog: { label: 'Backlog', color: 'var(--iron)' },
  qa: { label: 'QA Supplement', color: 'var(--positive)' },
  ops: { label: 'Ops Discipline', color: 'var(--hot)' },
}

const PRODUCT_TRACKS = ['shipBefore', 'beta1', 'backlog']
const TRACKED_TRACKS = ['shipBefore', 'beta1', 'backlog', 'qa', 'ops']

const clampPct = (value) => Math.max(0, Math.min(100, value))

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const calcPct = (done, total) => (total > 0 ? clampPct((done / total) * 100) : 0)

const calcEtaDays = (remainingHours, velocityHoursPerDay) => {
  if (remainingHours <= 0) return 0
  if (velocityHoursPerDay <= 0) return null
  return Math.ceil(remainingHours / velocityHoursPerDay)
}

const createStatusSummary = (track) => ({
  track,
  label: STATUS_META[track]?.label ?? track,
  total: 0,
  done: 0,
  totalEstHours: 0,
  doneEstHours: 0,
})

const normalizeItem = (item, index) => ({
  id: String(item?.id ?? '').trim(),
  title: String(item?.title ?? '').trim(),
  track: String(item?.track ?? '').trim(),
  estH: toNumber(item?.estH),
  done: Boolean(item?.done),
  completedAt: item?.completedAt ?? null,
  sortOrder: toNumber(item?.sortOrder, index + 1),
})

export function buildProgressSnapshot(source = {}) {
  const velocityHoursPerDay = toNumber(source.velocityHoursPerDay, 8)
  const items = Array.isArray(source.items)
    ? source.items
        .map(normalizeItem)
        .filter((item) => item.id && item.title && TRACKED_TRACKS.includes(item.track))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    : []

  const byStatus = Object.fromEntries(
    TRACKED_TRACKS.map((track) => [track, createStatusSummary(track)])
  )

  for (const item of items) {
    const summary = byStatus[item.track]
    summary.total += 1
    summary.totalEstHours += item.estH
    if (item.done) {
      summary.done += 1
      summary.doneEstHours += item.estH
    }
  }

  const productEstHours = PRODUCT_TRACKS.reduce(
    (sum, track) => sum + byStatus[track].totalEstHours,
    0
  )
  const productDoneEstHours = PRODUCT_TRACKS.reduce(
    (sum, track) => sum + byStatus[track].doneEstHours,
    0
  )
  const trackedEstHours = TRACKED_TRACKS.reduce(
    (sum, track) => sum + byStatus[track].totalEstHours,
    0
  )
  const trackedDoneEstHours = TRACKED_TRACKS.reduce(
    (sum, track) => sum + byStatus[track].doneEstHours,
    0
  )
  const shipBeforeRemainingHours =
    byStatus.shipBefore.totalEstHours - byStatus.shipBefore.doneEstHours
  const productRemainingHours = productEstHours - productDoneEstHours
  const trackedRemainingHours = trackedEstHours - trackedDoneEstHours

  return {
    lastUpdatedAt: source.lastUpdatedAt ?? new Date().toISOString(),
    totalItems: items.length,
    totalEstHours: productEstHours,
    trackedEstHours,
    byStatus,
    completionPct: calcPct(byStatus.shipBefore.doneEstHours, byStatus.shipBefore.totalEstHours),
    fullProductCompletionPct: calcPct(productDoneEstHours, productEstHours),
    trackedCompletionPct: calcPct(trackedDoneEstHours, trackedEstHours),
    etaDaysToShipBefore: calcEtaDays(shipBeforeRemainingHours, velocityHoursPerDay),
    etaDaysToFullProduct: calcEtaDays(productRemainingHours, velocityHoursPerDay),
    etaDaysToAllTracked: calcEtaDays(trackedRemainingHours, velocityHoursPerDay),
    velocityHoursPerDay,
    items,
  }
}

function renderDonut(pct, shipBefore) {
  const size = 380
  const stroke = 30
  const accentStroke = 6
  const r = (size - stroke) / 2
  const accentR = r + 24
  const circ = 2 * Math.PI * r
  const off = circ * (1 - pct / 100)

  return `
    <svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <defs>
        <linearGradient id="progress-arc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--hot)" />
          <stop offset="100%" stop-color="var(--cta)" />
        </linearGradient>
      </defs>
      <circle class="donut-accent-track" cx="${size / 2}" cy="${size / 2}" r="${accentR}" />
      <circle
        class="donut-accent-value"
        cx="${size / 2}"
        cy="${size / 2}"
        r="${accentR}"
        stroke-dasharray="${2 * Math.PI * accentR}"
        stroke-dashoffset="${2 * Math.PI * accentR * 0.82}"
        transform="rotate(-112 ${size / 2} ${size / 2})"
      />
      <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${r}" />
      <circle
        class="donut-value"
        cx="${size / 2}"
        cy="${size / 2}"
        r="${r}"
        stroke-dasharray="${circ}"
        stroke-dashoffset="${off}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
      />
      <text x="${size / 2}" y="${size / 2 - 12}" text-anchor="middle" class="donut-pct">${pct.toFixed(1)}%</text>
      <text x="${size / 2}" y="${size / 2 + 26}" text-anchor="middle" class="donut-sub">Ship-Before progress</text>
      <text x="${size / 2}" y="${size / 2 + 56}" text-anchor="middle" class="donut-meta">${shipBefore.done}/${shipBefore.total} items · ${shipBefore.doneEstHours}/${shipBefore.totalEstHours}h</text>
    </svg>
  `
}

function renderStatStrip(data) {
  return `
    <div class="progress-stat-strip">
      <div class="progress-stat">
        <div class="progress-stat__label">Tracked</div>
        <div class="progress-stat__value">${data.totalItems}</div>
        <div class="progress-stat__unit">items</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat__label">All-In</div>
        <div class="progress-stat__value">${data.trackedEstHours}</div>
        <div class="progress-stat__unit">hours</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat__label">Full Product</div>
        <div class="progress-stat__value">${data.etaDaysToFullProduct ?? '—'}</div>
        <div class="progress-stat__unit">days</div>
      </div>
    </div>
  `
}

function renderEtaBadge(data) {
  const shipEta = data.etaDaysToShipBefore ?? '—'
  const fullEta = data.etaDaysToFullProduct ?? '—'
  const trackedEta = data.etaDaysToAllTracked ?? '—'

  return `
    <section class="eta" aria-label="ETA">
      <div class="eta-label">距離 ship-before 完成</div>
      <div class="eta-days"><span class="num">${shipEta}</span><span class="unit">天</span></div>
      <div class="eta-secondary">
        <div class="eta-secondary__row"><span>Full product</span><strong>${fullEta} 天</strong></div>
        <div class="eta-secondary__row"><span>All tracked</span><strong>${trackedEta} 天</strong></div>
      </div>
      <div class="eta-note">以 ${data.velocityHoursPerDay} 工時/天推估 · O 系列以單輪 4h baseline 計入</div>
    </section>
  `
}

function renderBreakdown(byStatus) {
  const rows = TRACKED_TRACKS.map((track) => ({
    ...byStatus[track],
    color: STATUS_META[track].color,
  }))

  return `
    <div class="breakdown" aria-label="Breakdown">
      ${rows
        .map(
          (row) => `
            <div class="breakdown-row">
              <span class="breakdown-dot" style="background:${row.color}"></span>
              <span class="breakdown-label">${row.label}</span>
              <span class="breakdown-tally">${row.done}/${row.total}</span>
              <span class="breakdown-hours">${row.doneEstHours}/${row.totalEstHours}h</span>
            </div>
          `
        )
        .join('')}
    </div>
  `
}

function timeAgo(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'

  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小時前`
  return `${Math.floor(hrs / 24)} 天前`
}

function renderVelocityNote(data) {
  const ago = timeAgo(data.lastUpdatedAt)

  return `
    <div class="velocity">
      <div>velocity <strong>${data.velocityHoursPerDay}h/day</strong></div>
      <div>full product <strong>${data.fullProductCompletionPct.toFixed(1)}%</strong> · all tracked <strong>${data.trackedCompletionPct.toFixed(1)}%</strong></div>
      <div>last updated <strong>${ago}</strong></div>
    </div>
  `
}

function renderProgressMarkup(data) {
  return `
    <div class="progress-wrap">
      <div class="progress-visual">
        ${renderDonut(data.completionPct, data.byStatus.shipBefore)}
      </div>
      <div class="progress-copy">
        ${renderStatStrip(data)}
        ${renderEtaBadge(data)}
        ${renderBreakdown(data.byStatus)}
        ${renderVelocityNote(data)}
      </div>
    </div>
  `
}

export async function renderProgress(containerEl, { url = './progress.json' } = {}) {
  if (!containerEl) return

  try {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    const raw = await response.json()
    const data = buildProgressSnapshot(raw)
    containerEl.innerHTML = renderProgressMarkup(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    containerEl.innerHTML = `<div class="progress-error">Live progress 讀取失敗 · ${message}</div>`
  }
}
