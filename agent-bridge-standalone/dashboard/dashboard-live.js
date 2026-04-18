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
  loading: false,
  heroBusy: false,
  quickBusy: false,
  noticeTimer: null,
  wakePollRunId: 0,
}

const els = {
  notice: document.querySelector('[data-notice]'),
  date: document.querySelector('[data-date]'),
  syncDot: document.querySelector('[data-sync-dot]'),
  syncLabel: document.querySelector('[data-sync-label]'),
  ownerChip: document.querySelector('[data-owner-chip]'),
  taskStatus: document.querySelector('[data-task-status]'),
  taskTitle: document.querySelector('[data-task-title]'),
  taskDetail: document.querySelector('[data-task-detail]'),
  heroButtons: Array.from(document.querySelectorAll('[data-action]')),
  waitingCount: document.querySelector('[data-waiting-count]'),
  waitingMeta: document.querySelector('[data-waiting-meta]'),
  todayCommits: document.querySelector('[data-today-commits]'),
  commitMeta: document.querySelector('[data-commit-meta]'),
  weekDone: document.querySelector('[data-week-done]'),
  weekMeta: document.querySelector('[data-week-meta]'),
  commitSummary: document.querySelector('[data-commit-summary]'),
  commitBars: document.querySelector('[data-commit-bars]'),
  stageLabel: document.querySelector('[data-stage-label]'),
  stageCount: document.querySelector('[data-stage-count]'),
  progressPct: document.querySelector('[data-progress-pct]'),
  progressUpdated: document.querySelector('[data-progress-updated]'),
  progressFill: document.querySelector('[data-progress-fill]'),
  etaDays: document.querySelector('[data-eta-days]'),
  agents: document.querySelector('[data-agents]'),
  recentCommitSummary: document.querySelector('[data-recent-commit-summary]'),
  recentCommits: document.querySelector('[data-recent-commits]'),
  quickTarget: document.querySelector('[data-quick-target]'),
  quickInput: document.querySelector('[data-quick-input]'),
  quickStatus: document.querySelector('[data-quick-status]'),
  quickSubmit: document.querySelector('[data-quick-submit]'),
  wakeContinueBtn: document.getElementById('wakeContinueBtn'),
  wakeSendBtn: document.getElementById('wakeSendBtn'),
  wakePromptInput: document.getElementById('wakePromptInput'),
  wakeStatusMeta: document.getElementById('wakeStatusMeta'),
  wakeOutput: document.getElementById('wakeOutput'),
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
  const loginUrl = bridgeUrl('/login.html')
  if (window.location.pathname !== loginUrl) window.location.replace(loginUrl)
}

async function apiFetch(path, options = {}) {
  const auth = getAuthContext()
  if (!auth?.token) {
    redirectToLogin()
    throw new Error('Missing dashboard token')
  }
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${auth.token}`)
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

function formatIsoDate(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return '—'
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatRelativeTime(value) {
  const ts = typeof value === 'number' ? value : Date.parse(value || '')
  if (!Number.isFinite(ts)) return '未知'
  const diff = Date.now() - ts
  if (diff < 30_000) return '剛剛'
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} 分鐘前`
  if (diff < 86_400_000) return `${Math.max(1, Math.round(diff / 3_600_000))} 小時前`
  return `${Math.max(1, Math.round(diff / 86_400_000))} 天前`
}

function formatShortTime(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return '—'
  const sameDay = formatIsoDate(date) === formatIsoDate(Date.now())
  return new Intl.DateTimeFormat(
    'zh-TW',
    sameDay
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { month: '2-digit', day: '2-digit' }
  ).format(date)
}

function formatNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : '—'
}

function formatPercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0%'
  if (num < 10) return `${num.toFixed(1).replace(/\.0$/, '')}%`
  return `${Math.round(num)}%`
}

function humanizeTaskStatus(status) {
  const value = String(status || '')
    .trim()
    .toLowerCase()
  if (value === 'in-progress') return '進行中'
  if (value === 'waiting-decision') return '等決策'
  if (value === 'blocked') return '卡住'
  if (value === 'completed') return '已完成'
  return '待處理'
}

