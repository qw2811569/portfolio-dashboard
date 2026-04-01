import { describe, expect, it } from 'vitest'
import { evaluateBrainProposal } from '../../src/lib/researchProposalRuntime.js'

describe('lib/researchProposalRuntime', () => {
  const currentBrain = {
    rules: [
      {
        id: 'user-rule-1',
        text: '法說前兩週先觀察量價再決定是否加碼',
        when: '法說前 2 週',
        action: '先觀察量價',
        source: 'user',
        status: 'active',
      },
      {
        id: 'ai-rule-1',
        text: '月營收連三月走升才提高成長股信心',
        when: '月營收連三月走升',
        action: '提高信心',
        source: 'ai',
        status: 'active',
      },
    ],
    candidateRules: [],
    lessons: [],
  }

  it('passes gate when user rules are preserved and new rules stay within budget', () => {
    const result = evaluateBrainProposal(
      {
        proposedBrain: {
          rules: [
            {
              id: 'user-rule-1',
              text: '法說前兩週先觀察量價再決定是否加碼',
              when: '法說前 2 週',
              action: '先觀察量價',
              source: 'user',
              status: 'active',
            },
            {
              text: '族群轉弱且目標價已被市場消化時先減碼 1/3',
              when: '題材股轉弱',
              action: '先減碼 1/3',
              evidenceRefs: [{ type: 'analysis', label: '2026/04/01 收盤分析' }],
            },
          ],
          candidateRules: [
            {
              text: '若事件後三日不漲則把候選規則降級',
              when: '事件公布後 3 日',
              action: '降級候選規則',
              status: 'candidate',
              evidenceRefs: [{ type: 'event', label: '事件行事曆回測' }],
            },
          ],
        },
      },
      currentBrain
    )

    expect(result.passed).toBe(true)
    expect(result.metrics.newRuleCount).toBe(2)
  })

  it('blocks proposals that remove user-confirmed rules or add too many rules', () => {
    const result = evaluateBrainProposal(
      {
        proposedBrain: {
          rules: [
            {
              text: '新增規則 A',
              when: '條件 A',
              action: '動作 A',
              evidenceRefs: [{ type: 'analysis', label: 'A' }],
            },
            {
              text: '新增規則 B',
              when: '條件 B',
              action: '動作 B',
              evidenceRefs: [{ type: 'analysis', label: 'B' }],
            },
            {
              text: '新增規則 C',
              when: '條件 C',
              action: '動作 C',
              evidenceRefs: [{ type: 'analysis', label: 'C' }],
            },
            {
              text: '新增規則 D',
              when: '條件 D',
              action: '動作 D',
              evidenceRefs: [{ type: 'analysis', label: 'D' }],
            },
          ],
          candidateRules: [],
        },
      },
      currentBrain
    )

    expect(result.passed).toBe(false)
    expect(result.issues.join('；')).toContain('user-confirmed')
    expect(result.issues.join('；')).toContain('超過單次 3 條上限')
  })

  it('blocks missing evidence and semantic duplicates', () => {
    const result = evaluateBrainProposal(
      {
        proposedBrain: {
          rules: [
            {
              id: 'user-rule-1',
              text: '法說前兩週先觀察量價再決定是否加碼',
              source: 'user',
              status: 'active',
            },
            {
              text: '月營收連三個月走升時才提高成長股信心',
              when: '月營收連三月走升',
              action: '提高信心',
              evidenceRefs: [],
            },
          ],
          candidateRules: [],
        },
      },
      currentBrain
    )

    expect(result.passed).toBe(false)
    expect(result.metrics.missingEvidenceCount).toBe(1)
    expect(result.metrics.duplicateWithCurrentCount).toBe(1)
  })
})
