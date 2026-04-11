import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase C regression guard: research.js per-holding prompts must include the
 * type-aware strategy framework so that 權證 / ETF / 指數 holdings are
 * analyzed with the correct rules (Delta/Theta/IV for warrants, macro/RSI for
 * ETFs) rather than being treated like regular equities.
 *
 * The framework is a single constant TYPE_AWARE_FRAMEWORK_GUIDE exported from
 * api/research.js. Every per-holding system prompt (6 of them as of this
 * commit) should interpolate it.
 *
 * Portfolio-level prompts (system diagnosis, brain evolution) do NOT need
 * the framework and are not counted.
 */

describe('api/research.js — type-aware per-holding prompts', () => {
  const researchSource = readFileSync(resolve(process.cwd(), 'api/research.js'), 'utf-8')

  describe('TYPE_AWARE_FRAMEWORK_GUIDE constant', () => {
    it('is defined in api/research.js', () => {
      expect(researchSource).toMatch(/TYPE_AWARE_FRAMEWORK_GUIDE\s*=/)
    })

    it('contains the 權證 (warrant) strategy framework section', () => {
      expect(researchSource).toMatch(/權證/)
      expect(researchSource).toMatch(/Delta/)
      expect(researchSource).toMatch(/Theta/)
      expect(researchSource).toMatch(/IV/)
    })

    it('contains the ETF/指數 strategy framework section', () => {
      expect(researchSource).toMatch(/ETF/)
      expect(researchSource).toMatch(/RSI/)
      expect(researchSource).toMatch(/槓桿/)
    })

    it('preserves the specific numeric thresholds from daily analysis (regression guard)', () => {
      // 權證: Delta range, IV rollover window, 出場 ratio
      expect(researchSource).toMatch(/0\.4-0\.7/)
      expect(researchSource).toMatch(/30 天/)
      expect(researchSource).toMatch(/1\/2 → 1\/4/)
      // ETF: RSI thresholds, 正2型 stop-loss
      expect(researchSource).toMatch(/RSI >70/)
      expect(researchSource).toMatch(/RSI <30/)
      expect(researchSource).toMatch(/>15%/)
    })
  })

  describe('per-holding prompts include the framework constant', () => {
    // Count how many times TYPE_AWARE_FRAMEWORK_GUIDE is interpolated into
    // prompt arguments passed to callClaude (first arg is the system prompt).
    // We scan for usage in template literals: ${TYPE_AWARE_FRAMEWORK_GUIDE}
    it('references TYPE_AWARE_FRAMEWORK_GUIDE in at least 6 prompt sites', () => {
      const usageCount = (researchSource.match(/\$\{TYPE_AWARE_FRAMEWORK_GUIDE\}/g) || []).length
      expect(usageCount).toBeGreaterThanOrEqual(6)
    })

    it('the const value is not just a comment — actual template interpolation', () => {
      // Negative check: the const should NOT only appear in comments
      const allRefs = researchSource.match(/TYPE_AWARE_FRAMEWORK_GUIDE/g) || []
      expect(allRefs.length).toBeGreaterThanOrEqual(7) // 1 definition + 6 usages
    })
  })

  describe('per-holding prompts still have non-type-aware call sites preserved', () => {
    // Sanity: we haven't accidentally deleted the callClaude invocations
    it('api/research.js still has at least 9 callClaude call sites (preserves existing structure)', () => {
      const callSites = (researchSource.match(/await callClaude\(/g) || []).length
      expect(callSites).toBeGreaterThanOrEqual(9)
    })

    it('portfolio-level system prompts (diag, evolveAdvice, newBrainText) do NOT contain the framework', () => {
      // Extract each portfolio-level system prompt as a region of source text
      // and assert the framework constant is not interpolated inside them.
      // If someone accidentally injects the framework into a system-diagnosis
      // prompt, this catches it.
      const diagMatch = researchSource.match(/const diag = await callClaude\(\s*`([^`]+)`/)
      const evolveMatch = researchSource.match(
        /const evolveAdvice = await callClaude\(\s*`([^`]+)`/
      )
      const brainMatch = researchSource.match(/const newBrainText = await callClaude\(\s*`([^`]+)`/)
      expect(diagMatch?.[1]).toBeDefined()
      expect(evolveMatch?.[1]).toBeDefined()
      expect(brainMatch?.[1]).toBeDefined()
      expect(diagMatch[1]).not.toContain('TYPE_AWARE_FRAMEWORK_GUIDE')
      expect(evolveMatch[1]).not.toContain('TYPE_AWARE_FRAMEWORK_GUIDE')
      expect(brainMatch[1]).not.toContain('TYPE_AWARE_FRAMEWORK_GUIDE')
    })
  })
})
