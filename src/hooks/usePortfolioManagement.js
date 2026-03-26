import { useState, useMemo, useCallback, useRef } from "react";
import {
  OWNER_PORTFOLIO_ID,
  OVERVIEW_VIEW_MODE,
  PORTFOLIOS_KEY,
  ACTIVE_PORTFOLIO_KEY,
  VIEW_MODE_KEY,
  PORTFOLIO_STORAGE_FIELDS,
  PORTFOLIO_SUFFIX_TO_FIELD,
  PORTFOLIO_VIEW_MODE,
} from "../constants.js";
import {
  todayStorageDate,
  pfKey,
  save,
  getHoldingCostBasis,
  getHoldingMarketValue,
  applyMarketQuotesToHoldings,
  clonePortfolioNotes,
  normalizeNewsEvents,
} from "../utils.js";

/**
 * Read a value from localStorage
 */
function readStorageValue(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Get fallback value for a portfolio field
 */
function getPortfolioFallback(pid, suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  if (!field) return null;
  return (pid === OWNER_PORTFOLIO_ID ? field.ownerFallback : field.emptyFallback)();
}

/**
 * Remove all data for a portfolio
 */
function removePortfolioData(pid) {
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    try { localStorage.removeItem(pfKey(pid, field.suffix)); } catch {}
  }
}

/**
 * Portfolio Management Hook
 * 
 * Manages portfolio state, switching, creation, renaming, and deletion.
 * Also handles overview mode toggling.
 */
