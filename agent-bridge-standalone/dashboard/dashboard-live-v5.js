import { createPendingDecisionsController } from './dashboard-pending-v5.js'

const AGENT_BRIDGE_BASE_URL = (() => {
  if (window.AGENT_BRIDGE_BASE_URL) return String(window.AGENT_BRIDGE_BASE_URL).replace(/\/$/, '')
  return window.location.pathname.startsWith('/agent-bridge/') ? '/agent-bridge' : ''
})()

const DASHBOARD_TOKEN_KEY = 'dashboard_token'
const DASHBOARD_TOKEN_AT_KEY = 'dashboard_token_at'
const DASHBOARD_TOKEN_EXPIRES_KEY = 'dashboard_token_expires_at'
const BRIDGE_AUTH_TOKEN_KEY = 'bridge_auth_token'
const POLL_INTERVAL_MS = 10_000
const DASHBOARD_COOKIE_NAME = 'dashboard_token'

const state = {
  snapshot: null,
  progressMilestone: null,
  pollTimer: null,
  busyAction: null,
  revealDone: false,
}

const els = {
  deck: document.querySelector('[data-deck]'),
  sections: Array.from(document.querySelectorAll('[data-section]')),
  themeColorMeta: document.getElementById('themeColorMeta'),
  syncLabel: document.querySelector('[data-sync-label]'),
  shipPct: document.querySelector('[data-ship-pct]'),
  shipCount: document.querySelector('[data-ship-count]'),
  shipEta: document.querySelector('[data-ship-eta]'),
  shipEtaHint: document.querySelector('[data-ship-eta-hint]'),
  nextMilestone: document.querySelector('[data-next-milestone]'),
  nextMilestoneEta: document.querySelector('[data-next-milestone-eta]'),
  heroFocus: document.querySelector('[data-hero-focus]'),
  heroToday: document.querySelector('[data-hero-today]'),
  heroPending: document.querySelector('[data-hero-pending]'),
  focusStatus: document.querySelector('[data-focus-status]'),
  focusStatusHint: document.querySelector('[data-focus-status-hint]'),
  focusHeadline: document.querySelector('[data-focus-headline]'),
  focusSubhead: document.querySelector('[data-focus-subhead]'),
  focusFill: document.querySelector('[data-focus-fill]'),
  focusProgress: document.querySelector('[data-focus-progress]'),
  focusParallel: document.querySelector('[data-focus-parallel]'),
  focusMeta: document.querySelector('[data-focus-meta]'),
  focusDetail: document.querySelector('[data-focus-detail]'),
  sessionHint: document.querySelector('[data-session-hint]'),
  actionRow: document.querySelector('[data-action-row]'),
  actionButtons: Array.from(document.querySelectorAll('[data-action]')),
  weekSummary: document.querySelector('[data-week-summary]'),
  latestMeta: document.querySelector('[data-latest-meta]'),
  weekList: document.querySelector('[data-week-list]'),
  latestHash: document.querySelector('[data-latest-hash]'),
  latestMessage: document.querySelector('[data-latest-message]'),
}

const pendingDecisions = createPendingDecisionsController({ apiFetch })

function bridgeUrl(path) {
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${AGENT_BRIDGE_BASE_URL}${safePath}`
}

function clearDashboardAuth() {
  localStorage.removeItem(DASHBOARD_TOKEN_KEY)
  localStorage.removeItem(DASHBOARD_TOKEN_AT_KEY)
  localStorage.removeItem(DASHBOARD_TOKEN_EXPIRES_KEY)
  document.cookie = `${DASHBOARD_COOKIE_NAME}=; Max-Age=0; Path=/`
}

function clearBridgeAuth() {
  localStorage.removeItem(BRIDGE_AUTH_TOKEN_KEY)
}

function clearAllAuth() {
  clearDashboardAuth()
  clearBridgeAuth()
}

function getDashboardToken() {
  const token = localStorage.getItem(DASHBOARD_TOKEN_KEY) || ''
  const expiresAt = Number(localStorage.getItem(DASHBOARD_TOKEN_EXPIRES_KEY) || '0')
  if (!token || !expiresAt || Date.now() >= expiresAt) {
    clearDashboardAuth()
    return ''
  }
  return token
}

function getBridgeToken() {
  return String(localStorage.getItem(BRIDGE_AUTH_TOKEN_KEY) || '').trim()
}

function getAuthContext() {
  const dashboardToken = getDashboardToken()
  if (dashboardToken) return { kind: 'dashboard', token: dashboardToken }
  const bridgeToken = getBridgeToken()
  if (bridgeToken) return { kind: 'bridge', token: bridgeToken }
  return null
}

function redirectToLogin() {
  clearAllAuth()
  const loginUrl = bridgeUrl('/login.html')
  if (window.location.pathname !== loginUrl) window.location.replace(loginUrl)
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const auth = getAuthContext()
  if (auth?.token) headers.set('Authorization', `Bearer ${auth.token}`)
  const response = await fetch(path.startsWith('http') ? path : bridgeUrl(path), {
    ...options,
    headers,
  })
  if (response.status === 401) {
    redirectToLogin()
    throw new Error('Dashboard auth expired')
  }
  return response
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatRelativeTime(value) {
  const ts = typeof value === 'number' ? value : Date.parse(value || '')
  if (!Number.isFinite(ts)) return '剛剛'
  const diff = Date.now() - ts
  if (diff < 30_000) return '剛剛'
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} 分前`
  if (diff < 86_400_000) return `${Math.max(1, Math.round(diff / 3_600_000))} 小時前`
  return `${Math.max(1, Math.round(diff / 86_400_000))} 天前`
}

