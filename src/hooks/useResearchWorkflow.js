import { useCallback, useState } from 'react'
import { API_ENDPOINTS, STATUS_MESSAGE_TIMEOUT_MS } from '../constants.js'
import { fetchStockDossierData as defaultFetchStockDossierData } from '../lib/dataAdapters/finmindAdapter.js'
import { hydrateDossiersWithFinMind } from '../lib/finmindPromptRuntime.js'
import {
  logAnalysisObservation,
  readKnowledgeEvolutionLogs,
} from '../lib/knowledgeEvolutionRuntime.js'
import { normalizeStrategyBrain } from '../lib/brainRuntime.js'
import { evaluateBrainProposal } from '../lib/researchProposalRuntime.js'
import {
  buildResearchDossiers,
  buildResearchRequestBody,
  buildResearchStocks,
  getPrimaryResearchResult,
  getResearchTargetKey,
  mergeResearchHistoryEntries,
  patchResearchProposalState,
  updateResearchReportsProposalState,
} from '../lib/researchRuntime.js'

const RESEARCH_REQUEST_TIMEOUT_MS = 55_000
const EVOLVE_REQUEST_TIMEOUT_MS = 180_000 // evolve 模式需要 3 分鐘（4 輪 AI call）

function createTimeoutSignal(timeoutMs = RESEARCH_REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeoutMs), cancel: () => {} }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  }
}

function isTimeoutError(error) {
  const name = String(error?.name || '')
  const message = String(error?.message || '')
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('逾時')
  )
}

async function defaultRunResearchRequest(body, { onProgress } = {}) {
  const isLongRunning = body?.mode === 'evolve' || body?.mode === 'portfolio'
  const { signal, cancel } = createTimeoutSignal(
    isLongRunning ? EVOLVE_REQUEST_TIMEOUT_MS : RESEARCH_REQUEST_TIMEOUT_MS
  )
  try {
    // evolve/portfolio 用 SSE streaming 防 timeout
    const useStream = isLongRunning
    const url = useStream ? `${API_ENDPOINTS.RESEARCH}?stream=1` : API_ENDPOINTS.RESEARCH

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      let payload = null
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
      throw new Error(
        payload?.detail ||
          payload?.error ||
          (text.includes('TIMEOUT')
            ? '深度研究逾時，請稍後再試（Vercel function timeout）'
            : text.slice(0, 120) || `研究 API 失敗 (${res.status})`)
      )
    }

    // SSE streaming：逐 event 讀取，最後 done event 包含完整結果
    if (useStream && res.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim()
              // round progress → 通知 UI
              if (eventType === 'round' && typeof onProgress === 'function') {
                onProgress(eventType)
              }
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.results) finalResult = data
              } catch {
                /* partial JSON, ignore */
              }
            }
          }
        }
      } finally {
        reader.releaseLock?.()
      }

      if (finalResult) return finalResult
      throw new Error('SSE streaming 結束但沒收到研究結果')
    }

    return res.json()
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error('深度研究逾時，請稍後再試')
    }
    throw error
  } finally {
    cancel()
  }
}

async function defaultSaveBrainRequest(brainData) {
  const res = await fetch(API_ENDPOINTS.BRAIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-brain', data: brainData }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `策略大腦保存失敗 (${res.status})`)
  }
  return data
}

