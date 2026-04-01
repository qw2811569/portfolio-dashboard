import {
  brainRuleText,
  normalizeBrainEvidenceRefs,
  normalizeStrategyBrain,
} from './brainRuntime.js'

function normalizeSemanticText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[「」『』（）()【】［］[\]{}<>《》,，.。:：;；!！?？/\-|_]/g, '')
    .replace(/\s+/g, '')
}

function buildRuleSemanticSource(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return brainRuleText(rule)
  return [
    brainRuleText(rule),
    rule.when,
    rule.action,
    rule.scope,
    Array.isArray(rule.appliesTo) ? rule.appliesTo.join(' ') : '',
    rule.marketRegime,
    rule.catalystWindow,
  ]
    .filter(Boolean)
    .join(' ')
}

function buildRuleFingerprint(rule) {
  return normalizeSemanticText(buildRuleSemanticSource(rule))
}

function buildBigrams(text) {
  const source = normalizeSemanticText(text)
  if (source.length <= 1) return new Set(source ? [source] : [])
  const grams = new Set()
  for (let i = 0; i < source.length - 1; i += 1) {
    grams.add(source.slice(i, i + 2))
  }
  return grams
}

function semanticSimilarity(a, b) {
  const aSet = buildBigrams(a)
  const bSet = buildBigrams(b)
  if (aSet.size === 0 || bSet.size === 0) return 0
  let overlap = 0
  for (const item of aSet) {
    if (bSet.has(item)) overlap += 1
  }
  return overlap / Math.max(aSet.size, bSet.size)
}

function isExactRuleMatch(rule, candidate) {
  const ruleId = String(rule?.id || '').trim()
  const candidateId = String(candidate?.id || '').trim()
  if (ruleId && candidateId && ruleId === candidateId) return true
  const ruleFingerprint = buildRuleFingerprint(rule)
  const candidateFingerprint = buildRuleFingerprint(candidate)
  return Boolean(ruleFingerprint && candidateFingerprint && ruleFingerprint === candidateFingerprint)
}

function isSemanticDuplicate(rule, candidate) {
  if (isExactRuleMatch(rule, candidate)) return false
  const ruleFingerprint = buildRuleFingerprint(rule)
  const candidateFingerprint = buildRuleFingerprint(candidate)
  if (!ruleFingerprint || !candidateFingerprint) return false
  if (
    (ruleFingerprint.includes(candidateFingerprint) || candidateFingerprint.includes(ruleFingerprint)) &&
    Math.min(ruleFingerprint.length, candidateFingerprint.length) >= 12
  ) {
    return true
  }
  return semanticSimilarity(ruleFingerprint, candidateFingerprint) >= 0.72
}

function findExactMatch(rule, candidates) {
  return (Array.isArray(candidates) ? candidates : []).find((candidate) =>
    isExactRuleMatch(rule, candidate)
  )
}

function findSemanticDuplicate(rule, candidates) {
  return (Array.isArray(candidates) ? candidates : []).find((candidate) =>
    isSemanticDuplicate(rule, candidate)
  )
}

function summarizeRule(rule) {
  return brainRuleText(rule) || String(rule?.id || '').trim() || '未命名規則'
}

function extractProposalBrain(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return null
  if (proposal.proposedBrain && typeof proposal.proposedBrain === 'object') {
    return proposal.proposedBrain
  }
  return proposal
}

export function evaluateBrainProposal(proposal, currentBrain) {
  const proposalBrain = normalizeStrategyBrain(extractProposalBrain(proposal), { allowEmpty: true })
  const current = normalizeStrategyBrain(currentBrain, { allowEmpty: true })

  const proposedRules = proposalBrain.rules || []
  const proposedCandidateRules = proposalBrain.candidateRules || []
  const proposedAllRules = [...proposedRules, ...proposedCandidateRules]
  const currentAllRules = [...(current.rules || []), ...(current.candidateRules || [])]
  const currentUserRules = (current.rules || []).filter((rule) => rule?.source === 'user')

  const missingUserRules = currentUserRules.filter(
    (rule) => !proposedRules.some((candidate) => isExactRuleMatch(rule, candidate) || isSemanticDuplicate(rule, candidate))
  )

  const newRules = proposedAllRules.filter((rule) => !findExactMatch(rule, currentAllRules))
  const newRulesWithMissingEvidence = newRules.filter(
    (rule) => normalizeBrainEvidenceRefs(rule?.evidenceRefs).length === 0
  )
  const duplicateWithCurrent = newRules
    .map((rule) => {
      const matched = findSemanticDuplicate(rule, currentAllRules)
      return matched ? { rule: summarizeRule(rule), matchedRule: summarizeRule(matched) } : null
    })
    .filter(Boolean)

  const duplicateWithinProposal = []
  newRules.forEach((rule, index) => {
    const duplicate = newRules
      .slice(index + 1)
      .find((candidate) => isSemanticDuplicate(rule, candidate))
    if (duplicate) {
      duplicateWithinProposal.push({
        rule: summarizeRule(rule),
        matchedRule: summarizeRule(duplicate),
      })
    }
  })

  const issues = []
  if (missingUserRules.length > 0) {
    issues.push(`缺少 ${missingUserRules.length} 條 user-confirmed 規則`)
  }
  if (newRules.length > 3) {
    issues.push(`新增規則 ${newRules.length} 條，超過單次 3 條上限`)
  }
  if (newRulesWithMissingEvidence.length > 0) {
    issues.push(`有 ${newRulesWithMissingEvidence.length} 條新增規則缺少 evidence_refs`)
  }
  if (duplicateWithCurrent.length > 0) {
    issues.push(`有 ${duplicateWithCurrent.length} 條新增規則與現有 rules 語意重複`)
  }
  if (duplicateWithinProposal.length > 0) {
    issues.push(`提案內有 ${duplicateWithinProposal.length} 組新增規則彼此重複`)
  }

  const passed = issues.length === 0

  return {
    passed,
    status: passed ? 'passed' : 'blocked',
    summary: passed ? '通過 gate，可手動套用' : `未通過 gate：${issues.join('；')}`,
    issues,
    metrics: {
      currentRuleCount: currentAllRules.length,
      currentUserRuleCount: currentUserRules.length,
      proposedRuleCount: proposedAllRules.length,
      newRuleCount: newRules.length,
      missingUserRuleCount: missingUserRules.length,
      missingEvidenceCount: newRulesWithMissingEvidence.length,
      duplicateWithCurrentCount: duplicateWithCurrent.length,
      duplicateWithinProposalCount: duplicateWithinProposal.length,
    },
    details: {
      missingUserRules: missingUserRules.map(summarizeRule),
      missingEvidenceRules: newRulesWithMissingEvidence.map(summarizeRule),
      duplicateWithCurrent,
      duplicateWithinProposal,
    },
  }
}