function formatTime(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return '剛剛'
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatMonthDay(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return '今天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : '0'
}

function truncateText(text, maxLength) {
  const value = String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!value) return ''
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function formatWholePercent(snapshot) {
  const direct = Number(snapshot?.today?.pct)
  if (Number.isFinite(direct)) return `${Math.round(direct)}%`
  const shipPct = Number(snapshot?.shipBefore?.pct)
  if (Number.isFinite(shipPct)) return `${Math.round(shipPct * 100)}%`
  return '0%'
}

function formatPrecisePercent(snapshot) {
  const label = String(snapshot?.shipBefore?.pctLabel || '').trim()
  if (label) return label
  return formatWholePercent(snapshot)
}

function formatTargetLabel(value) {
  const label = String(value || '').trim()
  if (!label) return 'CODEX'
  if (/^bridge$/i.test(label)) return 'CODEX'
  return label.toUpperCase()
}

function localizeDurationToken(token) {
  const value = String(token || '').trim()
  if (!value) return ''
  const parts = []
  const hourMatch = value.match(/(\d+)\s*h/i)
  const minuteMatch = value.match(/(\d+)\s*m/i)
  const secondMatch = value.match(/(\d+)\s*s/i)
  if (hourMatch) parts.push(`${hourMatch[1]}小時`)
  if (minuteMatch) parts.push(`${minuteMatch[1]}分`)
  if (secondMatch) parts.push(`${secondMatch[1]}秒`)
  return parts.join('') || value
}

function localizeShipLabel(label) {
  const value = String(label || '').trim()
  if (!value || /^ship-before$/i.test(value)) return 'SHIP-BEFORE'
  return value
}

function localizeFocusHeadline(value) {
  const text = String(value || '').trim()
  if (!text || /^standby$/i.test(text) || /^quiet mode$/i.test(text)) return 'STANDBY'
  return text
}

function localizeStatusLabel(value) {
  const raw = String(value || '').trim()
  if (!raw || /^bridge idle$/i.test(raw)) return 'CODEX idle'
  return raw
}

function localizeLaneCount(value) {
  const match = String(value || '').match(/(\d+)/)
  return `${match?.[1] || '0'} lanes`
}

function localizeStatusMeta(value) {
  const text = String(value || '').trim()
  if (!text || /^waiting$/i.test(text)) return 'waiting'
  return text
}

function buildShipEtaHint(etaDays) {
  return Number.isFinite(etaDays) ? `剩 ${etaDays} 天` : '時程待定'
}

function buildFocusStatusHint(value) {
  const text = String(value || '').trim()
  if (!text || /^bridge idle$/i.test(text)) return '目前待命 · 等新任務'
  return ''
}

function formatMilestoneLabel(value) {
  const text = String(value || '').trim()
  return text || '運作正常'
}

function formatMilestoneEta(value) {
  const text = String(value || '').trim()
  if (!text) return '目前進度穩定'
  if (/^(預計|ETA)/i.test(text)) return text
  return `預計 ${text}`
}

async function readProgressMilestone() {
  const url = new URL('/portfolio-report/progress.json', window.location.origin)
  url.searchParams.set('ts', String(Date.now()))
  try {
    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json()
    const label = String(data?.currentLayer || '').trim()
    const eta = String(data?.nextLayerEta || '').trim()
    if (!label && !eta) return null
    return {
      label: formatMilestoneLabel(label),
      eta: formatMilestoneEta(eta),
    }
  } catch {
    return null
  }
}

function pickPreferredSessionId(snapshot) {
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : []
  const composer = snapshot?.composer?.sessionId
  if (composer && sessions.some((session) => session.id === composer)) return composer
  const recommended = snapshot?.activeTask?.recommendedSessionId
  if (recommended && sessions.some((session) => session.id === recommended)) return recommended
  return sessions[0]?.id || ''
}

function buildHeroActionMessage(action, snapshot) {
  const title = snapshot?.activeTask?.title || '目前這條 task'
  if (action === 'approve') {
    return `請把「${title}」整理成送審版本。回報 changedFiles、驗證結果、已知風險與下一步。不要 commit。`
  }
  return `先別送審，繼續推進「${title}」的下一個最小安全步。完成後回報 verify、risks、nextStep。不要 commit。`
}

async function sendMessageToSession(sessionId, text) {
  const response = await apiFetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text }),
  })
  const data = await response.json()
  if (!response.ok || !data?.ok) throw new Error('送出失敗')
  return data
}

