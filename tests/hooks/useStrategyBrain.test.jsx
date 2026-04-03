import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock brainRuntime — provide minimal normalizers
vi.mock('../../src/lib/brainRuntime.js', () => ({
  normalizeStrategyBrain: vi.fn((val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null
    return { rules: val.rules || [], brainAudit: val.brainAudit || null, ...val }
  }),
  normalizeBrainValidationStore: vi.fn((val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return { cases: [] }
    return { cases: Array.isArray(val.cases) ? val.cases : [] }
  }),
  normalizeBrainAuditBuckets: vi.fn((val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { validatedRules: [], staleRules: [], invalidatedRules: [] }
    }
    return {
      validatedRules: val.validatedRules || [],
      staleRules: val.staleRules || [],
      invalidatedRules: val.invalidatedRules || [],
    }
  }),
  attachEvidenceRefsToBrainAudit: vi.fn((_audit, refs) => refs),
  ensureBrainAuditCoverage: vi.fn((_audit, _brain) => ({ covered: true })),
  mergeBrainWithAuditLifecycle: vi.fn((next) => next),
}))

import { useStrategyBrain } from '../../src/hooks/useStrategyBrain.js'
import { OWNER_PORTFOLIO_ID } from '../../src/constants.js'

describe('hooks/useStrategyBrain.js', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders without crashing with default params', () => {
    const { result } = renderHook(() => useStrategyBrain())
    expect(result.current).toBeDefined()
  })

  it('returns the correct shape — state, statistics, operations, helpers', () => {
    const { result } = renderHook(() => useStrategyBrain())

    // State
    expect(result.current).toHaveProperty('strategyBrain')
    expect(result.current).toHaveProperty('brainValidation')
    expect(result.current).toHaveProperty('brainAudit')

    // Statistics (memoized)
    expect(result.current).toHaveProperty('brainRulesByStatus')
    expect(result.current.brainRulesByStatus).toEqual(
      expect.objectContaining({
        active: expect.any(Array),
        candidate: expect.any(Array),
        archived: expect.any(Array),
      })
    )
    expect(result.current).toHaveProperty('validationStats')
    expect(result.current.validationStats).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        supported: expect.any(Number),
        contradicted: expect.any(Number),
        mixed: expect.any(Number),
      })
    )
    expect(result.current).toHaveProperty('auditStats')
    expect(result.current.auditStats).toEqual(
      expect.objectContaining({
        validated: expect.any(Number),
        stale: expect.any(Number),
        invalidated: expect.any(Number),
      })
    )

    // Operations
    expect(result.current.updateStrategyBrain).toBeTypeOf('function')
    expect(result.current.updateBrainValidation).toBeTypeOf('function')
    expect(result.current.addValidationCase).toBeTypeOf('function')
    expect(result.current.updateBrainAudit).toBeTypeOf('function')
    expect(result.current.mergeBrainAudit).toBeTypeOf('function')
    expect(result.current.ensureAuditCoverage).toBeTypeOf('function')
    expect(result.current.attachEvidenceRefs).toBeTypeOf('function')
    expect(result.current.syncBrainFromCloud).toBeTypeOf('function')
    expect(result.current.saveBrainToCloud).toBeTypeOf('function')

    // Helpers (re-exports)
    expect(result.current.normalizeStrategyBrain).toBeTypeOf('function')
    expect(result.current.normalizeBrainValidationStore).toBeTypeOf('function')
    expect(result.current.normalizeBrainAuditBuckets).toBeTypeOf('function')
  })

  // --- brainRulesByStatus ---

  it('brainRulesByStatus categorizes rules correctly', async () => {
    const { result } = renderHook(() => useStrategyBrain())

    await act(async () => {
      await result.current.updateStrategyBrain(OWNER_PORTFOLIO_ID, 'brain-v1', {
        rules: [
          { id: '1', text: 'rule-a', status: 'active' },
          { id: '2', text: 'rule-b', status: 'candidate' },
          { id: '3', text: 'rule-c', status: 'archived' },
          { id: '4', text: 'rule-d', status: 'active' },
        ],
      })
    })

    expect(result.current.brainRulesByStatus.active).toHaveLength(2)
    expect(result.current.brainRulesByStatus.candidate).toHaveLength(1)
    expect(result.current.brainRulesByStatus.archived).toHaveLength(1)
  })

  it('brainRulesByStatus returns empty arrays when strategyBrain is null', () => {
    // No localStorage entry → normalizeStrategyBrain(null) → null
    const { result } = renderHook(() => useStrategyBrain())

    expect(result.current.brainRulesByStatus).toEqual({
      active: [],
      candidate: [],
      archived: [],
    })
  })

  // --- validationStats ---

  it('validationStats computes correct counts', async () => {
    const { result } = renderHook(() => useStrategyBrain())

    await act(async () => {
      await result.current.updateBrainValidation(OWNER_PORTFOLIO_ID, 'brain-validation-v1', {
        cases: [
          { id: '1', verdict: 'supported' },
          { id: '2', verdict: 'contradicted' },
          { id: '3', verdict: 'supported' },
          { id: '4', verdict: 'mixed' },
        ],
      })
    })

    expect(result.current.validationStats).toEqual({
      total: 4,
      supported: 2,
      contradicted: 1,
      mixed: 1,
    })
  })

  // --- updateStrategyBrain ---

  it('updateStrategyBrain updates state for brain-v1 suffix', async () => {
    const { result } = renderHook(() => useStrategyBrain())

    await act(async () => {
      await result.current.updateStrategyBrain(OWNER_PORTFOLIO_ID, 'brain-v1', {
        rules: [{ id: 'x', text: 'new-rule', status: 'active' }],
      })
    })

    expect(result.current.strategyBrain).toEqual(
      expect.objectContaining({ rules: [{ id: 'x', text: 'new-rule', status: 'active' }] })
    )
  })

  it('updateStrategyBrain ignores non-brain-v1 suffix', async () => {
    const { result } = renderHook(() => useStrategyBrain())
    const before = result.current.strategyBrain

    await act(async () => {
      await result.current.updateStrategyBrain(OWNER_PORTFOLIO_ID, 'other-suffix', {
        rules: [{ id: 'x', text: 'should-not-apply' }],
      })
    })

    expect(result.current.strategyBrain).toBe(before)
  })

  // --- addValidationCase ---

  it('addValidationCase adds a new case to brainValidation', () => {
    const { result } = renderHook(() => useStrategyBrain())

    act(() => {
      result.current.addValidationCase({ id: 'c1', text: 'test', verdict: 'supported' })
    })

    expect(result.current.brainValidation.cases).toContainEqual(
      expect.objectContaining({ id: 'c1', verdict: 'supported' })
    )
  })

  it('addValidationCase ignores duplicates by id', () => {
    const { result } = renderHook(() => useStrategyBrain())

    act(() => {
      result.current.addValidationCase({ id: 'c1', text: 'test', verdict: 'supported' })
    })

    act(() => {
      result.current.addValidationCase({ id: 'c1', text: 'test', verdict: 'supported' })
    })

    expect(result.current.brainValidation.cases).toHaveLength(1)
  })

  it('addValidationCase ignores null input', () => {
    const { result } = renderHook(() => useStrategyBrain())
    const before = result.current.brainValidation

    act(() => {
      result.current.addValidationCase(null)
    })

    expect(result.current.brainValidation).toBe(before)
  })

  // --- syncBrainFromCloud ---

  it('syncBrainFromCloud returns null when canUseCloud is false', async () => {
    const { result } = renderHook(() => useStrategyBrain({ canUseCloud: false }))

    const data = await act(async () => {
      return result.current.syncBrainFromCloud()
    })

    expect(data).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('syncBrainFromCloud fetches and updates brain when canUseCloud is true', async () => {
    const brainPayload = { rules: [{ id: 'r1', text: 'fetched', status: 'active' }] }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: brainPayload }),
    })

    const { result } = renderHook(() => useStrategyBrain({ canUseCloud: true }))

    await act(async () => {
      await result.current.syncBrainFromCloud()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-brain' }),
    })

    expect(result.current.strategyBrain).toEqual(
      expect.objectContaining({ rules: [{ id: 'r1', text: 'fetched', status: 'active' }] })
    )
  })

  it('syncBrainFromCloud returns null on fetch failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useStrategyBrain({ canUseCloud: true }))

    const data = await act(async () => {
      return result.current.syncBrainFromCloud()
    })

    expect(data).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('Failed to sync brain from cloud:', expect.any(Error))
    warnSpy.mockRestore()
  })

  // --- saveBrainToCloud ---

  it('saveBrainToCloud does nothing when canUseCloud is false', async () => {
    const { result } = renderHook(() => useStrategyBrain({ canUseCloud: false }))

    await act(async () => {
      await result.current.saveBrainToCloud({ rules: [] })
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('saveBrainToCloud sends brain data to cloud', async () => {
    const setSaved = vi.fn()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const { result } = renderHook(() => useStrategyBrain({ canUseCloud: true, setSaved }))

    await act(async () => {
      await result.current.saveBrainToCloud({ rules: [{ id: 'r1' }] })
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-brain', data: { rules: [{ id: 'r1' }] } }),
    })
  })

  // --- updateBrainAudit ---

  it('updateBrainAudit merges audit data', () => {
    const { result } = renderHook(() => useStrategyBrain())

    act(() => {
      result.current.updateBrainAudit({
        validatedRules: [{ ruleId: 'r1' }],
        staleRules: [],
        invalidatedRules: [],
      })
    })

    expect(result.current.brainAudit.validatedRules).toEqual([{ ruleId: 'r1' }])
    expect(result.current.auditStats.validated).toBe(1)
  })

  it('updateBrainAudit ignores null input', () => {
    const { result } = renderHook(() => useStrategyBrain())
    const before = result.current.brainAudit

    act(() => {
      result.current.updateBrainAudit(null)
    })

    expect(result.current.brainAudit).toBe(before)
  })
})
