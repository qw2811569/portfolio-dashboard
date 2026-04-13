import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Card, Button, OperatingContextCard } from '../common'
import Md from '../Md.jsx'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

/**
 * Research Panel Header
 */
export function ResearchHeader({
  onEvolve,
  onRefresh,
  researching,
  reportRefreshing,
  reportRefreshStatus,
}) {
  return h(
    Card,
    {
      style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.teal, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.teal, marginBottom: 6 } }, 'AI 投資助手'),
    h(
      'div',
      { style: { fontSize: 11, color: C.textSec, lineHeight: 1.7, marginBottom: 10 } },
      'AI 自動分析：不只研究個股，更能審視你的整個投資系統 — ',
      '決策品質、認知盲點、情緒模式、策略一致性 — 並產出 AI 策略建議。'
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 6, marginBottom: 10 } },
      h(
        Button,
        {
          onClick: onEvolve,
          disabled: researching,
          style: {
            flex: 1,
            padding: '13px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: researching ? 'not-allowed' : 'pointer',
            background: researching
              ? C.subtle
              : `linear-gradient(135deg,${C.fillTomato},${C.fillChoco})`,
            color: researching ? C.textMute : C.onFill,
          },
        },
        researching ? '全組合研究 + 建議生成中...' : '🧬 全組合研究 + AI 策略建議'
      ),
      h(
        Button,
        {
          onClick: onRefresh,
          disabled: reportRefreshing,
          style: {
            padding: '13px 14px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.amber, '2a')}`,
            fontSize: 12,
            fontWeight: 600,
            cursor: reportRefreshing ? 'not-allowed' : 'pointer',
            background: alpha(C.amber, '15'),
            color: reportRefreshing ? C.textMute : C.amber,
            whiteSpace: 'nowrap',
          },
        },
        reportRefreshing ? '刷新中...' : '刷新公開報告'
      )
    ),
    reportRefreshStatus &&
      h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 8 } }, reportRefreshStatus)
  )
}

/**
 * Stock Research Buttons
 */
export function StockResearchButtons({
  holdings,
  onResearch,
  researching,
  researchTarget,
  STOCK_META,
  IND_COLOR,
}) {
  return h(
    'div',
    null,
    h(
      'div',
      { style: { fontSize: 9, color: C.textMute, marginBottom: 4 } },
      '個股研究選擇（3 輪迭代）：'
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
      holdings.map((holding) => {
        const m = STOCK_META?.[holding.code]
        const color = m ? IND_COLOR?.[m.industry] || C.textMute : C.textMute
        const isTarget = researching && researchTarget === holding.code
        return h(
          Button,
          {
            key: holding.code,
            onClick: () => onResearch('single', holding),
            disabled: researching,
            style: {
              fontSize: 9,
              padding: '4px 8px',
              borderRadius: 6,
              cursor: researching ? 'not-allowed' : 'pointer',
              background: isTarget ? alpha(color, '20') : C.card,
              border: `1px solid ${isTarget ? color : C.border}`,
              color: isTarget ? color : C.textSec,
              whiteSpace: 'nowrap',
            },
          },
          isTarget ? '研究中...' : holding.name
        )
      })
    )
  )
}

/**
 * Data Refresh Center
 */
export function DataRefreshCenter({ dataRefreshRows }) {
  if (!dataRefreshRows || dataRefreshRows.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: C.amber } }, '資料更新中心'),
        h(
          'div',
          { style: { fontSize: 11, color: C.textSec, lineHeight: 1.7 } },
          '先補齊過期 / 缺少的財報與目標價，AI 之後的分析會更扎實。'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
        dataRefreshRows.slice(0, 4).map((item) =>
          h(
            'span',
            {
              key: item.code,
              style: {
                fontSize: 9,
                padding: '4px 8px',
                borderRadius: 999,
                background: C.subtle,
                border: `1px solid ${C.border}`,
                color: C.amber,
              },
            },
            `${item.name} 需更新`
          )
        )
      )
    ),
    h(
      'div',
      { style: { display: 'grid', gap: 7 } },
      dataRefreshRows.slice(0, 5).map((item) =>
        h(
          'div',
          {
            key: item.code,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              background: C.subtle,
              border: `1px solid ${C.borderSub}`,
              borderRadius: 8,
              padding: '8px 10px',
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              { style: { fontSize: 11, color: C.text, fontWeight: 500 } },
              `${item.name} (${item.code})`
            ),
            item.targetLabel
              ? h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                      fontSize: 9,
                      marginTop: 3,
                      color: item.targetSource === 'per-band' ? C.textMute : C.textSec,
                    },
                  },
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 8,
                        padding: '1px 4px',
                        borderRadius: 3,
                        fontWeight: 600,
                        background:
                          item.targetSource === 'per-band'
                            ? alpha(C.textMute, '14')
                            : alpha(C.teal, '14'),
                        color: item.targetSource === 'per-band' ? C.textMute : C.teal,
                      },
                    },
                    item.targetSource === 'per-band' ? '系統推估' : '券商觀點'
                  ),
                  item.targetLabel,
                  item.targetStatus === 'aging'
                    ? h('span', { style: { color: C.amber, marginLeft: 4 } }, '\u26A0 報告偏舊')
                    : null
                )
              : h(
                  'div',
                  { style: { fontSize: 9, color: C.textMute, marginTop: 3 } },
                  `目標價：${item.targetStatus} · 財報：${item.fundamentalStatus}`
                ),
            item.classificationNote &&
              h(
                'div',
                { style: { fontSize: 8, color: C.amber, marginTop: 2, fontStyle: 'italic' } },
                item.classificationNote
              )
          )
        )
      )
    ),
    h(
      'div',
      {
        style: {
          fontSize: 10,
          color: C.textMute,
          lineHeight: 1.7,
          marginTop: 8,
        },
      },
      '先用上方「刷新公開報告」補齊資料，再開始個股或全組合研究。'
    )
  )
}

