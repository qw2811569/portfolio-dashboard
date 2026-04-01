import { useCallback } from 'react'
import { API_ENDPOINTS, STATUS_MESSAGE_TIMEOUT_MS } from '../constants.js'
import {
  buildResearchDossiers,
  buildResearchRequestBody,
  buildResearchStocks,
  getPrimaryResearchResult,
  getResearchTargetKey,
  mergeResearchHistoryEntries,
} from '../lib/researchRuntime.js'

async function defaultRunResearchRequest(body) {
  const res = await fetch(API_ENDPOINTS.RESEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  setSaved = () => {},
  notifySaved = null,
  enrichResearchToDossier = async () => false,
  runResearchRequest = defaultRunResearchRequest,
}) {
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

          if (hasBrainProposal) {
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
          msg.includes('逾時')
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
      runResearchRequest,
      setResearchHistory,
      setResearchResults,
      setResearchTarget,
      setResearching,
      strategyBrain,
      stockMeta,
    ]
  )

  return { runResearch }
}
