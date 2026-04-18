const AGENT_BRIDGE_BASE_URL = (() => {
  if (window.AGENT_BRIDGE_BASE_URL) return String(window.AGENT_BRIDGE_BASE_URL).replace(/\/$/, '')
  return window.location.pathname.startsWith('/agent-bridge/') ? '/agent-bridge' : ''
})()

const DASHBOARD_TOKEN_KEY = 'dashboard_token'
const DASHBOARD_TOKEN_AT_KEY = 'dashboard_token_at'
const DASHBOARD_TOKEN_EXPIRES_KEY = 'dashboard_token_expires_at'
const BRIDGE_AUTH_TOKEN_KEY = 'bridge_auth_token'
const POLL_INTERVAL_MS = 10_000

const state = {
  snapshot: null,
  pollTimer: null,
  lastSyncAt: null,
}

function bridgeUrl(path) {
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${AGENT_BRIDGE_BASE_URL}${safePath}`
}

function clearDashboardAuth() {
  localStorage.removeItem(DASHBOARD_TOKEN_KEY)
  localStorage.removeItem(DASHBOARD_TOKEN_AT_KEY)
  localStorage.removeItem(DASHBOARD_TOKEN_EXPIRES_KEY)
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
  window.location.replace(bridgeUrl('/login.html'))
}

async function apiFetch(path, options = {}) {
  const auth = getAuthContext()
  if (!auth?.token) {
    redirectToLogin()
    throw new Error('Missing auth token')
  }
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${auth.token}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(bridgeUrl(path), { ...options, headers })
  if (response.status === 401) {
    redirectToLogin()
    throw new Error('Dashboard auth expired')
  }
  return response
}

function resolvePath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce(
      (acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined),
      source
    )
}

function setBoundContent(source) {
  document.querySelectorAll('[data-bind]').forEach((node) => {
    const value = resolvePath(source, node.getAttribute('data-bind'))
    node.textContent = value == null || value === '' ? '—' : String(value)
  })
  document.querySelectorAll('[data-placeholder-bind]').forEach((node) => {
    const value = resolvePath(source, node.getAttribute('data-placeholder-bind'))
    node.setAttribute('placeholder', value == null || value === '' ? '' : String(value))
  })
}

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatShortDate(value) {
  if (!value) return 'latest'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'latest'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function relativeTime(value) {
  if (!value) return 'now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'now'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin <= 0) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d`
}

function setStatusDot(node, status) {
  if (!node) return
  node.className = 'status-dot'
  if (status === 'running') node.classList.add('is-running')
  else if (status === 'idle') node.classList.add('is-idle')
  else node.classList.add('is-offline')
}

function renderCommitBars(snapshot) {
  const bars = Array.isArray(snapshot?.commitBars) ? snapshot.commitBars : []
  const root = document.getElementById('commitBars')
  const meta = document.getElementById('commitBarsMeta')
  if (!root) return
  if (!bars.length) {
    root.innerHTML = '<div class="empty-copy">No commit activity in the last 7 days.</div>'
    if (meta) meta.textContent = 'no commits'
    return
  }
  const peak = Math.max(...bars.map((bar) => Number(bar.count) || 0), 1)
  const total = bars.reduce((sum, bar) => sum + (Number(bar.count) || 0), 0)
  if (meta) meta.textContent = `${total} commits / 7d`
  root.innerHTML = bars
    .map((bar) => {
      const count = Number(bar.count) || 0
      const height = Math.max((count / peak) * 100, count > 0 ? 12 : 6)
      return `
      <div class="bar-column ${bar.isToday ? 'is-today' : ''}">
        <div class="bar-value">${count}</div>
        <div class="bar-track">
          <div class="bar-fill" style="height:${height}%"></div>
        </div>
        <div class="bar-day">${bar.label || '—'}</div>
      </div>
    `
    })
    .join('')
}

