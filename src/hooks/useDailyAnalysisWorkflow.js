import { useCallback } from 'react'
import { OWNER_PORTFOLIO_ID, REPORT_REFRESH_DAILY_LIMIT } from '../constants.js'
import { APP_STATUS_MESSAGES } from '../lib/appMessages.js'
import { requestAnalyzeWithFallback } from '../lib/analyzeRequest.js'
import { fetchStockDossierData as defaultFetchStockDossierData } from '../lib/dataAdapters/finmindAdapter.js'
import { buildHoldingCoverageContext } from '../lib/dossierUtils.js'
import {
  hydrateDossiersWithFinMind,
  summarizeFinMindDailyConfirmation,
} from '../lib/finmindPromptRuntime.js'
import { collectInjectedKnowledgeIdsFromDossiers } from '../lib/knowledgeBase.js'
import {
  buildAnalysisDossiers,
  buildBlindPredictionBlock,
  buildBlindPredictionRequest,
  buildDailyAnalysisRequest,
  buildDailyChanges,
  buildDailyEventCollections,
  buildDailyReport,
  buildFallbackBrainUpdateRequest,
  buildMarketContextFromIndexData,
  buildPreviousPredictionReviewBlock,
  calculatePredictionScores,
  extractDailyBrainUpdate,
  extractDailyEventAssessments,
  stripDailyAnalysisEmbeddedBlocks,
  buildTaiwanMarketSignals,
  formatTaiwanMarketSignals,
  formatHistoricalAnalogsForPrompt,
} from '../lib/dailyAnalysisRuntime.js'
import {
  selectAnalysisFramework,
  formatFrameworkSections,
  formatReliabilityContext,
  getBacktestReliability,
} from '../lib/analysisFramework.js'
import { formatPersonaContext, selectPersona, scoreByPersona } from '../lib/personaEngine.js'
import { readEventStream } from '../lib/eventStream.js'
import {
  buildBudgetedBrainContext,
  buildBudgetedCoverageContext,
  buildBudgetedHoldingSummary,
  formatRecentLessons,
} from '../lib/promptBudget.js'
import { findHistoricalAnalogs } from '../lib/brainRuntime.js'
import { logAnalysisObservation } from '../lib/knowledgeEvolutionRuntime.js'
import { normalizeAnalysisHistoryEntries, normalizeDailyReportEntry } from '../lib/reportUtils.js'

async function consumeStreamingAnalyzeResponse(
  response,
  { onDelta = () => {}, onMeta = () => {} } = {}
) {
  let fullText = ''

  await readEventStream(response, {
    onEvent: async (event, payload) => {
      if (event === 'meta') {
        onMeta(payload)
        return
      }

      if (event === 'delta') {
        const text = String(payload?.text || '')
        if (!text) return
        fullText += text
        onDelta(fullText, text)
        return
      }

      if (event === 'done') {
        const text = String(payload?.text || '')
        if (text && text.length >= fullText.length) {
          fullText = text
        }
        return
      }

      if (event === 'error') {
        throw new Error(payload?.detail || payload?.error || 'AI 串流分析失敗')
      }
    },
  })

  return fullText || null
}

function hasMeaningfulBrainUpdate(brainUpdate) {
  if (!brainUpdate || typeof brainUpdate !== 'object' || Array.isArray(brainUpdate)) return false

  return Object.values(brainUpdate).some((value) => {
    if (Array.isArray(value)) return value.length > 0
    if (value && typeof value === 'object') return Object.keys(value).length > 0
    if (typeof value === 'string') return value.trim().length > 0
    return value != null
  })
}

function normalizeReportDateKey(value = '') {
  return String(value || '').trim().replace(/-/g, '/')
}

