/**
 * @file Dashboard script for project status display.
 * @description This script fetches data from multiple sources, merges them,
 * and renders a dynamic dashboard. It's designed to be modular and
 * more maintainable.
 */
;(function () {
  'use strict'

  /**
   * Configuration for the dashboard application.
   */
  const config = {
    api: {
      state: 'state.json',
      currentWork: 'current-work.md',
      aiActivity: 'ai-activity.json',
      aiActivityLog: 'ai-activity-log.json',
    },
    // How often to refresh data (in milliseconds)
    refreshInterval: 30000, // 30 seconds, to be less aggressive
    // Constants for calculations
    goals: {
      today: 20,
      week: 80,
      timeline: 12,
    },
  }

  /**
   * Caches DOM elements for performance and convenience.
   */
  const DOM = {
    // Header
    healthStatus: document.getElementById('health-status'),
    refreshButton: document.getElementById('refresh-button'),
    lastUpdate: document.getElementById('last-update'),
    // Summary
    todaySummary: document.getElementById('today-summary'),
    todayProgressMeta: document.getElementById('today-progress-meta'),
    todayProgressFill: document.getElementById('today-progress-fill'),
    weekSummary: document.getElementById('week-summary'),
    weekProgressMeta: document.getElementById('week-progress-meta'),
    weekProgressFill: document.getElementById('week-progress-fill'),
    highlights: document.getElementById('highlights'),
    // Milestone
    nextMilestone: document.getElementById('next-milestone'),
    milestoneProgress: document.getElementById('milestone-progress'),
    milestoneProgressMeta: document.getElementById('milestone-progress-meta'),
    milestoneProgressFill: document.getElementById('milestone-progress-fill'),
    phaseBStatus: document.getElementById('phase-b-status'),
    // Metrics
    metricAppLines: document.getElementById('metric-app-lines'),
    metricAppChange: document.getElementById('metric-app-change'),
    metricTests: document.getElementById('metric-tests'),
    metricCompleted: document.getElementById('metric-completed'),
    metricProgress: document.getElementById('metric-progress'),
    // Main Content
    phasesContainer: document.getElementById('phases-container'),
    timelineContainer: document.getElementById('timeline-container'),
    timelineProgressMeta: document.getElementById('timeline-progress-meta'),
    timelineProgressFill: document.getElementById('timeline-progress-fill'),
    aiTeamContainer: document.getElementById('ai-team-container'),
    liveActivityContainer: document.getElementById('live-activity-container'),
    trackingStackContainer: document.getElementById('tracking-stack-container'),
    sourceMixContainer: document.getElementById('source-mix-container'),
    handoverContainer: document.getElementById('handover-container'),
  }

  /**
   * Manages the application state, including data fetching and merging.
   */
  const State = {
    isLoading: false,
    data: {},

    /**
     * Fetches all required data from the network.
     * @returns {Promise<Object>} A promise that resolves to the merged state.
     */
    async fetchData() {
      if (this.isLoading) return
      this.isLoading = true
      Render.setLoading(true)

      try {
        const cacheBust = `t=${Date.now()}`
        const responses = await Promise.all([
          fetch(`${config.api.state}?${cacheBust}`),
          fetch(`${config.api.currentWork}?${cacheBust}`),
          fetch(`${config.api.aiActivity}?${cacheBust}`),
          fetch(`${config.api.aiActivityLog}?${cacheBust}`),
        ])

        const [baseState, currentWorkMd, aiActivity, aiActivityLog] = await Promise.all(
          responses.map((res) => {
            if (!res.ok) return null // Allow partial failures
            const contentType = res.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              return res.json()
            }
            return res.text()
          })
        )

        if (!baseState) {
          throw new Error('Failed to load the base state.json. Cannot render page.')
        }

        this.data = this.mergeData(baseState, currentWorkMd, aiActivity, aiActivityLog)
        return this.data
      } catch (error) {
        console.error('Failed to load dashboard state:', error)
        Render.showError('無法載入儀表板資料。')
        return null
      } finally {
        this.isLoading = false
        Render.setLoading(false)
      }
    },

    /**
     * Merges data from different sources into a single state object.
     */
    mergeData(base, workMd, activity, activityLog) {
      // This is a simplified merge. A more robust implementation would
      // deeply merge objects.
      const merged = { ...base }

      // Example of a simple merge: update timeline from activity log
      if (activityLog && Array.isArray(activityLog.entries)) {
        merged.timeline = activityLog.entries
          .map((entry) => ({
            time: entry.time,
            ai: entry.ai,
            title: `[${entry.action}] ${entry.message}`,
            description: 'From AI Activity Log',
            impact: '',
            status: entry.status === 'working' ? 'doing' : 'done',
          }))
          .slice(0, 10)
      }

      // Update AI team status from ai-activity.json
      if (activity && Array.isArray(activity.members)) {
        merged.aiTeam.members = activity.members
        merged.aiTeam.current = activity.current
      }

      // Update last updated time
      merged.lastUpdated = new Date().toISOString()

      return merged
    },
  }

  /**
   * Handles all rendering and DOM updates.
   */
  const Render = {
    aiStatusConfig: {
      working: { class: 'working', text: '工作中' },
      idle: { class: 'idle', text: '等待中' },
    },

    /**
     * Renders the entire page based on the provided state.
     * @param {Object} state - The application state.
     */
    all(state) {
      if (!state) return

      this.updateHealth(state.health)
      this.updateHeader(state)
      this.updateSummary(state.summary)
      this.updateMetrics(state.metrics)
      this.updateMilestone(state.nextMilestone)

      this.updatePhases(state.phases)
      this.updateTimeline(state.timeline)
      this.updateAITeam(state.aiTeam)
      this.updateHandover(state.handover)

      // Hide all loaders
      document.querySelectorAll('.loading').forEach((el) => (el.style.display = 'none'))
    },

    updateHealth(health) {
      if (!health) return
      const badge = DOM.healthStatus
      const dot = badge.querySelector('.status-dot')
      const text = badge.querySelector('span:last-child')

      const isHealthy = health.overall === 'healthy'
      badge.className = `status-badge ${isHealthy ? 'healthy' : 'warning'}`
      dot.className = `status-dot ${isHealthy ? 'green' : 'yellow'}`
      text.textContent = isHealthy ? '系統正常' : '系統注意'
    },

    updateHeader(state) {
      DOM.lastUpdate.textContent = `最後更新：${new Date(state.lastUpdated).toLocaleString('zh-TW')}`
    },

    updateSummary(summary) {
      if (!summary) return
      DOM.todaySummary.textContent = summary.today
      DOM.weekSummary.textContent = summary.thisWeek
      DOM.highlights.innerHTML = summary.highlights.map((h) => `<li>${h}</li>`).join('')
    },

    updateMetrics(metrics) {
      if (!metrics) return
      this.setText(DOM.metricAppLines, metrics.appJsxLines)
      this.setText(DOM.metricTests, metrics.testCases)
      this.setText(DOM.metricCompleted, metrics.completedTasks)
      this.setText(DOM.metricProgress, metrics.inProgressTasks)

      const change = metrics.appJsxLinesChange
      DOM.metricAppChange.className = `metric-change ${change > 0 ? 'positive' : 'negative'}`
      this.setText(DOM.metricAppChange, `${change > 0 ? '+' : ''}${change} 行`)
    },

    updateMilestone(milestone) {
      if (!milestone) return
      this.setText(DOM.nextMilestone, milestone.name)
      this.setText(
        DOM.milestoneProgress,
        `進度：${milestone.progress}% | 預計：${milestone.estimatedComplete}`
      )
    },

    updatePhases(phases = {}) {
      DOM.phasesContainer.innerHTML = Object.values(phases)
        .map((p) => this.getPhaseHtml(p))
        .join('')
    },

    updateTimeline(timeline = []) {
      DOM.timelineContainer.innerHTML = timeline.map((t) => this.getTimelineItemHtml(t)).join('')
    },

    updateAITeam(aiTeam = {}) {
      const members = aiTeam.members || []
      DOM.aiTeamContainer.innerHTML = members
        .map((m) => this.getAiMemberHtml(m, aiTeam.current))
        .join('')
    },

    updateHandover(handover = {}) {
      DOM.handoverContainer.innerHTML = this.getHandoverHtml(handover)
    },

    // HTML template generators
    getPhaseHtml(phase) {
      const tasksHtml = (phase.tasks || [])
        .map((t) => `<span class="task-badge">${t.name}</span>`)
        .join('')
      return `<div class="progress-item">
                <div class="progress-header">
                    <span class="progress-name">${phase.name}</span>
                    <span class="progress-percent">${phase.progress}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${phase.progress}%"></div></div>
                <div class="progress-tasks">${tasksHtml}</div>
            </div>`
    },

    getTimelineItemHtml(item) {
      return `<div class="timeline-item ${item.status}">
                <div class="timeline-time">${item.time}</div>
                <div class="timeline-title">${item.title}<span class="timeline-ai">${item.ai}</span></div>
            </div>`
    },

    getAiMemberHtml(member, currentAi) {
      const isCurrent = member.name === currentAi
      const status = this.aiStatusConfig[member.status] || this.aiStatusConfig.idle
      return `<div class="ai-member ${isCurrent ? 'current' : ''}">
                <div class="ai-avatar">${member.avatar}</div>
                <div class="ai-info">
                    <div class="ai-name">${member.name} ${isCurrent ? '(當前)' : ''}</div>
                    <div class="ai-role">${member.role}</div>
                    <span class="ai-status ${status.class}">${status.text}</span>
                </div>
                <div class="ai-stats">
                    <div>${member.tasksCompleted} tasks</div>
                    <div>${member.lastActive}</div>
                </div>
            </div>`
    },

    getHandoverHtml(handover) {
      return `<div class="handover-card">
                <div class="handover-from">來自 ${handover.from || 'N/A'}</div>
                <div class="handover-message">${handover.message || '...'}</div>
            </div>`
    },

    /**
     * Safely sets the text content of a DOM element.
     */
    setText(element, text) {
      if (element) {
        element.textContent = text ?? 'N/A'
      }
    },

    /**
     * Toggles the loading state visuals.
     */
    setLoading(isLoading) {
      if (DOM.refreshButton) {
        DOM.refreshButton.disabled = isLoading
        DOM.refreshButton.textContent = isLoading ? '刷新中...' : '立即刷新'
      }
    },

    /**
     * Shows an error message on the page.
     */
    showError(message) {
      const container = document.querySelector('.container')
      if (container) {
        container.innerHTML = `<div class="error-message">${message}</div>`
      }
    },
  }

  /**
   * Main application controller.
   */
  const App = {
    init() {
      DOM.refreshButton?.addEventListener('click', () => this.load())
      this.load() // Initial load

      // Set up auto-refresh if needed, but a manual button is often better UX
      // setInterval(() => this.load(), config.refreshInterval);
    },
    async load() {
      const data = await State.fetchData()
      Render.all(data)
    },
  }

  // Run the application
  App.init()
})()