function setNotice(message, tone = 'info', timeoutMs = 4_000) {
  if (!els.notice) return
  if (state.noticeTimer) {
    window.clearTimeout(state.noticeTimer)
    state.noticeTimer = null
  }
  if (!message) {
    els.notice.classList.remove('visible')
    els.notice.textContent = ''
    els.notice.style.borderColor = ''
    els.notice.style.background = ''
    els.notice.style.color = ''
    return
  }
  els.notice.textContent = message
  els.notice.classList.add('visible')
  if (tone === 'error') {
    els.notice.style.borderColor = 'rgba(182, 90, 77, 0.32)'
    els.notice.style.background = 'rgba(182, 90, 77, 0.08)'
    els.notice.style.color = '#9f4034'
  } else if (tone === 'success') {
    els.notice.style.borderColor = 'rgba(111, 133, 104, 0.34)'
    els.notice.style.background = 'rgba(111, 133, 104, 0.1)'
    els.notice.style.color = '#4d6250'
  } else {
    els.notice.style.borderColor = 'rgba(184, 92, 56, 0.22)'
    els.notice.style.background = 'rgba(184, 92, 56, 0.08)'
    els.notice.style.color = '#9a4a2d'
  }
  if (timeoutMs > 0) {
    state.noticeTimer = window.setTimeout(() => setNotice(''), timeoutMs)
  }
}

function setHeroBusy(isBusy) {
  state.heroBusy = isBusy
  for (const button of els.heroButtons) button.disabled = isBusy
}

function setQuickBusy(isBusy) {
  state.quickBusy = isBusy
  if (els.quickSubmit) els.quickSubmit.disabled = isBusy
}

function setQuickStatus(message, tone = 'info') {
  if (!els.quickStatus) return
  els.quickStatus.textContent = message || ''
  els.quickStatus.style.color = tone === 'error' ? '#9f4034' : tone === 'success' ? '#4d6250' : ''
}

function pickPreferredSessionId(snapshot) {
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : []
  const recommended = snapshot?.activeTask?.recommendedSessionId
  if (recommended && sessions.some((session) => session.id === recommended)) return recommended
  return sessions[0]?.id || ''
}

function renderTopbar(snapshot) {
  if (els.date) els.date.textContent = formatIsoDate(snapshot?.generatedAt || Date.now())
  if (els.syncLabel) {
    const label = snapshot?.topbar?.syncLabel || '已連線'
    els.syncLabel.textContent = `${label} · ${formatRelativeTime(snapshot?.generatedAt || Date.now())}`
  }
  if (els.syncDot) els.syncDot.className = 'dot active'
}

function renderHero(snapshot) {
  const task = snapshot?.activeTask
  if (!task) {
    if (els.ownerChip) els.ownerChip.textContent = 'STANDBY'
    if (els.taskStatus) els.taskStatus.textContent = '待處理'
    if (els.taskTitle) els.taskTitle.textContent = '目前沒有 active task'
    if (els.taskDetail)
      els.taskDetail.textContent = '等下一條 task 被 dispatch 後，這裡會顯示最該看的 focus。'
    for (const button of els.heroButtons) button.disabled = true
    return
  }
  if (els.ownerChip)
    els.ownerChip.textContent = task.ownerLabel || String(task.owner || 'agent').toUpperCase()
  if (els.taskStatus) els.taskStatus.textContent = humanizeTaskStatus(task.status)
  if (els.taskTitle) els.taskTitle.textContent = task.title || 'Untitled'
  if (els.taskDetail) {
    const detailBits = [task.detail || task.summary || '']
    if (task.siblingActiveCount)
      detailBits.push(`另外還有 ${task.siblingActiveCount} 條 active task。`)
    els.taskDetail.textContent = detailBits.filter(Boolean).join(' ')
  }
  const hasTarget = Boolean(pickPreferredSessionId(snapshot))
  for (const button of els.heroButtons) button.disabled = state.heroBusy || !hasTarget
}

