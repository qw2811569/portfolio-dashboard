import { describe, expect, it } from 'vitest'
import {
  VIEW_MODE_RULES,
  resolveViewMode,
  isViewModeEnabled,
} from '../../src/lib/viewModeContract.js'

describe('viewModeContract', () => {
  it('resolves 7865 portfolio to insider-compressed', () => {
    expect(resolveViewMode({ portfolio: { id: '7865' }, currentUser: 'me' })).toBe(
      'insider-compressed'
    )
  })

  it('resolves live 金聯成 aliases to insider-compressed even with random ids', () => {
    expect(
      resolveViewMode({ portfolio: { id: 'p-random', name: '金聯成' }, currentUser: 'me' })
    ).toBe('insider-compressed')
    expect(
      resolveViewMode({
        portfolio: { id: 'p-random', displayName: '金聯成組合' },
        currentUser: 'me',
      })
    ).toBe('insider-compressed')
  })

  it('resolves me portfolio to owner when current user matches owner', () => {
    expect(resolveViewMode({ portfolio: { id: 'me', isOwner: true }, currentUser: 'me' })).toBe(
      'owner'
    )
  })

  it('resolves me portfolio to retail when current user is different', () => {
    expect(resolveViewMode({ portfolio: { id: 'me', isOwner: true }, currentUser: 'other' })).toBe(
      'retail'
    )
  })

  it('exposes insider-compressed rule toggles for aggregate-only surfaces', () => {
    expect(isViewModeEnabled('showPerStockDiff', 'insider-compressed')).toBe(false)
    expect(VIEW_MODE_RULES.showComplianceNote['insider-compressed']).toBe(true)
  })
})