export const usePortfolioManagement = ({
  ready = false,
  initialPortfolios = [],
  initialActivePortfolioId = OWNER_PORTFOLIO_ID,
  initialViewMode = PORTFOLIO_VIEW_MODE,
  activeHoldings = [],
  activeNewsEvents = [],
  activePortfolioNotes = {},
  marketPriceCache = null,
  flushCurrentPortfolio = async () => {},
  resetTransientUiState = () => {},
  loadPortfolio = async () => {},
  setSaved = () => {},
} = {}) => {
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [activePortfolioId, setActivePortfolioId] = useState(initialActivePortfolioId);
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [portfolioSwitching, setPortfolioSwitching] = useState(false);
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);

  const portfolioTransitionRef = useRef({
    isHydrating: false,
    fromPid: initialActivePortfolioId,
    toPid: initialActivePortfolioId,
  });

  /**
   * Get snapshot of a portfolio's data
   */
  const getPortfolioSnapshot = useCallback((portfolioId) => {
    const useLiveState = viewMode === PORTFOLIO_VIEW_MODE && portfolioId === activePortfolioId;
    const holdingsValue = useLiveState ? activeHoldings : readStorageValue(pfKey(portfolioId, "holdings-v2"));
    const eventsValue = useLiveState ? activeNewsEvents : readStorageValue(pfKey(portfolioId, "news-events-v1"));
    const notesValue = useLiveState ? activePortfolioNotes : readStorageValue(pfKey(portfolioId, "notes-v1"));

    return {
      holdings: applyMarketQuotesToHoldings(
        Array.isArray(holdingsValue) ? holdingsValue : getPortfolioFallback(portfolioId, "holdings-v2"),
        marketPriceCache?.prices
      ),
      newsEvents: normalizeNewsEvents(Array.isArray(eventsValue) ? eventsValue : getPortfolioFallback(portfolioId, "news-events-v1")),
      notes: notesValue && typeof notesValue === "object" ? { ...clonePortfolioNotes(), ...notesValue } : clonePortfolioNotes(),
    };
  }, [viewMode, activePortfolioId, activeHoldings, activeNewsEvents, activePortfolioNotes, marketPriceCache]);

  /**
   * Calculate portfolio summaries with metrics
   */
  const portfolioSummaries = useMemo(() => {
    if (!portfolios) return [];
    return portfolios.map(portfolio => {
      const snapshot = getPortfolioSnapshot(portfolio.id);
      const rows = snapshot.holdings;
      const holdingCount = Array.isArray(rows) ? rows.length : 0;
      const portfolioValue = (rows || []).reduce((sum, item) => sum + getHoldingMarketValue(item), 0);
      const portfolioCost = (rows || []).reduce((sum, item) => sum + getHoldingCostBasis(item), 0);
      const portfolioPnl = portfolioValue - portfolioCost;
      const portfolioRetPct = portfolioCost > 0 ? (portfolioPnl / portfolioCost) * 100 : 0;
      return {
        ...portfolio,
        holdingCount,
        totalValue: portfolioValue,
        totalPnl: portfolioPnl,
        retPct: portfolioRetPct,
      };
    });
  }, [portfolios, getPortfolioSnapshot]);

  /**
   * Switch to a different portfolio
   */
  const switchPortfolio = useCallback(async (pid) => {
    if (!pid || portfolioSwitching) return;
    if (pid === activePortfolioId && viewMode === PORTFOLIO_VIEW_MODE) return;

    setPortfolioSwitching(true);
    portfolioTransitionRef.current = { isHydrating: true, fromPid: activePortfolioId, toPid: pid };

    try {
      await flushCurrentPortfolio();
      resetTransientUiState();
      await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
      await save(ACTIVE_PORTFOLIO_KEY, pid);
      await loadPortfolio(pid, PORTFOLIO_VIEW_MODE);
    } catch (err) {
      console.error("組合切換失敗:", err);
      setSaved("❌ 組合切換失敗");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = { isHydrating: false, fromPid: pid, toPid: pid };
      setPortfolioSwitching(false);
    }
  }, [activePortfolioId, viewMode, portfolioSwitching, flushCurrentPortfolio, resetTransientUiState, loadPortfolio, setSaved]);

  /**
   * Create a new portfolio
   */
  const createPortfolio = useCallback(async () => {
    const rawName = window.prompt("新組合名稱");
    const name = rawName?.trim();
    if (!name) return;

    const newPf = {
      id: `p-${Date.now().toString(36)}`,
      name,
      isOwner: false,
      createdAt: todayStorageDate(),
    };
    const nextPortfolios = [...portfolios, newPf];

    setPortfolios(nextPortfolios);
    await save(PORTFOLIOS_KEY, nextPortfolios);
    await Promise.all(
      PORTFOLIO_STORAGE_FIELDS.map(field => save(pfKey(newPf.id, field.suffix), getPortfolioFallback(newPf.id, field.suffix)))
    );
    await switchPortfolio(newPf.id);
    setSaved(`✅ 已新增組合「${name}」`);
    setTimeout(() => setSaved(""), 3000);
  }, [portfolios, switchPortfolio, setSaved]);

  /**
   * Rename a portfolio
   */
  const renamePortfolio = useCallback(async (pid) => {
    const current = portfolios.find(item => item.id === pid);
    if (!current) return;
    const rawName = window.prompt("新的組合名稱", current.name);
    const name = rawName?.trim();
    if (!name || name === current.name) return;

    const nextPortfolios = portfolios.map(item => item.id === pid ? { ...item, name } : item);
    setPortfolios(nextPortfolios);
    await save(PORTFOLIOS_KEY, nextPortfolios);
    setSaved(`✅ 已更新組合名稱為「${name}」`);
    setTimeout(() => setSaved(""), 3000);
  }, [portfolios, setSaved]);

  /**
   * Delete a portfolio
   */
  const deletePortfolio = useCallback(async (pid) => {
    const current = portfolios.find(item => item.id === pid);
    if (!current || pid === OWNER_PORTFOLIO_ID) return;
    if (!window.confirm(`確定要刪除組合「${current.name}」？這會清掉該組合的本機資料。`)) return;

    let nextPid = activePortfolioId;
    setPortfolioSwitching(true);
    portfolioTransitionRef.current = { isHydrating: true, fromPid: activePortfolioId, toPid: activePortfolioId };

    try {
      if (viewMode === PORTFOLIO_VIEW_MODE && pid === activePortfolioId) {
        await flushCurrentPortfolio(pid);
      }

      removePortfolioData(pid);
      const nextPortfolios = portfolios.filter(item => item.id !== pid);
      nextPid = nextPortfolios.some(item => item.id === OWNER_PORTFOLIO_ID)
        ? OWNER_PORTFOLIO_ID
        : nextPortfolios[0]?.id || OWNER_PORTFOLIO_ID;

      setPortfolios(nextPortfolios);
      await save(PORTFOLIOS_KEY, nextPortfolios);

      if (pid === activePortfolioId) {
        await switchPortfolio(nextPid);
      }

      setSaved(`✅ 已刪除組合「${current.name}」`);
      setTimeout(() => setSaved(""), 3000);
    } catch (err) {
      console.error("刪除組合失敗:", err);
      setSaved("❌ 刪除組合失敗");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = { isHydrating: false, fromPid: nextPid, toPid: nextPid };
      setPortfolioSwitching(false);
    }
  }, [portfolios, activePortfolioId, viewMode, flushCurrentPortfolio, switchPortfolio, setSaved]);

  /**
   * Enter overview mode (read-only view of all portfolios)
   */
  const openOverview = useCallback(async () => {
    if (portfolioSwitching || viewMode === OVERVIEW_VIEW_MODE) return;
    setPortfolioSwitching(true);
    portfolioTransitionRef.current = { isHydrating: true, fromPid: activePortfolioId, toPid: activePortfolioId };
    try {
      await flushCurrentPortfolio();
      resetTransientUiState();
      setViewMode(OVERVIEW_VIEW_MODE);
      await save(VIEW_MODE_KEY, OVERVIEW_VIEW_MODE);
    } finally {
      portfolioTransitionRef.current = { isHydrating: false, fromPid: activePortfolioId, toPid: activePortfolioId };
      setPortfolioSwitching(false);
    }
  }, [activePortfolioId, flushCurrentPortfolio, portfolioSwitching, resetTransientUiState, viewMode]);

  /**
   * Exit overview mode and return to portfolio view
   */
  const exitOverview = useCallback(async () => {
    if (portfolioSwitching || viewMode !== OVERVIEW_VIEW_MODE) return;
    await switchPortfolio(activePortfolioId);
  }, [activePortfolioId, portfolioSwitching, switchPortfolio, viewMode]);

  return {
    portfolios, setPortfolios,
    activePortfolioId, setActivePortfolioId,
    viewMode, setViewMode,
    portfolioSwitching,
    showPortfolioManager, setShowPortfolioManager,
    portfolioTransitionRef,
    portfolioSummaries,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    switchPortfolio,
    openOverview,
    exitOverview,
  };
};