export function useResearchWorkflow({
  researching = false,
  setResearching = () => {},
  setResearchTarget = () => {},
  holdings = [],
  portfolioHoldings = [],
  dossierByCode = new Map(),
  fetchStockDossierData = defaultFetchStockDossierData,
  hydrateDossierFinMind = hydrateDossiersWithFinMind,
  stockMeta = {},
  strategyBrain = null,
  portfolioNotes = {},
  canUseCloud = false,
  newsEvents = [],
  analysisHistory = [],
  resolveHoldingPrice = () => 0,
  getHoldingUnrealizedPnl = () => 0,
  getHoldingReturnPct = () => 0,
  setResearchResults = () => {},
  setResearchHistory = () => {},
  setStrategyBrain = () => {},
  setSaved = () => {},
  notifySaved = null,
  enrichResearchToDossier = async () => false,
  runResearchRequest = defaultRunResearchRequest,
  saveBrainRequest = defaultSaveBrainRequest,
  readKnowledgeLogs = readKnowledgeEvolutionLogs,
}) {
  const [proposalAction, setProposalAction] = useState({ id: null, type: null })
  const emitSaved = useCallback(
    (message, timeout = STATUS_MESSAGE_TIMEOUT_MS.DEFAULT) => {
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

  const patchProposalState = useCallback(
    (targetReport, patch) => {
      const targetTimestamp = Number(targetReport?.timestamp)
      if (!Number.isFinite(targetTimestamp)) return

      setResearchResults((prev) =>
        Number(prev?.timestamp) === targetTimestamp ? patchResearchProposalState(prev, patch) : prev
      )
      setResearchHistory((prev) => updateResearchReportsProposalState(prev, targetTimestamp, patch))
    },
    [setResearchHistory, setResearchResults]
  )

  const runResearch = useCallback(
    async (mode, targetStock) => {
      if (researching) return

      setResearching(true)
      setResearchTarget(getResearchTargetKey(mode, targetStock))

      try {
        const stocks = buildResearchStocks({
          mode,
          targetStock,
          holdings,
          resolveHoldingPrice,
          getHoldingUnrealizedPnl,
          getHoldingReturnPct,
        })
        let promptDossierByCode = dossierByCode
        const promptCodes = stocks.map((stock) => stock.code)

        if (promptCodes.length > 0) {
          try {
            const hydrated = await hydrateDossierFinMind({
              codes: promptCodes,
              dossierByCode,
              fetchStockDossierData,
              contextLabel: `research-${mode}`,
            })
            if (hydrated?.dossierByCode instanceof Map) {
              promptDossierByCode = hydrated.dossierByCode
            }
          } catch (finmindError) {
            console.warn('研究 prompt FinMind hydration 失敗（改用既有 dossier）:', finmindError)
          }
        }

        const researchDossiers = buildResearchDossiers({
          stocks,
          dossierByCode: promptDossierByCode,
        })
        const { usageLog: knowledgeUsageLog, feedbackLog: knowledgeFeedbackLog } =
          readKnowledgeLogs(typeof globalThis !== 'undefined' ? globalThis.localStorage : null)
        const body = buildResearchRequestBody({
          mode,
          stocks,
          holdings: portfolioHoldings,
          researchDossiers,
          stockMeta,
          strategyBrain,
          portfolioNotes,
          canUseCloud,
          newsEvents,
          analysisHistory,
          knowledgeUsageLog,
          knowledgeFeedbackLog,
        })

        const data = await runResearchRequest(body, { mode, targetStock })
        const result = getPrimaryResearchResult(data)

        if (result) {
          setResearchResults(result)
          setResearchHistory((prev) => mergeResearchHistoryEntries([result], prev))
          ;(researchDossiers || []).forEach((dossier) => {
            logAnalysisObservation({
              ruleIds: (result?.knowledgeProposal?.confidenceAdjustments || []).map(
                (item) => item.id
              ),
              stockCode: dossier?.code,
              date: new Date().toISOString().slice(0, 10),
              outcome: result?.error ? 'negative' : 'positive',
              evidenceRefs: Array.isArray(dossier?.events) ? dossier.events.slice(0, 3) : [],
            })
          })

          if (mode === 'single' && result.code) {
            enrichResearchToDossier(result, { silent: true })
              .then((changed) => {
                if (!changed) return
                emitSaved(
                  '✅ 研究完成 · 已同步目標價 / 財報到持倉',
                  STATUS_MESSAGE_TIMEOUT_MS.NOTICE
                )
              })
              .catch((error) => {
                console.error('背景同步研究資料失敗:', error)
              })
          }

          const hasBrainProposal =
            (mode === 'evolve' || mode === 'portfolio') &&
            (result.brainProposal?.proposedBrain || result.newBrain)
          const hasKnowledgeProposal =
            (mode === 'evolve' || mode === 'portfolio') && result.knowledgeProposal

          if (hasBrainProposal || hasKnowledgeProposal) {
            emitSaved('✅ 系統進化提案已生成 · 尚未套用正式策略大腦')
          } else {
            emitSaved('✅ 研究完成')
          }
          return result
        } else {
          emitSaved('⚠️ 研究無結果')
          return null
        }
      } catch (error) {
        console.error('AutoResearch failed:', error)
        const msg = error?.message || ''
        emitSaved(
          msg.includes('逾時') || msg.includes('55 秒')
            ? '❌ 研究逾時 · 請稍後再試'
            : `❌ 研究失敗：${msg.slice(0, 60) || '未知錯誤'}`
        )
        return null
      } finally {
        setResearching(false)
        setResearchTarget(null)
      }
    },
    [
      analysisHistory,
      canUseCloud,
      dossierByCode,
      emitSaved,
      enrichResearchToDossier,
      fetchStockDossierData,
      getHoldingReturnPct,
      getHoldingUnrealizedPnl,
      holdings,
      hydrateDossierFinMind,
      newsEvents,
      portfolioHoldings,
      portfolioNotes,
      researching,
      resolveHoldingPrice,
      readKnowledgeLogs,
      runResearchRequest,
      setResearchHistory,
      setResearchResults,
      setResearchTarget,
      setResearching,
      strategyBrain,
      stockMeta,
    ]
  )

  const applyBrainProposal = useCallback(
    async (targetReport) => {
      const proposal = targetReport?.brainProposal
      if (!proposal?.proposedBrain) {
        emitSaved('⚠️ 沒有可套用的候選提案')
        return false
      }

      const targetTimestamp = Number(targetReport?.timestamp)
      setProposalAction({
        id: Number.isFinite(targetTimestamp) ? targetTimestamp : proposal.id || 'proposal',
        type: 'apply',
      })

      try {
        const evaluation = evaluateBrainProposal(proposal, strategyBrain)
        if (!evaluation.passed) {
          patchProposalState(targetReport, {
            proposalStatus: 'blocked',
            brainProposal: {
              status: 'blocked',
              evaluation,
            },
          })
          emitSaved('⚠️ 提案未通過 gate，暫不能套用', STATUS_MESSAGE_TIMEOUT_MS.NOTICE)
          return false
        }

        const nextBrain = normalizeStrategyBrain(proposal.proposedBrain, { allowEmpty: true })
        if (!nextBrain) {
          emitSaved('⚠️ 提案內容無法正規化，請重新產生')
          return false
        }

        setStrategyBrain(nextBrain)
        if (canUseCloud) {
          await saveBrainRequest(nextBrain)
        }

        patchProposalState(targetReport, {
          proposalStatus: 'applied',
          report: {
            appliedBrainAt: new Date().toISOString(),
          },
          brainProposal: {
            status: 'applied',
            evaluation,
            appliedAt: new Date().toISOString(),
          },
        })

        emitSaved('✅ 候選提案已套用到正式策略大腦', STATUS_MESSAGE_TIMEOUT_MS.NOTICE)
        return true
      } catch (error) {
        console.error('Apply brain proposal failed:', error)
        emitSaved(`❌ 套用提案失敗：${error?.message?.slice(0, 50) || '未知錯誤'}`)
        return false
      } finally {
        setProposalAction({ id: null, type: null })
      }
    },
    [canUseCloud, emitSaved, patchProposalState, saveBrainRequest, setStrategyBrain, strategyBrain]
  )

  const discardBrainProposal = useCallback(
    async (targetReport) => {
      if (!targetReport?.brainProposal) {
        emitSaved('⚠️ 沒有可放棄的候選提案')
        return false
      }

      const targetTimestamp = Number(targetReport?.timestamp)
      setProposalAction({
        id: Number.isFinite(targetTimestamp)
          ? targetTimestamp
          : targetReport.brainProposal.id || 'proposal',
        type: 'discard',
      })

      try {
        patchProposalState(targetReport, {
          proposalStatus: 'discarded',
          report: {
            discardedBrainAt: new Date().toISOString(),
          },
          brainProposal: {
            status: 'discarded',
            discardedAt: new Date().toISOString(),
          },
        })
        emitSaved('✅ 已放棄候選提案', STATUS_MESSAGE_TIMEOUT_MS.BRIEF)
        return true
      } finally {
        setProposalAction({ id: null, type: null })
      }
    },
    [emitSaved, patchProposalState]
  )

  return {
    runResearch,
    applyBrainProposal,
    discardBrainProposal,
    proposalActionId: proposalAction.id,
    proposalActionType: proposalAction.type,
  }
}
