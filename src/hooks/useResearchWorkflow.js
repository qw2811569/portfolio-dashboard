import { useCallback, useState } from 'react'
import { API_ENDPOINTS, STATUS_MESSAGE_TIMEOUT_MS } from '../constants.js'
import { readKnowledgeEvolutionLogs } from '../lib/knowledgeEvolutionRuntime.js'
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

async function defaultRunResearchRequest(body) {
  const { signal, cancel } = createTimeoutSignal()
  try {
    const res = await fetch(API_ENDPOINTS.RESEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        text.includes('TIMEOUT')
          ? '深度研究逾時，請稍後再試（Vercel function timeout）'
          : text.slice(0, 120) || `研究 API 失敗 (${res.status})`
      )
    }
    return res.json()
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error('深度研究逾時，請稍後再試（55 秒內未完成）')
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
      setResearchHistory((prev) =>
        updateResearchReportsProposalState(prev, targetTimestamp, patch)
      )
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
        const researchDossiers = buildResearchDossiers({ stocks, dossierByCode })
        const { usageLog: knowledgeUsageLog, feedbackLog: knowledgeFeedbackLog } =
          readKnowledgeLogs(
            typeof globalThis !== 'undefined' ? globalThis.localStorage : null
          )
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
      getHoldingReturnPct,
      getHoldingUnrealizedPnl,
      holdings,
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
    [
      canUseCloud,
      emitSaved,
      patchProposalState,
      saveBrainRequest,
      setStrategyBrain,
      strategyBrain,
    ]
  )

  const discardBrainProposal = useCallback(
    async (targetReport) => {
      if (!targetReport?.brainProposal) {
        emitSaved('⚠️ 沒有可放棄的候選提案')
        return false
      }

      const targetTimestamp = Number(targetReport?.timestamp)
      setProposalAction({
        id: Number.isFinite(targetTimestamp) ? targetTimestamp : targetReport.brainProposal.id || 'proposal',
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
