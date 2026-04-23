import {
  ACTIVE_PORTFOLIO_KEY,
  DEFAULT_CANONICAL_PORTFOLIO_TAB,
  OWNER_PORTFOLIO_ID,
} from '../constants.js'
import { buildPortfolioTabs } from './navigationTabs.js'

const PERSISTED_TAB_KEY_SUFFIX = 'last-active-tab-v1'
const PERSISTABLE_TAB_KEYS = new Set(
  buildPortfolioTabs()
    .map((tab) => tab?.k)
    .filter((key) => key && key !== 'overview')
)

function safeGetStorageItem(key) {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function normalizePortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  return normalized || OWNER_PORTFOLIO_ID
}

export function buildLastActiveTabStorageKey(portfolioId = OWNER_PORTFOLIO_ID) {
  return `pf-${normalizePortfolioId(portfolioId)}-${PERSISTED_TAB_KEY_SUFFIX}`
}

export function isPersistablePortfolioTab(tabKey) {
  return PERSISTABLE_TAB_KEYS.has(String(tabKey || '').trim())
}

export function readPersistedTabForPortfolio(
  portfolioId,
  fallback = DEFAULT_CANONICAL_PORTFOLIO_TAB
) {
  const storedValue = safeGetStorageItem(buildLastActiveTabStorageKey(portfolioId))
  return isPersistablePortfolioTab(storedValue) ? storedValue : fallback
}

export function readActivePortfolioIdForTabPersistence() {
  const raw = safeGetStorageItem(ACTIVE_PORTFOLIO_KEY)
  if (raw == null) return OWNER_PORTFOLIO_ID

  try {
    return normalizePortfolioId(JSON.parse(raw))
  } catch {
    return normalizePortfolioId(raw)
  }
}

export function writePersistedTabForPortfolio(portfolioId, tabKey) {
  if (typeof localStorage === 'undefined' || !isPersistablePortfolioTab(tabKey)) return false

  try {
    localStorage.setItem(buildLastActiveTabStorageKey(portfolioId), String(tabKey))
    return true
  } catch {
    return false
  }
}

export function removePersistedTabForPortfolio(portfolioId) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.removeItem(buildLastActiveTabStorageKey(portfolioId))
  } catch {
    // best-effort local cleanup
  }
}
