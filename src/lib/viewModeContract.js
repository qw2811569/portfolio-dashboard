import { INSIDER_COMPLIANCE_COPY } from './insiderCopy.js'

const VIEW_MODES = {
  OWNER: 'owner',
  RETAIL: 'retail',
  INSIDER_COMPRESSED: 'insider-compressed',
}

export const INSIDER_LIST = ['7865', 'jinliancheng', '金聯成', '金聯成組合']

const INSIDER_SET = new Set(
  INSIDER_LIST.map((value) =>
    String(value || '')
      .trim()
      .toLowerCase()
  ).filter(Boolean)
)

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function getPortfolioIdentifiers(portfolio = null) {
  return [
    portfolio?.custId,
    portfolio?.portfolioId,
    portfolio?.id,
    portfolio?.name,
    portfolio?.displayName,
    portfolio?.portfolioLabel,
    portfolio?.label,
    portfolio?.owner,
    portfolio?.ownerId,
  ]
    .map(normalizeId)
    .filter(Boolean)
}

function isInsiderPortfolio(portfolio = null) {
  const type = normalizeId(portfolio?.type)
  const complianceMode = normalizeId(portfolio?.complianceMode || portfolio?.compliance_mode)

  if (type === 'insider' || complianceMode === 'insider') {
    return true
  }

  return getPortfolioIdentifiers(portfolio).some((value) => INSIDER_SET.has(value))
}

/**
 * viewMode 決定 UI render 策略：
 *   - 'owner'                 · 投組擁有者 · 看全部詳版
 *   - 'retail'                · 非 insider 一般用戶 · 看全部詳版 · 但合規弱限制
 *   - 'insider-compressed'    · insider portfolio (例 7865) · 壓縮版 · aggregate only
 *
 * 判定邏輯：
 *   若 portfolio.type === 'insider' OR portfolio.custId in INSIDER_LIST
 *     → 'insider-compressed'
 *   else if currentUser === portfolio.owner
 *     → 'owner'
 *   else
 *     → 'retail'
 */
export function resolveViewMode({ portfolio = null, currentUser = '' } = {}) {
  if (isInsiderPortfolio(portfolio)) {
    return VIEW_MODES.INSIDER_COMPRESSED
  }

  const normalizedCurrentUser = normalizeId(currentUser)
  const portfolioId = normalizeId(portfolio?.custId || portfolio?.portfolioId || portfolio?.id)
  const ownerCandidates = new Set(
    [portfolio?.owner, portfolio?.ownerId, portfolio?.userId].map(normalizeId).filter(Boolean)
  )

  if (portfolio?.isOwner && portfolioId) {
    ownerCandidates.add(portfolioId)
  }

  return normalizedCurrentUser && ownerCandidates.has(normalizedCurrentUser)
    ? VIEW_MODES.OWNER
    : VIEW_MODES.RETAIL
}

/**
 * 每個 UI surface 依 viewMode 決定 rendering：
 *   - holdings detail diff: owner / retail yes · insider no
 *   - daily per-stock: owner / retail yes · insider no (aggregate only)
 *   - research pillar diff: owner / retail yes · insider aggregate only
 *   - news per-ticker side notes: owner / retail yes · insider aggregate clusters
 *   - compliance note: insider always show
 */
export const VIEW_MODE_RULES = {
  showPerStockDiff: { owner: true, retail: true, 'insider-compressed': false },
  showPillarDiff: { owner: true, retail: true, 'insider-compressed': false },
  showTickerSideNotes: { owner: true, retail: true, 'insider-compressed': false },
  showComplianceNote: { owner: false, retail: false, 'insider-compressed': true },
  showValuationDetail: { owner: true, retail: true, 'insider-compressed': false },
  showResearchDiff: { owner: true, retail: true, 'insider-compressed': false },
  showAggregateNarrative: { owner: false, retail: false, 'insider-compressed': true },
}

export function isViewModeEnabled(ruleName, viewMode) {
  return Boolean(VIEW_MODE_RULES[ruleName]?.[viewMode])
}

export function getViewModeComplianceMessage(viewMode, portfolioLabel = '') {
  if (!isViewModeEnabled('showComplianceNote', viewMode)) return ''
  const label = String(portfolioLabel || '').trim()
  return `${label || '這組'} 目前是合規壓縮檢視 · ${INSIDER_COMPLIANCE_COPY.B}`
}

export { VIEW_MODES }