export function useDailyAnalysisWorkflow({
  analyzing = false,
  setAnalyzing = () => {},
  setAnalyzeStep = () => {},
  holdings = [],
  losers = [],
  newsEvents = [],
  defaultNewsEvents = [],
  analysisHistory = [],
  strategyBrain = null,
  portfolioNotes = {},
  reversalConditions = {},
  reportRefreshMeta = {},
  todayRefreshKey = '',
  dossierByCode = new Map(),
  fetchStockDossierData = defaultFetchStockDossierData,
  hydrateDossierFinMind = hydrateDossiersWithFinMind,
  activePortfolioId = OWNER_PORTFOLIO_ID,
  canUseCloud = false,
  getMarketQuotesForCodes = async () => ({}),
  resolveHoldingPrice = () => 0,
  getHoldingUnrealizedPnl = () => 0,
  getHoldingReturnPct = () => 0,
  buildDailyHoldingDossierContext = () => '',
  formatPortfolioNotesContext = () => '',
  formatBrainChecklistsForPrompt = () => '',
  formatBrainRulesForValidationPrompt = () => '',
  normalizeStrategyBrain = (value) => value,
  createEmptyBrainAudit = () => ({ validatedRules: [], staleRules: [], invalidatedRules: [] }),
  ensureBrainAuditCoverage = (brainAudit) => brainAudit,
  enforceTaiwanHardGatesOnBrainAudit = (brainAudit) => brainAudit,
  mergeBrainWithAuditLifecycle = (_rawBrain, currentBrain) => currentBrain,
  appendBrainValidationCases = (prev) => prev,
  normalizeHoldings = (rows) => rows,
  isClosedEvent = () => false,
  toSlashDate = () => new Date().toLocaleDateString('zh-TW'),
  setDailyReport = () => {},
  setAnalysisHistory = () => {},
  setStrategyBrain = () => {},
  setBrainValidation = () => {},
  setHoldings = () => {},
  setLastUpdate = () => {},
  setSaved = () => {},
  notifySaved = null,
  refreshAnalystReportsRef = { current: async () => false },
}) {
  const emitSaved = useCallback(
    (message, timeout) => {
      if (typeof notifySaved === 'function') {
        notifySaved(message, timeout)
        return
      }
      setSaved(message)
      if (timeout != null) {
        setTimeout(() => setSaved(''), timeout)
      }
    },
    [notifySaved, setSaved]
  )

  const runDailyAnalysis = useCallback(async () => {
    if (analyzing) return
    setAnalyzing(true)
    setAnalyzeStep(APP_STATUS_MESSAGES.dailyLoadingMarketCache)

    try {
      const codes = holdings.map((holding) => holding.code)
      const priceMap = await getMarketQuotesForCodes(codes)
      const changes = buildDailyChanges({
        holdings,
        priceMap,
        resolveHoldingPrice,
        getHoldingUnrealizedPnl,
        getHoldingReturnPct,
      })

      const totalTodayPnl = changes.reduce((sum, change) => sum + change.todayPnl, 0)

      let marketContext = ''
      try {
        const indexResponse = await fetch('/api/twse?ex_ch=tse_t00.tw|tse_t01.tw')
        const indexData = await indexResponse.json()
        marketContext = buildMarketContextFromIndexData(indexData)
      } catch (indexError) {
        console.warn('大盤指數取得失敗（不影響分析）:', indexError)
      }

      const today = toSlashDate()
      const todayMarketDate = String(today || '').replace(/\//g, '-')
      const existingTodayReport = (Array.isArray(analysisHistory) ? analysisHistory : []).find(
        (entry) => normalizeReportDateKey(entry?.date) === normalizeReportDateKey(today)
      )
      const shouldForceFreshFinMind = Boolean(
        existingTodayReport && existingTodayReport.analysisStage !== 't1-confirmed'
      )
      const { pendingEvents, eventCorrelations, anomalies, needsReview } =
        buildDailyEventCollections({
          newsEvents,
          defaultNewsEvents,
          isClosedEvent,
          changes,
          today,
        })

      setAnalyzeStep(APP_STATUS_MESSAGES.dailyAiAnalysis)
      let aiInsight = null
      let aiError = null
      let eventAssessments = []
      let brainAudit = createEmptyBrainAudit()
      let brainUpdatedInline = false
      let finalBrainForValidation = normalizeStrategyBrain(strategyBrain, { allowEmpty: true })
      let analysisDossiers = []
      let injectedKnowledgeIds = []
      let blindPredictions = []
      let finmindDataCount = 0
      let finmindConfirmation = null
      let analysisStage = 't0-preliminary'
      let analysisStageLabel = '收盤快版'
      const analysisVersion = existingTodayReport ? (existingTodayReport.analysisVersion || 1) + 1 : 1
      let rerunReason = existingTodayReport ? 'manual-rerun' : null

      try {
        let promptDossierByCode = dossierByCode
        const promptCodes = changes.map((item) => item.code)

        if (promptCodes.length > 0) {
          try {
            const hydrated = await hydrateDossierFinMind({
              codes: promptCodes,
              dossierByCode,
              fetchStockDossierData,
              fetchOptions: shouldForceFreshFinMind ? { forceFresh: true } : {},
              contextLabel: 'daily-analysis',
            })
            if (hydrated?.dossierByCode instanceof Map) {
              promptDossierByCode = hydrated.dossierByCode
            }
          } catch (finmindError) {
            console.warn(
              '收盤分析 FinMind prompt hydration 失敗（改用既有 dossier）:',
              finmindError
            )
          }
        }

        const dailyDossiers = buildAnalysisDossiers({ changes, dossierByCode: promptDossierByCode })
        analysisDossiers = dailyDossiers
        injectedKnowledgeIds = collectInjectedKnowledgeIdsFromDossiers(dailyDossiers)
        finmindConfirmation = summarizeFinMindDailyConfirmation(dailyDossiers, todayMarketDate)
        const isFinmindConfirmed =
          finmindConfirmation.totalDatasets > 0 &&
          finmindConfirmation.confirmedDatasets === finmindConfirmation.totalDatasets
        analysisStage = isFinmindConfirmed ? 't1-confirmed' : 't0-preliminary'
        analysisStageLabel = isFinmindConfirmed ? '資料確認版' : '收盤快版'
        rerunReason = !existingTodayReport
          ? null
          : isFinmindConfirmed && existingTodayReport.analysisStage === 't0-preliminary'
            ? 'finmind-confirmed'
            : 'manual-rerun'

        // Calculate FinMind data count across all dossiers
        finmindDataCount = dailyDossiers.reduce((sum, dossier) => {
          const finmind = dossier?.finmind
          if (!finmind) return sum
          let count = 0
          if (Array.isArray(finmind.institutional)) count += finmind.institutional.length
          if (Array.isArray(finmind.valuation)) count += finmind.valuation.length
          if (Array.isArray(finmind.margin)) count += finmind.margin.length
          if (Array.isArray(finmind.revenue)) count += finmind.revenue.length
          if (Array.isArray(finmind.balanceSheet)) count += finmind.balanceSheet.length
          if (Array.isArray(finmind.cashFlow)) count += finmind.cashFlow.length
          if (Array.isArray(finmind.shareholding)) count += finmind.shareholding.length
          return sum + count
        }, 0)

        // ── 分群提速：高可信度股票走量化快掃，不送 AI ──
        const highTierQuickScan = []
        const aiAnalysisDossiers = []

        dailyDossiers.forEach((dossier) => {
          const change = changes.find((item) => item.code === dossier.code)
          const reliability = getBacktestReliability(dossier.code)
          const persona = selectPersona(dossier?.stockMeta || dossier?.meta || {})

          if (reliability.tier === 'high') {
            // 高可信度：量化打分，不送 AI
            const fm = dossier?.finmind || {}
            const latestRevenue = fm.revenue?.[0]
            const latestValuation = fm.valuation?.[0]
            const latestBalance = fm.balanceSheet?.[0]
            const institutional5d = (fm.institutional || []).slice(0, 5)
            const foreignSum = institutional5d.reduce((s, d) => s + (d.foreign || 0), 0)
            const trustSum = institutional5d.reduce((s, d) => s + (d.investment || 0), 0)
            const marginArr = fm.margin || []
            const marginDelta =
              marginArr.length > 1
                ? (marginArr[0]?.marginBalance || 0) - (marginArr[1]?.marginBalance || 0)
                : 0

            const signals = {
              changePct: change?.changePct || 0,
              price: change?.price || dossier?.position?.price || 0,
              cost: dossier?.position?.cost || 0,
              qty: dossier?.position?.qty || 0,
              todayPnl: change?.todayPnl || 0,
              // FinMind 營收
              revenueYoY: Number(latestRevenue?.revenueYoY) || 0,
              revenueMoM: Number(latestRevenue?.revenueMoM) || 0,
              // 法人
              foreignBuy: foreignSum,
              trustBuy: trustSum,
              foreignShort5d: foreignSum,
              institutionalStreakDays:
                foreignSum > 0
                  ? institutional5d.length
                  : foreignSum < 0
                    ? -institutional5d.length
                    : 0,
              // 估值
              per: Number(latestValuation?.per) || 0,
              pbr: Number(latestValuation?.pbr) || 0,
              // 融資
              marginDelta,
              priceChange: change?.changePct || 0,
              // 財務
              debtRatio: Number(latestBalance?.debtRatio) || 0,
              roe: Number(latestBalance?.roe) || 0,
            }
            const result = scoreByPersona(persona, signals)
            highTierQuickScan.push({
              code: dossier.code,
              name: dossier.name,
              persona: persona.label,
              reliability: reliability.rate,
              score: result.score,
              verdict: result.verdict,
              reasons: result.reasons,
            })
          } else {
            // 中低可信度：送 AI 深度分析
            aiAnalysisDossiers.push(dossier)
          }
        })

        const holdingPromptEntries = aiAnalysisDossiers.map((dossier) => {
          const change = changes.find((item) => item.code === dossier.code)
          return {
            key: dossier.code,
            code: dossier.code,
            name: dossier.name,
            weight:
              Number(dossier?.position?.value) ||
              Number(change?.price || dossier?.position?.price || 0) *
                Number(dossier?.position?.qty || 0),
            text: buildDailyHoldingDossierContext(dossier, change, { compact: true }),
          }
        })
        const holdingSummaryBudget =
          holdingPromptEntries.length > 0
            ? buildBudgetedHoldingSummary(holdingPromptEntries, {
                maxChars: 2200,
                maxEntries: 5,
              })
            : { text: '目前沒有持股 dossier。', retainedKeys: [] }
        const holdingSummary = holdingSummaryBudget.text
        const retainedCoverageEntries = aiAnalysisDossiers
          .filter(
            (dossier) =>
              holdingPromptEntries.length > 0 &&
              holdingSummaryBudget.retainedKeys.includes(dossier.code)
          )
          .map((dossier) => {
            const change = changes.find((item) => item.code === dossier.code)
            return {
              key: dossier.code,
              code: dossier.code,
              name: dossier.name,
              weight:
                Number(dossier?.position?.value) ||
                Number(change?.price || dossier?.position?.price || 0) *
                  Number(dossier?.position?.qty || 0),
              text: buildHoldingCoverageContext(dossier),
            }
          })
          .filter((entry) => entry.text)
        const coverageContext =
          retainedCoverageEntries.length > 0
            ? buildBudgetedCoverageContext(retainedCoverageEntries, {
                maxChars: 700,
                maxEntries: 4,
              }).text
            : ''

        // 合併手動事件 + 自動事件，注入知識引擎預測
        const allEvents = [
          ...pendingEvents.map((event) => {
            const predLabel = event.pred === 'up' ? '看漲' : event.pred === 'down' ? '看跌' : '中性'
            const predSource = event.predSource === 'knowledge-engine' ? '（知識引擎）' : ''
            const predReasons = (event.predReasons || []).join('、')
            return `[eventId:${event.id}] [${event.date}] ${event.title} — 預測:${predLabel}${predSource} ${predReasons ? '因為:' + predReasons : ''} — 狀態:${event.status}`
          }),
          ...(newsEvents || defaultNewsEvents || []).slice(0, 10).map((event) => {
            const predLabel =
              event.pred === 'up'
                ? '看漲'
                : event.pred === 'down'
                  ? '看跌'
                  : event.pred === 'flat'
                    ? '持平'
                    : ''
            return `[auto] [${event.date || ''}] ${event.title || event.type || ''} — 來源:${event.source || 'auto'} ${predLabel ? '— 知識引擎預測:' + predLabel : ''}`
          }),
        ]
        const eventSummary = allEvents.join('\n')

        const anomalySummary =
          anomalies.length > 0
            ? anomalies
                .map(
                  (item) =>
                    `${item.name} ${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
                )
                .join(', ')
            : '無'

        const brain = strategyBrain
        const notesContext = formatPortfolioNotesContext(portfolioNotes)
        const coachContext =
          activePortfolioId === OWNER_PORTFOLIO_ID && (brain?.coachLessons || []).length > 0
            ? `
跨組合教練教訓：
${brain.coachLessons
  .slice(-5)
  .map((item) => `- [${item.date}] ${item.source || item.sourcePortfolioId}：${item.text}`)
  .join('\n')}
`
            : ''
        const userRules = (brain?.rules || []).filter((rule) => rule?.source === 'user')
        const aiRules = (brain?.rules || []).filter((rule) => rule?.source !== 'user')
        const candidateRules = brain?.candidateRules || []
        const checklistText = formatBrainChecklistsForPrompt(brain?.checklists)

        const fullBrainContext = brain
          ? `
══ 策略大腦（累積知識庫）══
${
  userRules.length > 0
    ? `✅ 已驗證規則（用戶確認）：
${formatBrainRulesForValidationPrompt(userRules, { limit: 8 })}

`
    : ''
}🤖 核心規則（AI/系統整理）：
${formatBrainRulesForValidationPrompt(aiRules, { limit: 10 })}

🧪 候選規則（需持續驗證）：
${formatBrainRulesForValidationPrompt(candidateRules, { limit: 6 })}

📋 決策檢查表：
${checklistText}

⚠️ 今日任務不是盲目沿用規則，而是先驗證這些規則今天是否仍成立；只有當現有規則無法解釋今日表現時，才新增少量候選規則。
⚠️ 注意：AI 建議規則可能存在確認偏差，不要因為「策略大腦這樣說」就不加質疑地套用。
⚠️ 驗證規則時，要盡量對照過往台股相似案例；若結果失準，需分清楚是規則失準，還是個股 / 流動性 / 市場節奏差異。

歷史教訓：
${(brain.lessons || [])
  .slice(-10)
  .map((lesson) => `- [${lesson.date}] ${lesson.text}`)
  .join('\n')}

勝率統計：${brain.stats?.hitRate || '尚無'}
常犯錯誤：${(brain.commonMistakes || []).join('、') || '尚無'}
${coachContext}
══════════════════════════`
          : ''
        const brainContext = brain
          ? buildBudgetedBrainContext({
              fullText: fullBrainContext,
              userRulesText: formatBrainRulesForValidationPrompt(userRules, { limit: 6 }),
              recentLessonsText: formatRecentLessons(brain.lessons || [], { limit: 3 }),
              maxChars: 1000,
            }).text
          : ''

        const revContext =
          losers.length > 0
            ? `
反轉追蹤持股：
${losers
  .map((holding) => {
    const reversal = (reversalConditions || {})[holding.code]
    return `${holding.name}(${holding.code}) ${getHoldingReturnPct(holding).toFixed(2)}% | 反轉條件：${reversal?.signal || '未設定'} | 停損：${reversal?.stopLoss || '未設定'}`
  })
  .join('\n')}`
            : ''

        setAnalyzeStep(APP_STATUS_MESSAGES.dailyBlindPrediction)
        const blindHoldingSummary =
          holdingPromptEntries.length > 0
            ? buildBudgetedHoldingSummary(
                dailyDossiers.map((dossier) => {
                  const change = changes.find((item) => item.code === dossier.code)
                  return {
                    key: dossier.code,
                    code: dossier.code,
                    name: dossier.name,
                    weight:
                      Number(dossier?.position?.value) ||
                      Number(change?.price || dossier?.position?.price || 0) *
                        Number(dossier?.position?.qty || 0),
                    text: buildDailyHoldingDossierContext(dossier, change, {
                      blind: true,
                      compact: true,
                    }),
                  }
                }),
                {
                  maxChars: 1800,
                  maxEntries: 5,
                }
              ).text
            : '目前沒有持股 dossier。'

        blindPredictions = []
        try {
          const blindResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              buildBlindPredictionRequest({
                today,
                notesContext,
                brainContext,
                blindHoldingSummary,
                eventSummary,
              })
            ),
          })
          const blindData = await blindResponse.json()
          const blindText = blindData.content?.[0]?.text || ''
          const jsonMatch =
            blindText.match(/```json\s*([\s\S]*?)```/) || blindText.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
            if (Array.isArray(parsed)) blindPredictions = parsed
          }
        } catch (blindError) {
          console.warn('盲測預測失敗（不影響主分析）:', blindError)
        }

        const prevReport = (analysisHistory || [])[0]
        const prevReviewBlock = buildPreviousPredictionReviewBlock(prevReport)
        const blindPredBlock = buildBlindPredictionBlock(blindPredictions)

        setAnalyzeStep(APP_STATUS_MESSAGES.dailyAiAnalysis)
        const historicalEvents = (newsEvents || defaultNewsEvents).filter(isClosedEvent)
        const hits = historicalEvents.filter((event) => event.correct === true).length
        const total = historicalEvents.filter((event) => event.correct !== null).length
        const streamPreviewBase = {
          id: Date.now(),
          date: today,
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          totalTodayPnl,
          changes,
          anomalies,
          eventCorrelations,
          needsReview,
          blindPredictions,
          injectedKnowledgeIds,
          finmindDataCount,
          analysisStage,
          analysisStageLabel,
          analysisVersion,
          rerunReason,
          finmindConfirmation,
        }
        const taiwanMarketSignals = buildTaiwanMarketSignals({
          holdings,
          dossiers: analysisDossiers,
          newsEvents: newsEvents || defaultNewsEvents,
          today,
        })
        const historicalAnalogs = Object.fromEntries(
          analysisDossiers.map((dossier) => [
            dossier.code,
            findHistoricalAnalogs(
              { code: dossier.code, name: dossier.name, sector: dossier?.meta?.industry },
              {
                eventType: (dossier?.events?.pending || [])[0]?.type || '',
                title: (dossier?.events?.pending || [])[0]?.title || dossier?.thesis?.summary || '',
                thesis: dossier?.thesis?.summary || '',
                summary: `${dossier?.meta?.strategy || ''} ${dossier?.meta?.industry || ''}`,
              }
            ),
          ])
        )

        // 為每檔持股選分析框架，組成整體 context
        const frameworksByStock = analysisDossiers.map((dossier) => {
          const meta = dossier?.meta || dossier?.stockMeta || {}
          const stockEvents = (dossier?.events?.pending || []).concat(
            dossier?.events?.tracking || []
          )
          const framework = selectAnalysisFramework(meta, dossier, stockEvents)
          return { code: dossier.code, name: dossier.name, framework }
        })
        const analysisFrameworkContext = [
          frameworksByStock
            .map(
              ({ code, name, framework }) =>
                `${code} ${name}：${framework.mode}（${framework.reason}）\n${formatFrameworkSections(framework, {})}`
            )
            .join('\n\n'),
          '',
          formatReliabilityContext(analysisDossiers),
          '',
          formatPersonaContext(analysisDossiers),
        ].join('\n')

        const analysisRequestBody = buildDailyAnalysisRequest({
          today,
          prevReviewBlock,
          blindPredBlock,
          totalTodayPnl,
          marketContext,
          notesContext,
          brainContext,
          revContext,
          holdingSummary,
          coverageContext,
          anomalySummary,
          eventSummary,
          blindPredictions,
          predictionHitRate: `${hits}/${total}`,
          taiwanMarketSignals: formatTaiwanMarketSignals(taiwanMarketSignals),
          historicalAnalogs: formatHistoricalAnalogsForPrompt(historicalAnalogs),
          analysisFrameworkContext,
        })

        const { rawText: rawInsight } = await requestAnalyzeWithFallback({
          requestBody: analysisRequestBody,
          consumeStream: consumeStreamingAnalyzeResponse,
          onMeta: () => {
            setAnalyzeStep(APP_STATUS_MESSAGES.dailyAiStreaming)
          },
          onDelta: (fullText) => {
            setDailyReport(
              normalizeDailyReportEntry({
                ...streamPreviewBase,
                aiInsight: stripDailyAnalysisEmbeddedBlocks(fullText),
                aiError: null,
                eventAssessments: [],
                brainAudit: null,
              })
            )
          },
          onFallback: (streamError) => {
            console.warn('收盤分析串流失敗，改走非串流 fallback:', streamError)
            setAnalyzeStep('AI 串流失敗，切換一般模式重試...')
          },
        })
        setAnalyzeStep(APP_STATUS_MESSAGES.dailyAiPostProcess)

        if (!rawInsight) {
          aiError = 'AI 有回應，但沒有產出可顯示的文字內容'
        } else {
          const displayText = rawInsight
          eventAssessments = extractDailyEventAssessments(displayText)

          const brainJson = extractDailyBrainUpdate(displayText)
          if (hasMeaningfulBrainUpdate(brainJson)) {
            brainAudit = ensureBrainAuditCoverage(brainJson, strategyBrain)
            brainAudit = enforceTaiwanHardGatesOnBrainAudit(brainAudit, strategyBrain, {
              dossiers: analysisDossiers,
              defaultLastValidatedAt: today,
            })
            const newBrain = mergeBrainWithAuditLifecycle(brainJson, strategyBrain, brainAudit)
            finalBrainForValidation = newBrain
            setStrategyBrain(newBrain)
            brainUpdatedInline = true
          }

          aiInsight = stripDailyAnalysisEmbeddedBlocks(displayText)
        }

        // 附加量化快掃結果（高可信度股票不送 AI，直接打分）
        if (highTierQuickScan.length > 0) {
          const quickScanText = highTierQuickScan
            .map(
              (item) =>
                `**${item.code} ${item.name}**（${item.persona}，回測準確度 ${item.reliability}%）\n` +
                `- 判定：${item.verdict}（分數 ${item.score}）\n` +
                `- 依據：${item.reasons.join('、') || '無特殊訊號'}`
            )
            .join('\n\n')
          aiInsight =
            (aiInsight || '') +
            '\n\n---\n\n## 📊 量化快掃（高可信度持股，不經 AI）\n\n' +
            quickScanText
        }
      } catch (analysisError) {
        aiError = analysisError?.message || 'AI 分析失敗'
      }

      const predictionScores = calculatePredictionScores(blindPredictions, changes)
      const report = buildDailyReport({
        today,
        totalTodayPnl,
        changes,
        anomalies,
        eventCorrelations,
        needsReview,
        aiInsight,
        aiError,
        eventAssessments,
        blindPredictions,
        predictionScores,
        brainAudit,
        injectedKnowledgeIds,
        finmindDataCount,
        analysisStage,
        analysisStageLabel,
        analysisVersion,
        rerunReason,
        finmindConfirmation,
      })

      setDailyReport(normalizeDailyReportEntry(report))
      setAnalysisHistory((prev) => normalizeAnalysisHistoryEntries([report, ...(prev || [])]))
      ;(analysisDossiers || []).forEach((dossier) => {
        logAnalysisObservation({
          ruleIds: injectedKnowledgeIds,
          stockCode: dossier?.code,
          date: today,
          outcome: aiError ? 'negative' : 'positive',
          evidenceRefs: Array.isArray(dossier?.events) ? dossier.events.slice(0, 3) : [],
        })
      })

      if (canUseCloud) {
        fetch('/api/brain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-analysis', data: report }),
        }).catch(() => {})
      }

      if (aiInsight && !brainUpdatedInline) {
        setAnalyzeStep('策略大腦進化中（fallback）...')
        try {
          const historicalEvents = (newsEvents || defaultNewsEvents).filter(isClosedEvent)
          const hits = historicalEvents.filter((event) => event.correct === true).length
          const total = historicalEvents.filter((event) => event.correct !== null).length

          const brainResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              buildFallbackBrainUpdateRequest({
                aiInsight,
                strategyBrain,
                hits,
                total,
                totalTodayPnl,
              })
            ),
          })
          const brainData = await brainResponse.json()
          const brainText = brainData.content?.[0]?.text || ''
          const cleanBrain = brainText.replace(/```json|```/g, '').trim()
          const rawBrain = JSON.parse(cleanBrain)
          brainAudit = ensureBrainAuditCoverage(rawBrain, strategyBrain)
          brainAudit = enforceTaiwanHardGatesOnBrainAudit(brainAudit, strategyBrain, {
            dossiers: analysisDossiers,
            defaultLastValidatedAt: today,
          })
          const newBrain = mergeBrainWithAuditLifecycle(rawBrain, strategyBrain, brainAudit)
          finalBrainForValidation = newBrain
          setStrategyBrain(newBrain)
          setDailyReport((prev) =>
            prev ? normalizeDailyReportEntry({ ...prev, brainAudit }) : prev
          )
        } catch (brainError) {
          console.error('策略大腦更新失敗（fallback）:', brainError)
        }
      }

      if (analysisDossiers.length > 0 && finalBrainForValidation) {
        setBrainValidation((prev) =>
          appendBrainValidationCases(prev, {
            portfolioId: activePortfolioId,
            sourceType: 'dailyAnalysis',
            sourceRefId: String(report.id),
            dossiers: analysisDossiers,
            brain: finalBrainForValidation,
            brainAudit,
            capturedAt: `${report.date} ${report.time}`,
          })
        )
      }

      setHoldings((prev) =>
        normalizeHoldings(
          (prev || []).map((holding) => {
            const marketPrice = priceMap[holding.code]
            if (!marketPrice) return holding
            const newValue = Math.round(marketPrice.price * holding.qty)
            const newPnl = Math.round((marketPrice.price - holding.cost) * holding.qty)
            const newPct = Math.round((marketPrice.price / holding.cost - 1) * 10000) / 100
            return {
              ...holding,
              price: marketPrice.price,
              value: newValue,
              pnl: newPnl,
              pct: newPct,
            }
          }),
          priceMap
        )
      )

      setLastUpdate(new Date())
      if (reportRefreshMeta?.__daily?.date !== todayRefreshKey) {
        refreshAnalystReportsRef
          .current({ silent: true, limit: Math.min(3, REPORT_REFRESH_DAILY_LIMIT) })
          .catch((refreshError) => {
            console.error('收盤分析後刷新公開報告失敗:', refreshError)
          })
      }
    } catch (error) {
      console.error('收盤分析失敗:', error)
      emitSaved('❌ 分析失敗', 3000)
    }

    setAnalyzing(false)
    setAnalyzeStep('')
  }, [
    activePortfolioId,
    analysisHistory,
    analyzing,
    appendBrainValidationCases,
    buildDailyHoldingDossierContext,
    canUseCloud,
    createEmptyBrainAudit,
    defaultNewsEvents,
    dossierByCode,
    fetchStockDossierData,
    enforceTaiwanHardGatesOnBrainAudit,
    formatBrainChecklistsForPrompt,
    formatBrainRulesForValidationPrompt,
    formatPortfolioNotesContext,
    getHoldingReturnPct,
    getHoldingUnrealizedPnl,
    getMarketQuotesForCodes,
    holdings,
    isClosedEvent,
    losers,
    mergeBrainWithAuditLifecycle,
    newsEvents,
    normalizeHoldings,
    normalizeStrategyBrain,
    portfolioNotes,
    hydrateDossierFinMind,
    refreshAnalystReportsRef,
    reportRefreshMeta,
    resolveHoldingPrice,
    reversalConditions,
    setAnalysisHistory,
    setAnalyzeStep,
    setAnalyzing,
    setBrainValidation,
    setDailyReport,
    setHoldings,
    setLastUpdate,
    setStrategyBrain,
    strategyBrain,
    toSlashDate,
    todayRefreshKey,
    ensureBrainAuditCoverage,
    emitSaved,
  ])

  return { runDailyAnalysis }
}