function renderKpis(snapshot) {
  const kpi = snapshot?.kpi || {}
  if (els.waitingCount) els.waitingCount.textContent = formatNumber(kpi.waitingCount)
  if (els.waitingMeta)
    els.waitingMeta.textContent = `${formatNumber(kpi.inProgressCount)} 條 in-progress / ${formatNumber(kpi.totalTasks)} 條總 task`
  if (els.todayCommits) els.todayCommits.textContent = formatNumber(kpi.todayCommits)
  if (els.commitMeta)
    els.commitMeta.textContent = `近 7 天峰值 ${formatNumber(snapshot?.commitChart?.peak)}`
  if (els.weekDone) els.weekDone.textContent = formatNumber(kpi.weekDone)
  if (els.weekMeta) {
    const progress = snapshot?.progress || {}
    els.weekMeta.textContent = `${progress.label || 'Ship-Before'} ${formatNumber(progress.done)} / ${formatNumber(progress.total)}`
  }
}

function renderCommitBars(snapshot) {
  const chart = snapshot?.commitChart
  const entries = Array.isArray(chart?.entries) ? chart.entries : []
  if (!entries.length) {
    els.commitBars.innerHTML = '<div class=\"empty\">目前沒有 commit chart 資料。</div>'
    if (els.commitSummary) els.commitSummary.textContent = '週平均 —'
    return
  }
  const peak = Math.max(Number(chart.peak) || 0, 1)
  els.commitBars.innerHTML = entries
    .map((entry) => {
      const width = entry.count > 0 ? Math.max((entry.count / peak) * 100, 6) : 0
      return [
        `<div class=\"chart-row ${entry.isToday ? 'today' : ''}\">`,
        `<div class=\"chart-label\">${escapeHtml(entry.label || entry.date || '—')}</div>`,
        '<div class=\"chart-track\">',
        `<div class=\"chart-fill\" style=\"width:${width}%\"></div>`,
        '</div>',
        `<div class=\"chart-value\">${escapeHtml(entry.count)}</div>`,
        '</div>',
      ].join('')
    })
    .join('')
  if (els.commitSummary) {
    const avg = Number(chart.average) || 0
    els.commitSummary.textContent = `週平均 ${avg.toFixed(1).replace(/\.0$/, '')} · 峰值 ${formatNumber(chart.peak)}`
  }
}

function renderProgress(snapshot) {
  const progress = snapshot?.progress || {}
  const pct = Number(progress.completionPct) || 0
  if (els.stageLabel) els.stageLabel.textContent = progress.label || 'Ship-Before'
  if (els.stageCount)
    els.stageCount.textContent = `${formatNumber(progress.done)} / ${formatNumber(progress.total)}`
  if (els.progressPct) els.progressPct.textContent = formatPercent(pct)
  if (els.progressUpdated) {
    els.progressUpdated.textContent = progress.lastUpdatedAt
      ? `更新 ${formatRelativeTime(progress.lastUpdatedAt)}`
      : '尚未讀到 progress.json'
  }
  if (els.progressFill) els.progressFill.style.width = `${Math.max(0, Math.min(pct, 100))}%`
  if (els.etaDays)
    els.etaDays.textContent = Number.isFinite(Number(progress.etaDays))
      ? String(Number(progress.etaDays))
      : '—'
}

function renderAgents(snapshot) {
  const agents = Array.isArray(snapshot?.agents) ? snapshot.agents : []
  if (!agents.length) {
    els.agents.innerHTML = '<div class=\"empty\">目前沒有 agent activity。</div>'
    return
  }
  els.agents.innerHTML = agents
    .map((agent) => {
      const tone =
        agent.statusTone === 'up'
          ? 'up'
          : agent.statusTone === 'down'
            ? 'down'
            : agent.statusTone === 'amber'
              ? 'amber'
              : agent.statusTone === 'active'
                ? 'active'
                : 'muted'
      return [
        '<div class=\"agent-row\">',
        `<div><span class=\"dot ${tone}\"></span></div>`,
        '<div>',
        `<div class=\"agent-meta\">${escapeHtml(agent.host || '—')}</div>`,
        `<div class=\"agent-label\">${escapeHtml(agent.label || 'Unknown agent')}</div>`,
        `<div class=\"agent-note\">${escapeHtml(agent.message || 'waiting update')}</div>`,
        '</div>',
        `<div class=\"agent-time\">${escapeHtml(formatRelativeTime(agent.timestamp))}</div>`,
        '</div>',
      ].join('')
    })
    .join('')
}