/**
 * Research Progress
 */
export function ResearchProgress({ researching, researchTarget, holdings }) {
  if (!researching) return null

  const isEvolve = researchTarget === 'EVOLVE'
  const isPortfolio = researchTarget === 'PORTFOLIO'
  const label = isEvolve
    ? 'AI 正在審視你的投資系統並產出策略建議'
    : isPortfolio
      ? `AI 正在進行全組合深度研究（${holdings?.length || 0} 檔持股）`
      : `AI 正在進行個股深度研究`

  return h(
    Card,
    {
      style: {
        marginBottom: 10,
        textAlign: 'center',
        padding: '32px 16px',
        background: `linear-gradient(135deg, ${alpha(C.teal, '08')}, ${alpha(C.olive, '08')})`,
      },
    },
    // Spinning loader
    h('div', {
      style: {
        width: 36,
        height: 36,
        margin: '0 auto 16px',
        border: `3px solid ${alpha(C.teal, '20')}`,
        borderTop: `3px solid ${C.teal}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      },
    }),
    h(
      'div',
      {
        style: {
          fontSize: 13,
          color: isEvolve ? C.up : C.teal,
          fontWeight: 600,
          marginBottom: 8,
        },
      },
      label
    ),
    h(
      'div',
      { style: { fontSize: 10, color: C.textMute, marginBottom: 14 } },
      isEvolve
        ? '3 輪迭代：系統診斷 → 進化建議 → AI 策略建議，預計 1-2 分鐘'
        : isPortfolio
          ? '逐一分析持股 + 組合策略 + AI 建議，預計 1-2 分鐘'
          : '3 輪迭代研究：基本面 → 風險催化 → 策略建議，預計 30 秒'
    ),
    // Progress bar
    h(
      'div',
      {
        style: {
          maxWidth: 240,
          margin: '0 auto',
          height: 4,
          background: C.subtle,
          borderRadius: 2,
          overflow: 'hidden',
        },
      },
      h('div', {
        style: {
          height: '100%',
          width: '60%',
          background: `linear-gradient(90deg, ${C.teal}, ${C.olive})`,
          borderRadius: 2,
          animation: 'indeterminate 1.8s ease-in-out infinite',
        },
      })
    )
  )
}

function proposalStatusMeta(proposalStatus, gatePassed) {
  if (proposalStatus === 'applied') return { label: '已套用', color: C.olive }
  if (proposalStatus === 'discarded') return { label: '已放棄', color: C.textMute }
  if (proposalStatus === 'blocked' || gatePassed === false)
    return { label: '風險偏高，暫不建議採用', color: C.down }
  return { label: '待決策', color: C.amber }
}

function knowledgeProposalStatusMeta(status, gatePassed) {
  if (status === 'candidate' && gatePassed !== false)
    return { label: '建議可考慮採用', color: C.teal }
  if (status === 'blocked' || gatePassed === false)
    return { label: '風險偏高，暫不建議採用', color: C.down }
  return { label: '暫無調整', color: C.textMute }
}

export function ResearchProposalCard({
  results,
  onApplyProposal,
  onDiscardProposal,
  proposalActionId,
  proposalActionType,
}) {
  const proposal = results?.brainProposal
  if (!proposal?.proposedBrain) return null

  const evaluation = proposal.evaluation || {}
  const proposalStatus = results?.proposalStatus || proposal.status || 'candidate'
  const statusMeta = proposalStatusMeta(proposalStatus, evaluation.passed)
  const actionBusy = Number(proposalActionId) === Number(results?.timestamp)
  const canApply =
    proposalStatus !== 'applied' && proposalStatus !== 'discarded' && evaluation.passed !== false

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(statusMeta.color, '45')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: statusMeta.color } }, 'AI 策略建議'),
        h(
          'div',
          { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
          proposal.summary || '—'
        ),
        h(
          'div',
          { style: { fontSize: 10, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
          `${statusMeta.label} · ${evaluation.summary || '尚未評估'}`
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
        h(
          Button,
          {
            onClick: () => onApplyProposal?.(results),
            disabled: !canApply || actionBusy,
            style: {
              padding: '7px 10px',
              borderRadius: 7,
              border: 'none',
              background: canApply ? alpha(C.olive, '22') : C.subtle,
              color: canApply ? C.olive : C.textMute,
              fontSize: 10,
              fontWeight: 600,
              cursor: !canApply || actionBusy ? 'not-allowed' : 'pointer',
            },
          },
          actionBusy && proposalActionType === 'apply' ? '套用中...' : '套用提案'
        ),
        h(
          Button,
          {
            onClick: () => onDiscardProposal?.(results),
            disabled: proposalStatus === 'discarded' || actionBusy,
            style: {
              padding: '7px 10px',
              borderRadius: 7,
              border: `1px solid ${alpha(C.down, '2a')}`,
              background: alpha(C.down, '12'),
              color: proposalStatus === 'discarded' ? C.textMute : C.down,
              fontSize: 10,
              fontWeight: 600,
              cursor: proposalStatus === 'discarded' || actionBusy ? 'not-allowed' : 'pointer',
            },
          },
          actionBusy && proposalActionType === 'discard' ? '放棄中...' : '放棄提案'
        )
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
          fontSize: 10,
          color: C.textSec,
          lineHeight: 1.7,
        },
      },
      h(
        'div',
        null,
        `規則 ${proposal.metrics?.ruleCount || 0} 條 · 候選 ${proposal.metrics?.candidateRuleCount || 0} 條 · 教訓 ${proposal.metrics?.lessonCount || 0} 條`
      ),
      Array.isArray(evaluation.issues) &&
        evaluation.issues.length > 0 &&
        h('div', { style: { color: C.down } }, `風險提醒：${evaluation.issues.join('；')}`)
    )
  )
}

export function KnowledgeProposalCard({ results }) {
  const proposal = results?.knowledgeProposal
  if (!proposal) return null

  const evaluation = proposal.evaluation || {}
  const statusMeta = knowledgeProposalStatusMeta(proposal.status, evaluation.passed)
  const adjustments = Array.isArray(proposal.confidenceAdjustments)
    ? proposal.confidenceAdjustments
    : []

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(statusMeta.color, '45')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: statusMeta.color } }, '知識更新建議'),
        h(
          'div',
          { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
          proposal.summary || '—'
        ),
        h(
          'div',
          { style: { fontSize: 10, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
          `${statusMeta.label} · ${evaluation.summary || '尚未評估'}`
        )
      ),
      h(
        'div',
        { style: { fontSize: 10, color: C.textMute, textAlign: 'right', lineHeight: 1.6 } },
        `調整 ${proposal.metrics?.adjustmentCount || adjustments.length} 筆`,
        h('br'),
        `已連結回饋 ${proposal.metrics?.feedbackLinkedCount || 0} / 未連結 ${proposal.metrics?.feedbackMissingLinkCount || 0}`
      )
    ),
    adjustments.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 4, fontSize: 10, color: C.textSec, lineHeight: 1.7 } },
        adjustments
          .slice(0, 5)
          .map((item) =>
            h(
              'div',
              { key: item.id },
              `${item.id} ${item.title}：${Math.round(item.fromConfidence * 100)}% → ${Math.round(item.toConfidence * 100)}% · ${item.reason}`
            )
          )
      )
  )
}

/**
 * Research Results
 */
export function ResearchResults({
  results,
  onEnrich,
  enriching,
  onApplyProposal,
  onDiscardProposal,
  proposalActionId,
  proposalActionType,
}) {
  if (!results) return null

  return h(
    'div',
    { style: { marginBottom: 10 } },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { ...lbl, marginBottom: 0, color: C.teal } },
        `${results.name} · ${results.date}`
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          },
        },
        results.priceAtResearch &&
          h(
            'span',
            { style: { fontSize: 10, color: C.textMute } },
            `研究時股價 ${results.priceAtResearch}`
          ),
        results.mode === 'single' &&
          h(
            Button,
            {
              onClick: () => onEnrich(results),
              disabled: enriching === results.code,
              style: {
                padding: '6px 9px',
                borderRadius: 7,
                border: `1px solid ${alpha(C.amber, '2a')}`,
                background: alpha(C.amber, '15'),
                color: C.amber,
                fontSize: 10,
                fontWeight: 500,
                cursor: enriching === results.code ? 'not-allowed' : 'pointer',
              },
            },
            enriching === results.code ? '同步中...' : '存到持股筆記'
          )
      )
    ),
    h(ResearchProposalCard, {
      results,
      onApplyProposal,
      onDiscardProposal,
      proposalActionId,
      proposalActionType,
    }),
    h(KnowledgeProposalCard, {
      results,
    }),
    results.rounds?.map((round, i) =>
      h(
        Card,
        {
          key: i,
          style: {
            marginBottom: 6,
            borderLeft: `2px solid ${alpha([C.blue, C.amber, C.teal][i % 3], '40')}`,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 10,
              fontWeight: 600,
              color: [C.blue, C.amber, C.teal][i % 3],
              marginBottom: 6,
            },
          },
          `Round ${i + 1}：${round.title}`
        ),
        h(Md, { text: round.content, color: C.textSec })
      )
    )
  )
}

/**
 * Research History
 */
export function ResearchHistory({ history, onSelect, selectedId }) {
  if (!history || history.length === 0) return null

  return h(
    Card,
    null,
    h(
      'div',
      { style: { ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('span', null, '歷史研究記錄'),
      h(
        'span',
        { style: { fontSize: 9, color: C.textMute, fontWeight: 400 } },
        `${history.length} 筆`
      )
    ),
    history.map((r, i) =>
      h(
        'div',
        {
          key: r.timestamp || i,
          onClick: () => onSelect(r),
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 6px',
            cursor: 'pointer',
            borderRadius: 6,
            background: selectedId === r.timestamp ? C.subtle : 'transparent',
            borderBottom: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'div',
          null,
          h(
            'span',
            { style: { fontSize: 12, color: r.mode === 'evolve' ? C.up : C.text } },
            `${r.mode === 'evolve' ? '🧬 ' : '🔬 '}${r.name}`
          ),
          h('span', { style: { fontSize: 10, color: C.textMute, marginLeft: 6 } }, r.date)
        ),
        h('span', { style: { fontSize: 9, color: C.textMute } }, `${r.rounds?.length || 0} 輪分析`)
      )
    )
  )
}

/**
 * Main Research Panel
 */
export function ResearchPanel({
  holdings,
  researching,
  researchTarget,
  reportRefreshing,
  reportRefreshStatus,
  dataRefreshRows,
  researchResults,
  researchHistory,
  enrichingResearchCode,
  proposalActionId,
  proposalActionType,
  STOCK_META,
  IND_COLOR,
  operatingContext,
  onEvolve,
  onRefresh,
  onResearch,
  onEnrich,
  onApplyProposal,
  onDiscardProposal,
  onSelectHistory,
}) {
  return h(
    'div',
    null,
    h(OperatingContextCard, { context: operatingContext }),
    h(ResearchHeader, {
      onEvolve,
      onRefresh,
      researching,
      reportRefreshing,
      reportRefreshStatus,
    }),
    h(StockResearchButtons, {
      holdings,
      onResearch,
      researching,
      researchTarget,
      STOCK_META,
      IND_COLOR,
    }),
    h(DataRefreshCenter, {
      dataRefreshRows,
    }),
    h(ResearchProgress, {
      researching,
      researchTarget,
      holdings,
    }),
    h(ResearchResults, {
      results: researchResults,
      onEnrich,
      enriching: enrichingResearchCode,
      onApplyProposal,
      onDiscardProposal,
      proposalActionId,
      proposalActionType,
    }),
    !researchResults &&
      !researching &&
      (!researchHistory || researchHistory.length === 0) &&
      h(
        Card,
        {
          style: { textAlign: 'center', padding: '24px' },
        },
        h(
          'div',
          { style: { fontSize: 11, color: C.textMute, lineHeight: 1.8 } },
          '點擊上方按鈕開始第一次深度研究。',
          h('br'),
          'AI 將自主進行多輪迭代分析，像研究員一樣逐步深入。'
        )
      ),
    h(ResearchHistory, {
      history: researchHistory,
      onSelect: onSelectHistory,
      selectedId: researchResults?.timestamp,
    })
  )
}
