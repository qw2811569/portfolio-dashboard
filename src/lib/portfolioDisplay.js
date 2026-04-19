const PORTFOLIO_LABEL_BY_ALIAS = new Map([
  ['jinliancheng', '金聯成組合'],
  ['金聯成', '金聯成組合'],
  ['金聯成組合', '金聯成組合'],
  ['me', '小奎主要投資'],
  ['ajoe734', '小奎主要投資'],
  ['我', '小奎主要投資'],
  ['主組合', '小奎主要投資'],
  ['小奎主要投資', '小奎主要投資'],
])

function normalizeCandidate(value) {
  return String(value || '').trim()
}

function normalizeAliasKey(value) {
  return normalizeCandidate(value).toLowerCase()
}

function isInternalPortfolioToken(value) {
  const normalized = normalizeCandidate(value)
  if (!normalized) return false

  return (
    /\bP-[A-Z0-9]+\b/i.test(normalized) ||
    /\bpf[_-][a-z0-9_-]+\b/i.test(normalized) ||
    /\bportfolio[_-][a-z0-9_-]+\b/i.test(normalized) ||
    /\buser-[a-z0-9_-]+\b/i.test(normalized)
  )
}

function resolveKnownPortfolioLabel(value) {
  const normalized = normalizeCandidate(value)
  if (!normalized) return ''
  return PORTFOLIO_LABEL_BY_ALIAS.get(normalizeAliasKey(normalized)) || ''
}

export function displayPortfolioName(portfolio) {
  const source =
    portfolio && typeof portfolio === 'object'
      ? portfolio
      : portfolio != null
        ? { id: portfolio }
        : {}

  const displayName = resolveKnownPortfolioLabel(source.displayName)
  if (displayName) return displayName

  const name = normalizeCandidate(source.name)
  const knownName = resolveKnownPortfolioLabel(name)
  if (knownName) return knownName
  if (name && !isInternalPortfolioToken(name)) return name

  const idCandidates = [source.id, source.portfolioId, source.pid, source.slug, source.alias]
  for (const candidate of idCandidates) {
    const knownLabel = resolveKnownPortfolioLabel(candidate)
    if (knownLabel) return knownLabel
  }

  return '投組'
}
