const AGENT_BRIDGE_BASE_URL = (() => {
  if (window.AGENT_BRIDGE_BASE_URL) return String(window.AGENT_BRIDGE_BASE_URL).replace(/\/$/, '')
  return window.location.pathname.startsWith('/agent-bridge/') ? '/agent-bridge' : ''
})()

const DASHBOARD_TOKEN_KEY = 'dashboard_token'
const DASHBOARD_TOKEN_EXPIRES_KEY = 'dashboard_token_expires_at'
const BRIDGE_AUTH_TOKEN_KEY = 'bridge_auth_token'

const els = {
  continueBtn: document.getElementById('wakeContinueBtn'),
  sendBtn: document.getElementById('wakeSendBtn'),
  prompt: document.getElementById('wakePromptInput'),
  status: document.getElementById('wakeStatusMeta'),
  output: document.getElementById('wakeOutput'),
}

let pollRunId = 0

function bridgeUrl(path) {
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${AGENT_BRIDGE_BASE_URL}${safePath}`
}

function clearDashboardAuth() {
  localStorage.removeItem(DASHBOARD_TOKEN_KEY)
  localStorage.removeItem(DASHBOARD_TOKEN_EXPIRES_KEY)
  document.cookie = 'dashboard_token=; Max-Age=0; Path=/'
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

function setBusy(isBusy) {
  if (els.continueBtn) els.continueBtn.disabled = isBusy
  if (els.sendBtn) els.sendBtn.disabled = isBusy
}

async function pollWakeLog(logPath) {
  const match = /wake-(\d+)\.log$/.exec(String(logPath || ''))
  if (!match) {
    els.status.textContent = 'invalid log path'
    return
  }
  const wakeId = match[1]
  const runId = Date.now()
  pollRunId = runId
  for (let index = 0; index < 120; index += 1) {
    if (pollRunId !== runId) return
    try {
      const response = await apiFetch(`/wake/log/${wakeId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'failed to read wake log')
      els.output.textContent = data.content || 'Wake log is still empty.'
      els.status.textContent = `wake-${wakeId} · ${data.status || 'running'}`
      if (data.status === 'finished') return
    } catch (error) {
      els.status.textContent = error?.message || 'failed to read wake log'
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_500))
  }
  els.status.textContent = `wake-${wakeId} · polling timeout`
}

async function submitWake(mode) {
  const message = String(els.prompt?.value || '').trim()
  if (mode === 'command' && !message) {
    els.status.textContent = 'enter a command first'
    els.prompt?.focus()
    return
  }
  setBusy(true)
  els.status.textContent = mode === 'continue' ? 'continue runbook queued' : 'custom wake queued'
  els.output.textContent = 'Sending Layer 2 task...'
  try {
    const response = await apiFetch('/wake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'continue' ? { mode } : { mode, message }),
    })
    const data = await response.json()
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'wake failed')
    els.output.textContent = [
      `queued: ${data.cli || 'vm-llm'}`,
      `log: ${data.logPath}`,
      data.hint || '',
      '',
    ].join('\n')
    els.status.textContent = mode === 'continue' ? 'continue runbook sent' : 'custom wake sent'
    if (mode === 'command' && els.prompt) els.prompt.value = ''
    await pollWakeLog(data.logPath)
  } catch (error) {
    els.output.textContent = error?.message || 'wake failed'
    els.status.textContent = 'wake failed'
  } finally {
    setBusy(false)
  }
}

function bindEvents() {
  els.continueBtn?.addEventListener('click', () => submitWake('continue'))
  els.sendBtn?.addEventListener('click', () => submitWake('command'))
  els.prompt?.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      submitWake('command')
    }
  })
}

bindEvents()
