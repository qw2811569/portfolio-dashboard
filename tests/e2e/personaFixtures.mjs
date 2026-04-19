import canonicalPersonas from './persona-canonical.json' with { type: 'json' }

const PERSONA_SELECTIONS = {
  me: {
    portfolioId: 'me',
    portfolioLabels: ['小奎主要投資', '我'],
  },
  7865: {
    portfolioId: '7865',
    portfolioLabels: ['金聯成組合', '金聯成'],
  },
}

function normalizeCodes(codes = []) {
  return Array.from(
    new Set((Array.isArray(codes) ? codes : []).map((code) => String(code).trim()))
  ).filter(Boolean)
}

export function sortHoldingCodes(codes = []) {
  return [...normalizeCodes(codes)].sort((left, right) => left.localeCompare(right, 'en'))
}

export function diffHoldingCodes(actualCodes = [], expectedCodes = []) {
  const actual = new Set(normalizeCodes(actualCodes))
  const expected = new Set(normalizeCodes(expectedCodes))

  return {
    missing: [...expected]
      .filter((code) => !actual.has(code))
      .sort((left, right) => left.localeCompare(right, 'en')),
    extra: [...actual]
      .filter((code) => !expected.has(code))
      .sort((left, right) => left.localeCompare(right, 'en')),
  }
}

export function getPersonaFixture(personaId) {
  const fixture = canonicalPersonas?.[personaId]
  if (!fixture) throw new Error(`missing persona canonical fixture for "${personaId}"`)

  const selection = PERSONA_SELECTIONS[personaId] || {
    portfolioId: String(personaId || ''),
    portfolioLabels: [String(personaId || '')],
  }

  const portfolioLabels = Array.from(
    new Set(
      [...(selection.portfolioLabels || []), personaId, fixture.custId]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )

  return {
    personaId: String(personaId),
    custId: String(fixture.custId || personaId),
    viewMode: String(fixture.viewMode || ''),
    canonicalHoldings: normalizeCodes(fixture.canonical_holdings),
    portfolioId: String(selection.portfolioId || personaId),
    portfolioLabel: String(portfolioLabels[0] || personaId),
    portfolioLabels,
  }
}

export { canonicalPersonas }
