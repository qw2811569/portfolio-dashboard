/**
 * Market Data Hook
 * 
 * Manages market price cache, sync operations, and TWSE data fetching.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import {
  MARKET_PRICE_CACHE_KEY,
  MARKET_PRICE_SYNC_KEY,
  MARKET_TIMEZONE,
  POST_CLOSE_SYNC_MINUTES,
  PORTFOLIO_VIEW_MODE,
} from "./constants.js";
import {
  createEmptyMarketPriceCache,
  normalizeMarketPriceCache,
  normalizeMarketPriceSync,
  applyMarketQuotesToHoldings,
  canRunPostClosePriceSync,
  parseStoredDate,
  save,
  getTaipeiClock,
} from "./utils.js";

/**
 * Read from localStorage
 */
const readStorageValue = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Extract best price from TWSE item
 */
const extractBestPrice = (item) => {
  if (!item || typeof item !== "object") return null;
  const price = Number(item.z ?? item.dj ?? item.price);
  return Number.isFinite(price) && price > 0 ? price : null;
};

/**
 * Extract yesterday's closing price
 */
const extractYesterday = (item) => {
  if (!item || typeof item !== "object") return null;
  const yesterday = Number(item.y ?? item.yesterday);
  return Number.isFinite(yesterday) && yesterday > 0 ? yesterday : null;
};

/**
 * Get event stock codes
 */
const getEventStockCodes = (event) => {
  if (!event || typeof event !== "object") return [];
  const stocks = String(event.stocks || "").trim();
  if (!stocks) return [];
  return stocks
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const match = s.match(/^(\d{4,6})\s*(.*)$/);
      return match ? match[1] : s;
    });
};

/**
 * Market Data Hook
 * 
 * @param {Object} params
 * @param {string} params.activePortfolioId - Current portfolio ID
 * @param {string} params.viewMode - Current view mode
 * @param {Array} params.holdings - Current holdings
 * @param {Array} params.watchlist - Current watchlist
 * @param {Array} params.newsEvents - Current news events
 * @param {Array} params.portfolios - All portfolios
 * @param {Function} params.setHoldings - Set holdings callback
 * @param {Function} params.setSaved - Show status callback
 * @param {Function} params.setLastUpdate - Set last update callback
 * @returns {Object} Market data state and operations
 */
