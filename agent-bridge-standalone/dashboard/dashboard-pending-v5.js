function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatTime(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function normalizePayload(value) {
  const payload = value && typeof value === 'object' ? value : {}
  return {
    decisions: Array.isArray(payload.decisions) ? payload.decisions : [],
    summary:
      payload.summary && typeof payload.summary === 'object'
        ? payload.summary
        : { pendingCount: 0, nextExpectedDecisionAt: '' },
  }
}

export function createPendingDecisionsController({ apiFetch }) {
  const els = {
    count: document.querySelector('[data-pending-count]'),
    list: document.querySelector('[data-pending-list]'),
    empty: document.querySelector('[data-pending-empty]'),
    emptyHint: document.querySelector('[data-pending-empty-hint]'),
    toast: document.querySelector('[data-pending-toast]'),
  }

  let payload = normalizePayload(null)
  let toastTimer = null
  const answeringIds = new Set()

  function showToast(message) {
    if (!els.toast) return
    els.toast.textContent = message
    els.toast.hidden = false
    els.toast.classList.add('is-visible')
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('is-visible')
      window.setTimeout(() => {
        if (els.toast) els.toast.hidden = true
      }, 180)
    }, 2000)
  }

  function renderCount() {
    if (!els.count) return
    const count = Number(payload.summary?.pendingCount) || payload.decisions.length || 0
    els.count.textContent = `${count} 題待回`
  }

  function renderEmptyState() {
    if (!els.empty || !els.emptyHint) return
    const hasDecisions = payload.decisions.length > 0
    els.empty.hidden = hasDecisions
    els.emptyHint.textContent = payload.summary?.nextExpectedDecisionAt
      ? `下一次問你：${payload.summary.nextExpectedDecisionAt}`
      : '下一次問你：L8 signoff 前 · 預計 3 天後'
  }

  function renderDecisionCard(decision) {
    const askedBy = String(decision?.askedBy || 'codex')
      .trim()
      .toUpperCase()
    const meta = `${askedBy} · ${formatTime(decision?.createdAt)}`
    const context = String(decision?.context || '').trim()
    const question = String(decision?.question || '').trim() || '待你決定'
    const recommendation = String(decision?.recommendation || '')
      .trim()
      .toUpperCase()
    const recommendationReason = String(decision?.recommendationReason || '').trim()
    const options = Array.isArray(decision?.options) ? decision.options : []
    const isBusy = answeringIds.has(decision.id)
    const recommendationCopy =
      recommendation && recommendationReason
        ? `建議 ${recommendation} · ${recommendationReason}`
        : recommendation
          ? `建議 ${recommendation}`
          : ''

    return [
      `<article class="pending-card" data-pending-card data-decision-id="${escapeHtml(decision.id)}">`,
      '<div class="pending-meta">',
      `<span class="pending-asked-by">${escapeHtml(meta)}</span>`,
      context ? `<span class="pending-context">${escapeHtml(context)}</span>` : '',
      '</div>',
      `<h3 class="pending-question">${escapeHtml(question)}</h3>`,
      recommendationCopy
        ? `<p class="pending-reco hint-zh">${escapeHtml(recommendationCopy)}</p>`
        : '',
      '<div class="pending-options">',
      options
        .map((option) => {
          const key = String(option?.key || '')
            .trim()
            .toUpperCase()
          const label = String(option?.label || '').trim()
          const classNames = ['pending-option']
          if (key && key === recommendation) classNames.push('is-recommended')
          if (isBusy) classNames.push('is-busy')
          return [
            `<button class="${classNames.join(' ')}" data-pending-answer="${escapeHtml(key)}" type="button" ${isBusy ? 'disabled' : ''}>`,
            `<span class="option-key">${escapeHtml(key)}</span>`,
            `<span class="option-label">${escapeHtml(label)}</span>`,
            '</button>',
          ].join('')
        })
        .join(''),
      '</div>',
      '</article>',
    ].join('')
  }

  function renderList() {
    if (!els.list) return
    if (!payload.decisions.length) {
      els.list.innerHTML = ''
      return
    }
    els.list.innerHTML = payload.decisions.map(renderDecisionCard).join('')
  }

  function render() {
    renderCount()
    renderList()
    renderEmptyState()
  }

  async function answerDecision(id, answer) {
    const snapshot = normalizePayload(payload)
    answeringIds.add(id)
    render()
    payload = {
      ...snapshot,
      decisions: snapshot.decisions.filter((decision) => decision.id !== id),
      summary: {
        ...snapshot.summary,
        pendingCount: Math.max(
          0,
          (Number(snapshot.summary?.pendingCount) || snapshot.decisions.length) - 1
        ),
      },
    }
    render()

    try {
      const response = await apiFetch(`/api/pending-decisions/${encodeURIComponent(id)}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || '送出失敗')
      showToast(`已回 ${answer}`)
    } catch (error) {
      payload = snapshot
      showToast(error?.message || '送出失敗')
      render()
    } finally {
      answeringIds.delete(id)
      render()
    }
  }

  function bindEvents() {
    if (!els.list) return
    els.list.addEventListener('click', (event) => {
      const button =
        event.target instanceof Element ? event.target.closest('[data-pending-answer]') : null
      if (!(button instanceof HTMLButtonElement)) return
      const card = button.closest('[data-decision-id]')
      const answer = String(button.dataset.pendingAnswer || '')
        .trim()
        .toUpperCase()
      const id = String(card?.getAttribute('data-decision-id') || '').trim()
      if (!id || !answer || answeringIds.has(id)) return
      answerDecision(id, answer).catch((error) => console.error(error))
    })
  }

  bindEvents()

  return {
    setPayload(nextPayload) {
      payload = normalizePayload(nextPayload)
      render()
    },
  }
}