function setActionButtons(snapshot) {
  const sessionId = pickPreferredSessionId(snapshot)
  const hasSession = Boolean(sessionId)
  for (const button of els.actionButtons) {
    const action = button.dataset.action || 'continue'
    const allowsWakeFallback = action === 'continue'
    button.disabled = state.busyAction !== null || (!hasSession && !allowsWakeFallback)
  }
  if (els.sessionHint) {
    els.sessionHint.textContent = hasSession
      ? `現在可直接交代 · ${formatTargetLabel(snapshot?.composer?.targetLabel)}`
      : '叫 Codex 開新任務'
  }
}

async function handleAction(action) {
  if (!state.snapshot) return
  const sessionId = pickPreferredSessionId(state.snapshot)
  if (!sessionId) {
    if (action === 'continue') {
      window.location.assign(bridgeUrl('/dashboard/wake.html'))
    }
    return
  }
  state.busyAction = action
  setActionButtons(state.snapshot)
  try {
    await sendMessageToSession(sessionId, buildHeroActionMessage(action, state.snapshot))
    if (els.sessionHint) {
      els.sessionHint.textContent = action === 'approve' ? '已送出送審指示' : '已送出繼續推進指示'
    }
  } catch (error) {
    if (els.sessionHint) els.sessionHint.textContent = error?.message || '送出失敗'
  } finally {
    state.busyAction = null
    setActionButtons(state.snapshot)
  }
}

function setThemeFromSection(index) {
  const activeSection = els.sections[index]
  const theme = activeSection?.dataset.theme
  if (theme && els.themeColorMeta) els.themeColorMeta.setAttribute('content', theme)
}

function formatWeekdayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date).toUpperCase()
}

function renderHero(snapshot) {
  if (els.syncLabel) {
    els.syncLabel.textContent = `${formatMonthDay(snapshot?.generatedAt)} · 即時狀態`
  }
  if (els.shipPct) els.shipPct.textContent = formatWholePercent(snapshot)
  if (els.shipCount) {
    els.shipCount.textContent = localizeShipLabel(snapshot?.shipBefore?.label)
  }
  if (els.shipEta) {
    const etaDays = Number(snapshot?.shipBefore?.etaDays)
    els.shipEta.textContent = Number.isFinite(etaDays) ? 'TIME LEFT' : 'ETA PENDING'
    if (els.shipEtaHint) els.shipEtaHint.textContent = buildShipEtaHint(etaDays)
  }
  if (els.nextMilestone) {
    els.nextMilestone.textContent = formatMilestoneLabel(state.progressMilestone?.label)
  }
  if (els.nextMilestoneEta) {
    els.nextMilestoneEta.textContent = formatMilestoneEta(state.progressMilestone?.eta)
  }
  if (els.heroFocus) els.heroFocus.textContent = localizeFocusHeadline(snapshot?.focus?.headline)
  if (els.heroToday) els.heroToday.textContent = `${formatNumber(snapshot?.today?.commits)} commits`
  if (els.heroPending)
    els.heroPending.textContent = `${formatNumber(snapshot?.today?.pendingPush)} pending`
}

function renderFocus(snapshot) {
  const focus = snapshot?.focus || {}
  const shipPct = Number(snapshot?.shipBefore?.pct) || 0
  if (els.focusStatus) {
    els.focusStatus.textContent = localizeStatusLabel(focus.statusLabel)
  }
  if (els.focusStatusHint) {
    els.focusStatusHint.textContent = buildFocusStatusHint(focus.statusLabel)
  }
  if (els.focusHeadline) {
    els.focusHeadline.textContent = localizeFocusHeadline(focus.headline)
  }
  if (els.focusSubhead) {
    els.focusSubhead.textContent =
      focus.subhead === 'Waiting for the next lane.' ? '等下一條路' : focus.subhead || '等下一條路'
  }
  if (els.focusFill) {
    els.focusFill.style.width = `${Math.max(0, Math.min(shipPct * 100, 100))}%`
  }
  if (els.focusProgress) {
    els.focusProgress.textContent = formatPrecisePercent(snapshot)
  }
  if (els.focusParallel) {
    els.focusParallel.textContent = localizeLaneCount(focus.parallelLabel)
  }
  if (els.focusMeta) {
    els.focusMeta.textContent = localizeStatusMeta(focus.statusMeta)
  }
  if (els.focusDetail) {
    els.focusDetail.textContent = truncateText(
      focus.detail === 'Bridge is ready for the next task.'
        ? 'Codex 準備好接下一件事'
        : focus.detail || snapshot?.activeTask?.summary || 'Codex 準備好接下一件事',
      100
    )
  }
  setActionButtons(snapshot)
}