export const useMarketData = ({
  activePortfolioId,
  viewMode,
  holdings = [],
  watchlist = [],
  newsEvents = [],
  portfolios = [],
  setHoldings = () => {},
  setSaved = () => {},
  setLastUpdate = () => {},
} = {}) => {
  const [marketPriceCache, setMarketPriceCache] = useState(() => 
    normalizeMarketPriceCache(readStorageValue(MARKET_PRICE_CACHE_KEY))
  );
  const [marketPriceSync, setMarketPriceSync] = useState(() => 
    normalizeMarketPriceSync(readStorageValue(MARKET_PRICE_SYNC_KEY))
  );
  const [refreshing, setRefreshing] = useState(false);
  
  const priceSyncInFlightRef = useRef(null);
  const priceSelfHealRef = useRef({});

  /**
   * Persist market price state to localStorage
   */
  const persistMarketPriceState = useCallback(async (cache, syncMeta) => {
    const normalizedCache = normalizeMarketPriceCache(cache);
    const normalizedSync = normalizeMarketPriceSync(syncMeta);
    
    await save(MARKET_PRICE_CACHE_KEY, normalizedCache);
    await save(MARKET_PRICE_SYNC_KEY, normalizedSync);
    
    setMarketPriceCache(normalizedCache);
    setMarketPriceSync(normalizedSync);
    
    const syncedAt = parseStoredDate(normalizedSync?.syncedAt || normalizedCache?.syncedAt);
    if (syncedAt) setLastUpdate(syncedAt);
  }, [setLastUpdate]);

  /**
   * Collect all tracked stock codes from portfolios
   */
  const collectTrackedCodes = useCallback(() => {
    const codeSet = new Set();
    const addCode = (value) => {
      const code = String(value || "").trim();
      if (code) codeSet.add(code);
    };
    const addRows = (rows) => {
      if (!Array.isArray(rows)) return;
      rows.forEach(item => addCode(item?.code));
    };
    const addEvents = (rows) => {
      if (!Array.isArray(rows)) return;
      rows.forEach(event => {
        getEventStockCodes(event).forEach(code => addCode(code));
      });
    };

    portfolios.forEach(portfolio => {
      const useLiveState = viewMode === PORTFOLIO_VIEW_MODE && portfolio.id === activePortfolioId;
      const holdingRows = useLiveState ? holdings : readStorageValue(`pf-${portfolio.id}-holdings-v2`);
      const watchlistRows = useLiveState ? watchlist : readStorageValue(`pf-${portfolio.id}-watchlist-v1`);
      const eventRows = useLiveState ? newsEvents : readStorageValue(`pf-${portfolio.id}-news-events-v1`);
      addRows(holdingRows);
      addRows(watchlistRows);
      addEvents(eventRows);
    });

    return Array.from(codeSet);
  }, [activePortfolioId, viewMode, holdings, watchlist, newsEvents, portfolios]);

  /**
   * Fetch post-close quotes from TWSE
   */
  const fetchPostCloseQuotes = useCallback(async (codes, timeoutMs = 8000) => {
    const normalizedCodes = Array.from(
      new Set((codes || []).map(code => String(code || "").trim()).filter(Boolean))
    );
    
    if (normalizedCodes.length === 0) return { quotes: {}, failedCodes: [] };

    const batchSize = 15;
    const quotes = {};
    const failedCodes = new Set();
    const observedMarketDates = new Set();
    const batches = [];
    
    for (let i = 0; i < normalizedCodes.length; i += batchSize) {
      batches.push(normalizedCodes.slice(i, i + batchSize));
    }

    await Promise.all(batches.map(async (batch, batchIndex) => {
      const queries = batch.flatMap(code => [`tse_${code}.tw`, `otc_${code}.tw`]);
      const exCh = queries.join("|");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`/api/twse?ex_ch=${encodeURIComponent(exCh)}`, { signal: controller.signal });
        const data = await res.json();
        (data.msgArray || []).forEach(item => {
          if (item?.d) observedMarketDates.add(String(item.d));
          const price = extractBestPrice(item);
          const yesterday = extractYesterday(item);
          if (!price || quotes[item.c]) return;
          quotes[item.c] = {
            price,
            yesterday,
            change: yesterday ? price - yesterday : 0,
            changePct: yesterday ? ((price / yesterday) - 1) * 100 : 0,
          };
        });
      } catch (err) {
        batch.forEach(code => failedCodes.add(code));
        console.warn(`收盤價同步批次 ${batchIndex + 1} 失敗:`, err);
      } finally {
        clearTimeout(timer);
      }
    }));

    return {
      quotes,
      failedCodes: Array.from(failedCodes).filter(code => !quotes[code]),
      marketDate: Array.from(observedMarketDates).sort().slice(-1)[0] || null,
    };
  }, []);

  /**
   * Sync post-close prices
   */
  const syncPostClosePrices = useCallback(async ({ silent = false, force = false } = {}) => {
    if (priceSyncInFlightRef.current) return priceSyncInFlightRef.current;

    const task = (async () => {
      const cachedSync = normalizeMarketPriceSync(readStorageValue(MARKET_PRICE_SYNC_KEY)) || marketPriceSync;
      const cachedPrice = normalizeMarketPriceCache(readStorageValue(MARKET_PRICE_CACHE_KEY)) || marketPriceCache;
      const gate = canRunPostClosePriceSync(new Date(), cachedSync);
      const trackedCodes = collectTrackedCodes();
      const missingCachedCodes = trackedCodes.filter(code => !(cachedPrice?.prices?.[code]?.price > 0));
      const allowForcedRetry = force && trackedCodes.length > 0;

      if (!gate.allowed && !allowForcedRetry) {
        if (!silent) {
          if (gate.reason === "before-close") {
            setSaved("⚠️ 收盤價僅在台北時間 13:35 後同步");
          } else if (gate.reason === "market-closed") {
            setSaved("⚠️ 非交易日，沿用最近收盤價");
          } else if (cachedSync?.status === "failed") {
            setSaved("⚠️ 今日已嘗試同步收盤價，沿用既有快取");
          } else {
            setSaved("✅ 今日收盤價已同步，避免重複抓取");
          }
          setTimeout(() => setSaved(""), 3000);
        }
        if (cachedPrice?.prices && viewMode === PORTFOLIO_VIEW_MODE) {
          setHoldings(prev => applyMarketQuotesToHoldings(prev, cachedPrice.prices));
        }
        return cachedPrice;
      }

      if (trackedCodes.length === 0) {
        if (!silent) {
          setSaved("⚠️ 目前沒有可同步的股票代碼");
          setTimeout(() => setSaved(""), 3000);
        }
        return cachedPrice;
      }

      const syncedAt = new Date().toISOString();
      const { quotes, failedCodes, marketDate: observedMarketDate } = await fetchPostCloseQuotes(trackedCodes);
      const resolvedMarketDate = observedMarketDate || gate.clock.marketDate;
      
      if (Object.keys(quotes).length === 0) {
        const failedMeta = {
          marketDate: resolvedMarketDate,
          syncedAt,
          status: "failed",
          codes: trackedCodes,
          failedCodes,
        };
        await persistMarketPriceState(cachedPrice || createEmptyMarketPriceCache(), failedMeta);
        if (!silent) {
          setSaved("⚠️ 今日收盤價同步失敗，沿用既有快取");
          setTimeout(() => setSaved(""), 3000);
        }
        return cachedPrice;
      }

      const nextCache = {
        ...(cachedPrice || createEmptyMarketPriceCache()),
        marketDate: resolvedMarketDate,
        syncedAt,
        source: "twse",
        status: failedCodes.length > 0 ? "partial" : "success",
        prices: { ...cachedPrice?.prices, ...quotes },
      };

      const nextSync = {
        marketDate: resolvedMarketDate,
        syncedAt,
        status: failedCodes.length > 0 ? "partial" : "success",
        codes: trackedCodes,
        failedCodes,
      };

      await persistMarketPriceState(nextCache, nextSync);
      
      if (viewMode === PORTFOLIO_VIEW_MODE) {
        setHoldings(prev => applyMarketQuotesToHoldings(prev, nextCache.prices));
      }

      if (!silent) {
        if (failedCodes.length > 0) {
          setSaved(`✅ 收盤價已同步（${failedCodes.length} 檔失敗）`);
        } else {
          setSaved("✅ 收盤價已同步");
        }
        setTimeout(() => setSaved(""), 3000);
      }

      return nextCache;
    })();

    priceSyncInFlightRef.current = task;
    try {
      return await task;
    } finally {
      priceSyncInFlightRef.current = null;
    }
  }, [marketPriceCache, marketPriceSync, collectTrackedCodes, persistMarketPriceState, viewMode, setHoldings, setSaved]);

  /**
   * Refresh prices manually
   */
  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncPostClosePrices({ silent: false, force: true });
    } finally {
      setRefreshing(false);
    }
  }, [syncPostClosePrices]);

  /**
   * Get price sync status label
   */
  const priceSyncStatusLabel = useMemo(() => {
    if (!marketPriceSync) return "未同步";
    if (marketPriceSync.status === "failed") return "同步失敗";
    if (marketPriceSync.status === "partial") return "部分成功";
    if (marketPriceSync.status === "success") return "已同步";
    return "未同步";
  }, [marketPriceSync]);

  /**
   * Get price sync status tone
   */
  const priceSyncStatusTone = useMemo(() => {
    if (!marketPriceSync) return "#888";
    if (marketPriceSync.status === "failed") return "#ef4444";
    if (marketPriceSync.status === "partial") return "#f59e0b";
    if (marketPriceSync.status === "success") return "#22c55e";
    return "#888";
  }, [marketPriceSync]);

  /**
   * Get active price sync time
   */
  const activePriceSyncAt = useMemo(() => {
    if (!marketPriceSync?.syncedAt) return null;
    return parseStoredDate(marketPriceSync.syncedAt);
  }, [marketPriceSync]);

  /**
   * Get last update time
   */
  const lastUpdate = useMemo(() => {
    if (!marketPriceCache?.syncedAt) return null;
    return parseStoredDate(marketPriceCache.syncedAt);
  }, [marketPriceCache]);

  return {
    // State
    marketPriceCache,
    marketPriceSync,
    refreshing,
    
    // Status
    priceSyncStatusLabel,
    priceSyncStatusTone,
    activePriceSyncAt,
    lastUpdate,
    
    // Operations
    refreshPrices,
    syncPostClosePrices,
    persistMarketPriceState,
    collectTrackedCodes,
    fetchPostCloseQuotes,
    
    // Refs
    priceSyncInFlightRef,
    priceSelfHealRef,
  };
};