function renderRecentCommits(snapshot) {
  const commits = Array.isArray(snapshot?.recentCommits) ? snapshot.recentCommits : []
  if (els.recentCommitSummary) {
    els.recentCommitSummary.textContent = commits.length ? `最新 ${commits.length} 筆` : '最新 0 筆'
  }
  if (!commits.length) {
    els.recentCommits.innerHTML = '<div class=\"empty\">目前讀不到 recent commits。</div>'
    return
  }
  els.recentCommits.innerHTML = commits
    .map((commit) => {
      const stat =
        commit.filesChanged || commit.insertions || commit.deletions
          ? `<span class=\"commit-stat\">${escapeHtml(commit.filesChanged || 0)} 檔 <span class=\"ins\">+${escapeHtml(commit.insertions || 0)}</span> <span class=\"del\">-${escapeHtml(commit.deletions || 0)}</span></span>`
          : ''
      return [
        '<div class=\"recent-commit\">',
        `<div class=\"commit-ts\">${escapeHtml(formatShortTime(commit.time))}</div>`,
        `<div class=\"commit-hash\">${escapeHtml(commit.hash || '—')}</div>`,
        `<div class=\"commit-msg\">${escapeHtml(commit.message || '')}${stat}</div>`,
        '</div>',
      ].join('')
    })
    .join('')
}

function renderQuickTarget(snapshot) {
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : []
  const currentValue = els.quickTarget.value
  if (!sessions.length) {
    els.quickTarget.innerHTML = '<option value=\"\">目前沒有 active session</option>'
    els.quickTarget.value = ''
    return
  }
  els.quickTarget.innerHTML = sessions
    .map((session) => {
      const recommended = session.id === snapshot?.activeTask?.recommendedSessionId
      const label = recommended
        ? `推薦 · ${session.agentName} · ${session.terminalName}`
        : `${session.agentName} · ${session.terminalName}`
      return `<option value=\"${escapeHtml(session.id)}\">${escapeHtml(label)}</option>`
    })
    .join('')
  els.quickTarget.value = sessions.some((session) => session.id === currentValue)
    ? currentValue
    : pickPreferredSessionId(snapshot)
}

function renderAll() {
  renderTopbar(state.snapshot)
  renderHero(state.snapshot)
  renderKpis(state.snapshot)
  renderCommitBars(state.snapshot)
  renderProgress(state.snapshot)
  renderAgents(state.snapshot)
  renderRecentCommits(state.snapshot)
  renderQuickTarget(state.snapshot)
}

async function refreshSnapshot({ silent = false } = {}) {
  if (state.loading) return
  state.loading = true
  try {
    const response = await apiFetch('/api/dashboard-snapshot')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'dashboard snapshot 載入失敗')
    state.snapshot = data
    renderAll()
    if (!silent) setNotice('', 'info', 0)
  } catch (error) {
    console.error(error)
    if (!silent || !state.snapshot) {
      setNotice(error?.message || 'dashboard snapshot 載入失敗', 'error', 5_000)
    }
  } finally {
    state.loading = false
  }
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
  if (!response.ok || !data?.ok) throw new Error(data?.error || '送訊失敗')
  return data
}

async function handleHeroAction(action) {
  if (!state.snapshot) return
  const sessionId = pickPreferredSessionId(state.snapshot)
  if (!sessionId) {
    setNotice('目前沒有可送訊的 active session。', 'error', 4_500)
    return
  }
  setHeroBusy(true)
  try {
    await sendMessageToSession(sessionId, buildHeroActionMessage(action, state.snapshot))
    setNotice(
      action === 'approve'
        ? '已要求 active session 整理送審版本。'
        : '已要求 active session 繼續推進。',
      'success',
      4_500
    )
  } catch (error) {
    setNotice(error?.message || 'Hero action 送出失敗', 'error', 4_500)
  } finally {
    setHeroBusy(false)
  }
}