function renderWeek(snapshot) {
  const entries = Array.isArray(snapshot?.commitBars) ? [...snapshot.commitBars].reverse() : []
  const latestCommit = snapshot?.posterRecentCommits?.[0] || snapshot?.recentCommits?.[0] || null
  const peak = Math.max(...entries.map((entry) => Number(entry.count) || 0), 1)
  if (els.weekSummary) {
    const peakCount = formatNumber(snapshot?.commitChart?.peak ?? peak)
    els.weekSummary.textContent = `${formatNumber(snapshot?.today?.commits)} today · peak ${peakCount}`
  }
  if (!entries.length) {
    if (els.weekList) els.weekList.innerHTML = ''
  } else if (els.weekList) {
    els.weekList.innerHTML = entries
      .map((entry, index) => {
        const width = entry.count > 0 ? Math.max((entry.count / peak) * 100, 6) : 0
        const opacity = Math.max(0.26, 1 - index * 0.11)
        const classNames = ['week-row']
        if (entry.isToday) classNames.push('is-today')
        if (Number(entry.count) === 0) classNames.push('is-quiet')
        return [
          `<div class="${classNames.join(' ')}" style="--row-opacity:${opacity};--fill:${width}%">`,
          '<div class="week-line">',
          `<span class="week-name">${escapeHtml(formatWeekdayName(entry.date))}</span>`,
          `<span class="week-count">${escapeHtml(String(entry.count).padStart(2, '0'))}</span>`,
          '</div>',
          '<div class="week-track"><span></span></div>',
          '</div>',
        ].join('')
      })
      .join('')
  }
  if (els.latestHash) {
    els.latestHash.textContent = (
      latestCommit?.shortHash ||
      String(latestCommit?.hash || '----').slice(0, 4) ||
      '----'
    ).toUpperCase()
  }
  if (els.latestMessage) {
    els.latestMessage.textContent = truncateText(latestCommit?.message || '最近沒有送出', 34)
  }
  if (els.latestMeta) {
    els.latestMeta.textContent = 'Latest commit'
  }
}

function renderAll() {
  renderHero(state.snapshot)
  renderFocus(state.snapshot)
  renderWeek(state.snapshot)
  document.title = `${formatWholePercent(state.snapshot)} · ${localizeFocusHeadline(state.snapshot?.focus?.headline || 'CODEX')}`
  if (!state.revealDone) {
    state.revealDone = true
    window.requestAnimationFrame(() => document.body.classList.add('is-ready'))
  }
}

async function refreshSnapshot() {
  try {
    const [response, pendingResponse, progressMilestone] = await Promise.all([
      apiFetch('/api/dashboard-snapshot'),
      apiFetch('/api/pending-decisions'),
      readProgressMilestone(),
    ])
    const [data, pendingData] = await Promise.all([response.json(), pendingResponse.json()])
    if (!response.ok || !pendingResponse.ok) throw new Error('讀取失敗')
    state.snapshot = data
    state.progressMilestone = progressMilestone
    pendingDecisions.setPayload(pendingData)
    renderAll()
  } catch (error) {
    console.error(error)
    if (!state.snapshot && els.sessionHint) {
      els.sessionHint.textContent = error?.message || '讀取失敗'
    }
  }
}

function bindSectionObserver() {
  if (!els.sections.length) return
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      const index = els.sections.indexOf(visible.target)
      if (index >= 0) setThemeFromSection(index)
    },
    {
      root: els.deck,
      threshold: [0.55, 0.72],
    }
  )
  for (const section of els.sections) observer.observe(section)
  setThemeFromSection(0)
}

function bindEvents() {
  for (const button of els.actionButtons) {
    button.addEventListener('click', () => handleAction(button.dataset.action || 'continue'))
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSnapshot()
  })
}

function startPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer)
  state.pollTimer = window.setInterval(refreshSnapshot, POLL_INTERVAL_MS)
}

async function init() {
  bindEvents()
  bindSectionObserver()
  await refreshSnapshot()
  startPolling()
}

init().catch((error) => {
  console.error(error)
  if (els.sessionHint) els.sessionHint.textContent = error?.message || '初始化失敗'
})
