import { describe, expect, it } from 'vitest'
import {
  APP_RUNTIME_CORE_LIFECYCLE_HELPERS,
  APP_RUNTIME_WORKFLOW_HELPERS,
} from '../../src/hooks/useAppRuntimeHelperCatalog.js'

describe('hooks/useAppRuntimeHelperCatalog', () => {
  it('exposes core lifecycle helpers required by runtime core hook', () => {
    expect(typeof APP_RUNTIME_CORE_LIFECYCLE_HELPERS.normalizeHoldings).toBe('function')
    expect(typeof APP_RUNTIME_CORE_LIFECYCLE_HELPERS.loadPortfolioSnapshot).toBe('function')
    expect(typeof APP_RUNTIME_CORE_LIFECYCLE_HELPERS.normalizeWatchlist).toBe('function')
  })

  it('exposes workflow helpers with override-safe fundamental draft factory', () => {
    expect(typeof APP_RUNTIME_WORKFLOW_HELPERS.formatEventStockOutcomeLine).toBe('function')
    expect(typeof APP_RUNTIME_WORKFLOW_HELPERS.createDefaultFundamentalDraft).toBe('function')

    const withOverride = APP_RUNTIME_WORKFLOW_HELPERS.createDefaultFundamentalDraft({
      customField: 'ok',
    })
    const withoutOverride = APP_RUNTIME_WORKFLOW_HELPERS.createDefaultFundamentalDraft()

    expect(withOverride.customField).toBe('ok')
    expect(withoutOverride.customField).toBeUndefined()
  })
})