async function handleQuickSubmit() {
  const sessionId = els.quickTarget.value || pickPreferredSessionId(state.snapshot)
  const message = String(els.quickInput.value || '').trim()
  if (!sessionId) {
    setQuickStatus('目前沒有可送訊的 active session。', 'error')
    return
  }
  if (!message) {
    setQuickStatus('請先輸入要送出的訊息。', 'error')
    els.quickInput.focus()
    return
  }
  setQuickBusy(true)
  setQuickStatus('送出中…')
  try {
    await sendMessageToSession(sessionId, message)
    els.quickInput.value = ''
    setQuickStatus('已送出。', 'success')
  } catch (error) {
    setQuickStatus(error?.message || '送訊失敗', 'error')
  } finally {
    setQuickBusy(false)
  }
}

function setWakeBusy(isBusy) {
  if (els.wakeContinueBtn) els.wakeContinueBtn.disabled = isBusy
  if (els.wakeSendBtn) els.wakeSendBtn.disabled = isBusy
}

async function pollWakeLog(logPath) {
  const match = /wake-(\d+)\.log$/.exec(String(logPath || ''))
  if (!match) {
    els.wakeStatusMeta.textContent = 'logPath 格式不正確'
    return
  }
  const wakeId = match[1]
  const pollRunId = Date.now()
  state.wakePollRunId = pollRunId
  for (let i = 0; i < 120; i += 1) {
    if (state.wakePollRunId !== pollRunId) return
    try {
      const response = await apiFetch(`/wake/log/${wakeId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '讀取 wake log 失敗')
      els.wakeOutput.textContent = data.content || 'Wake log 尚無輸出'
      els.wakeStatusMeta.textContent = `wake-${wakeId} · ${data.status || 'running'}`
      if (data.status === 'finished') return
    } catch (error) {
      els.wakeStatusMeta.textContent = error?.message || '讀取 wake log 失敗'
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_500))
  }
  els.wakeStatusMeta.textContent = `wake-${wakeId} · polling timeout`
}

async function submitWake(mode) {
  const message = String(els.wakePromptInput.value || '').trim()
  if (mode === 'command' && !message) {
    els.wakeStatusMeta.textContent = '請先輸入自訂指令'
    els.wakePromptInput.focus()
    return
  }
  setWakeBusy(true)
  els.wakeOutput.textContent = '送出 Layer 2 任務中…'
  els.wakeStatusMeta.textContent =
    mode === 'continue' ? 'continue runbook 送出中' : '自訂 wake 指令送出中'
  try {
    const response = await apiFetch('/wake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'continue' ? { mode } : { mode, message }),
    })
    const data = await response.json()
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'wake 送出失敗')
    els.wakeOutput.textContent = [
      `queued: ${data.cli || 'vm-llm'}`,
      `log: ${data.logPath}`,
      data.hint || '',
      '',
    ].join('\n')
    els.wakeStatusMeta.textContent = `已送出 ${mode === 'continue' ? 'continue runbook' : '自訂指令'}`
    if (mode === 'command') els.wakePromptInput.value = ''
    await pollWakeLog(data.logPath)
  } catch (error) {
    els.wakeOutput.textContent = error?.message || 'wake 送出失敗'
    els.wakeStatusMeta.textContent = 'Layer 2 送出失敗'
  } finally {
    setWakeBusy(false)
  }
}

function bindEvents() {
  for (const button of els.heroButtons) {
    button.addEventListener('click', () => handleHeroAction(button.dataset.action || 'continue'))
  }
  if (els.quickSubmit) els.quickSubmit.addEventListener('click', handleQuickSubmit)
  if (els.quickInput) {
    els.quickInput.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleQuickSubmit()
      }
    })
  }
  if (els.wakeContinueBtn)
    els.wakeContinueBtn.addEventListener('click', () => submitWake('continue'))
  if (els.wakeSendBtn) els.wakeSendBtn.addEventListener('click', () => submitWake('command'))
  if (els.wakePromptInput) {
    els.wakePromptInput.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        submitWake('command')
      }
    })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSnapshot({ silent: true })
  })
}

function startPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer)
  state.pollTimer = window.setInterval(() => refreshSnapshot({ silent: true }), POLL_INTERVAL_MS)
}

async function init() {
  bindEvents()
  await refreshSnapshot()
  startPolling()
}

init().catch((error) => {
  console.error(error)
  setNotice(error?.message || 'dashboard 初始化失敗', 'error', 5_000)
})