function renderShipProgress(snapshot) {
  const ship = snapshot?.shipBefore || {}
  const fill = document.getElementById('shipProgressFill')
  const days = document.getElementById('shipDaysRemaining')
  const progressText = document.getElementById('shipProgressText')
  const updatedText = document.getElementById('shipUpdatedText')
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, Number(ship.pct || 0) * 100))}%`
  if (days) days.textContent = ship.etaDays == null ? '—' : String(ship.etaDays)
  if (progressText)
    progressText.textContent = `${Number(ship.done) || 0} / ${Number(ship.total) || 0}`
  if (updatedText) updatedText.textContent = formatShortDate(ship.lastUpdatedAt)
}

function renderAgents(snapshot) {
  const agents = Array.isArray(snapshot?.agents) ? snapshot.agents : []
  const root = document.getElementById('agentList')
  const meta = document.getElementById('agentsMeta')
  if (!root) return
  if (!agents.length) {
    root.innerHTML = '<div class="empty-copy">No agent snapshot yet.</div>'
    if (meta) meta.textContent = 'status pending'
    return
  }
  const runningCount = agents.filter((agent) => agent.status === 'running').length
  if (meta) meta.textContent = `${runningCount} running / ${agents.length} tracked`
  root.innerHTML = agents
    .map(
      (agent) => `
    <article class="agent-row">
      <div class="agent-main">
        <div class="agent-name">${agent.label || agent.name || 'AGENT'}</div>
        <div class="status-row">
          <span class="status-dot ${agent.status === 'running' ? 'is-running' : agent.status === 'idle' ? 'is-idle' : 'is-offline'}"></span>
          <span class="agent-state">${agent.status || 'offline'}</span>
        </div>
      </div>
      <div class="agent-meta">${agent.meta || 'waiting'}</div>
      <div class="agent-note">${agent.note || 'No update'}</div>
    </article>
  `
    )
    .join('')
}

function renderCommits(snapshot) {
  const commits = Array.isArray(snapshot?.recentCommits) ? snapshot.recentCommits : []
  const root = document.getElementById('commitList')
  const meta = document.getElementById('commitsMeta')
  if (!root) return
  if (!commits.length) {
    root.innerHTML = '<div class="empty-copy">No recent commits found.</div>'
    if (meta) meta.textContent = 'git quiet'
    return
  }
  if (meta) meta.textContent = `${commits.length} latest`
  root.innerHTML = commits
    .map(
      (commit, index) => `
    <article class="commit-row ${index === 0 ? 'is-latest' : ''}">
      <div class="commit-main">
        <div class="commit-message">${commit.message || '(no message)'}</div>
        <div class="commit-hash">${commit.shortHash || '----'}</div>
      </div>
      <div class="commit-meta">${relativeTime(commit.time)} · ${commit.filesChanged || 0} files · +${commit.insertions || 0} / -${commit.deletions || 0}</div>
    </article>
  `
    )
    .join('')
}

function updateStatus(snapshot) {
  const status = snapshot?.focus?.status || 'offline'
  setStatusDot(document.getElementById('focusDot'), status)
  setStatusDot(document.getElementById('topbarDot'), status)
  const statusText = document.getElementById('topbarStatus')
  if (statusText) {
    statusText.textContent = status === 'running' ? 'Live' : status === 'idle' ? 'Idle' : 'Offline'
  }
}

function updateComposerState(snapshot) {
  const input = document.getElementById('composerInput')
  const sendButton = document.getElementById('composerSend')
  if (!input || !sendButton) return
  const hasSession = Boolean(snapshot?.composer?.sessionId)
  input.disabled = !hasSession
  sendButton.disabled = !hasSession || !String(input.value || '').trim()
}

function renderSnapshot(snapshot) {
  state.snapshot = snapshot
  state.lastSyncAt = Date.now()
  setBoundContent(snapshot)
  renderCommitBars(snapshot)
  renderShipProgress(snapshot)
  renderAgents(snapshot)
  renderCommits(snapshot)
  updateStatus(snapshot)
  updateComposerState(snapshot)
  const status = document.getElementById('composerStatus')
  if (status) status.textContent = `Synced ${formatClock(new Date(state.lastSyncAt))}`
}

async function loadSnapshot() {
  const response = await apiFetch('/api/dashboard-snapshot')
  const snapshot = await response.json()
  renderSnapshot(snapshot)
}

async function handleComposerSubmit(event) {
  event.preventDefault()
  const input = document.getElementById('composerInput')
  const sendButton = document.getElementById('composerSend')
  const status = document.getElementById('composerStatus')
  const sessionId = state.snapshot?.composer?.sessionId
  const text = String(input?.value || '').trim()
  if (!sessionId || !text) return

  try {
    if (sendButton) sendButton.disabled = true
    if (status) status.textContent = 'Sending…'
    const response = await apiFetch('/api/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId, text }),
    })
    const payload = await response.json()
    if (!payload?.ok) throw new Error('send failed')
    if (input) input.value = ''
    if (status) status.textContent = `Sent ${formatClock(new Date())}`
  } catch (error) {
    if (status) status.textContent = error?.message || 'Send failed'
  } finally {
    updateComposerState(state.snapshot)
  }
}

function startClock() {
  const node = document.getElementById('topbarTime')
  const tick = () => {
    if (node) node.textContent = formatClock(new Date())
  }
  tick()
  window.setInterval(tick, 30_000)
}

function startPolling() {
  const run = async () => {
    try {
      await loadSnapshot()
    } catch (error) {
      const status = document.getElementById('composerStatus')
      if (status) status.textContent = error?.message || 'Snapshot failed'
      console.error(error)
    }
  }
  run()
  state.pollTimer = window.setInterval(run, POLL_INTERVAL_MS)
}

function bindEvents() {
  const form = document.getElementById('composerForm')
  const input = document.getElementById('composerInput')
  if (form) form.addEventListener('submit', handleComposerSubmit)
  if (input) {
    input.addEventListener('input', () => updateComposerState(state.snapshot))
  }
}

startClock()
bindEvents()
startPolling()
