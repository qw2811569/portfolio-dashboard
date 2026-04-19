import { describe, expect, it } from 'vitest'
import { INIT_HOLDINGS } from '../../src/seedData.js'
import { INIT_HOLDINGS_JINLIANCHENG } from '../../src/seedDataJinliancheng.js'
import { resolveViewMode } from '../../src/lib/viewModeContract.js'
import { diffHoldingCodes, getPersonaFixture, sortHoldingCodes } from '../e2e/personaFixtures.mjs'

function holdingCodes(rows = []) {
  return sortHoldingCodes((Array.isArray(rows) ? rows : []).map((item) => item?.code))
}

describe('persona canonical contract', () => {
  it('keeps owner seed aligned with the me canonical fixture', () => {
    const persona = getPersonaFixture('me')
    const actual = holdingCodes(INIT_HOLDINGS)
    const expected = sortHoldingCodes(persona.canonicalHoldings)

    expect(diffHoldingCodes(actual, expected)).toEqual({ missing: [], extra: [] })
    expect(actual).toEqual(expected)
  })

  it('keeps jinliancheng seed aligned with the 7865 canonical fixture', () => {
    const persona = getPersonaFixture('7865')
    const actual = holdingCodes(INIT_HOLDINGS_JINLIANCHENG)
    const expected = sortHoldingCodes(persona.canonicalHoldings)

    expect(diffHoldingCodes(actual, expected)).toEqual({ missing: [], extra: [] })
    expect(actual).toEqual(expected)
  })

  it('keeps canonical viewMode metadata aligned with resolver expectations', () => {
    const ownerPersona = getPersonaFixture('me')
    expect(
      resolveViewMode({
        portfolio: { id: ownerPersona.portfolioId, custId: ownerPersona.custId, isOwner: true },
        currentUser: ownerPersona.custId,
      })
    ).toBe(ownerPersona.viewMode)

    const insiderPersona = getPersonaFixture('7865')
    expect(
      resolveViewMode({
        portfolio: { id: 'p-seeded-jinliancheng', custId: insiderPersona.custId, name: '金聯成' },
        currentUser: ownerPersona.custId,
      })
    ).toBe(insiderPersona.viewMode)
  })
})
