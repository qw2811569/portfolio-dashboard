import {
  DEFAULT_FUNDAMENTAL_DRAFT,
  DEFAULT_NEW_EVENT,
  DEFAULT_PORTFOLIO_NOTES,
  DEFAULT_REVIEW_FORM,
  INIT_HOLDINGS,
  INIT_TARGETS,
  INIT_WATCHLIST,
  NEWS_EVENTS,
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_SUFFIX_TO_FIELD
} from "./constants.js";

export function todayStorageDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeAnalysisHistoryEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const byKey = new Map();
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const normalizedEntry = normalizeDailyReportEntry(entry);
    const key = entry.date ? `date:${entry.date}` : `id:${entry.id ?? Math.random()}`;
    const prev = byKey.get(key);
    const entryId = Number(normalizedEntry?.id) || 0;
    const prevId = Number(prev?.id) || 0;
    if (!prev || entryId >= prevId) {
      byKey.set(key, normalizedEntry);
    }
  });
  return Array.from(byKey.values())
    .sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0))
    .slice(0, 30);
}

export function normalizeDailyReportEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    eventAssessments: Array.isArray(value.eventAssessments) ? value.eventAssessments : [],
  };
}

export function buildHoldingPriceHints({ analysisHistory = [], fallbackRows = [] } = {}) {
  const hints = {};
  normalizeAnalysisHistoryEntries(analysisHistory).forEach(report => {
    (Array.isArray(report?.changes) ? report.changes : []).forEach(change => {
      const code = String(change?.code || "").trim();
      const price = Number(change?.price);
      if (!code || !Number.isFinite(price) || price <= 0 || hints[code]) return;
      hints[code] = price;
    });
  });

  return hints;
}

export function getHoldingCostBasis(item) {
  if (!item || typeof item !== "object") return 0;
  return (Number(item?.cost) || 0) * (Number(item?.qty) || 0);
}

export function resolveHoldingPrice(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  const storedPrice = Number(item?.price);
  if (Number.isFinite(storedPrice) && storedPrice > 0) return storedPrice;

  const qty = Number(item?.qty) || 0;
  const storedValue = Number(item?.value);
  if (qty > 0 && Number.isFinite(storedValue) && storedValue > 0) {
    return storedValue / qty;
  }

  if (overridePrice != null) {
    const candidate = Number(overridePrice);
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }

  return 0;
}

export function getHoldingMarketValue(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  const price = resolveHoldingPrice(item, overridePrice);
  return price * (Number(item?.qty) || 0);
}

export function getHoldingUnrealizedPnl(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  return (price * qty) - (cost * qty);
}

export function getHoldingReturnPct(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  const costBasis = cost * qty;
  if (costBasis <= 0) return 0;
  return ((price * qty - costBasis) / costBasis) * 100;
}

export function normalizeHoldingMetrics(item, overridePrice = null) {
  if (!item || typeof item !== "object") return item;
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  const value = price * qty;
  const pnl = value - cost * qty;
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  return {
    ...item,
    price,
    value: Math.round(value),
    pnl: Math.round(pnl),
    pct: Math.round(pct * 100) / 100,
  };
}

export function normalizeHoldingRow(item, overridePrice = null) {
  if (!item || typeof item !== "object") return null;
  const code = String(item.code || "").trim();
  if (!code) return null;
  const qty = Number(item.qty) || 0;
  const cost = Number(item.cost) || 0;
  const targetPrice = Number(item.targetPrice);
  const normalized = normalizeHoldingMetrics({
    ...item,
    code,
    name: String(item.name || code).trim() || code,
    qty,
    cost,
    type: item.type || "股票",
    alert: item.alert || "",
    expire: item.expire || null,
  }, overridePrice);
  return {
    ...normalized,
    targetPrice: Number.isFinite(targetPrice) ? targetPrice : null,
    integrityIssue: qty > 0 && normalized.price <= 0 ? "missing-price" : null,
  };
}

export function normalizeHoldings(rows, quotes = null, priceHints = null) {
  const priceQuotes = quotes && typeof quotes === "object" ? quotes : null;
  const hintMap = priceHints && typeof priceHints === "object" ? priceHints : null;
  return (Array.isArray(rows) ? rows : [])
    .map(item => normalizeHoldingRow(
      item,
      priceQuotes?.[item?.code]?.price || hintMap?.[String(item?.code || "").trim()] || null
    ))
    .filter(Boolean);
}

export function applyMarketQuotesToHoldings(rows, quotes) {
  return normalizeHoldings(rows, quotes);
}

export function applyTradeEntryToHoldings(rows, trade, quotes = null) {
  if (!trade || !trade.code || !trade.action) {
    return normalizeHoldings(rows, quotes);
  }
  const arr = [...(Array.isArray(rows) ? rows : [])];
  const idx = arr.findIndex(h => h.code === trade.code);
  const qty = Number(trade.qty) || 0;
  const price = Number(trade.price) || 0;

  if (trade.action === "買進") {
    if (idx >= 0) {
      const h = arr[idx];
      const nq = (Number(h.qty) || 0) + qty;
      if (nq === 0) return normalizeHoldings(arr, quotes);
      const cost = Number(h.cost) || 0;
      const nc = (cost * (Number(h.qty) || 0) + price * qty) / nq;
      arr[idx] = {
        ...h,
        qty: nq,
        price,
        cost: Math.round(nc * 100) / 100,
      };
    } else {
      arr.push({
        code: trade.code,
        name: trade.name,
        qty,
        price,
        cost: price,
        type: "股票",
      });
    }
    return normalizeHoldings(arr, quotes);
  }

  if (idx >= 0) {
    const h = arr[idx];
    const currentQty = Number(h.qty) || 0;
    const nq = Math.max(0, currentQty - qty);
    if (nq === 0) {
      arr.splice(idx, 1);
    } else {
      arr[idx] = {
        ...h,
        qty: nq,
        price,
      };
    }
  }

  return normalizeHoldings(arr, quotes);
}

export function shouldAdoptCloudHoldings(localRows, cloudRows) {
  const local = Array.isArray(localRows) ? localRows : [];
  const cloud = Array.isArray(cloudRows) ? cloudRows : [];
  if (cloud.length === 0) return false;
  if (local.length === 0) return true;

  const localByCode = new Map(local.map(item => [String(item?.code || "").trim(), item]));
  for (const cloudItem of cloud) {
    const code = String(cloudItem?.code || "").trim();
    if (!code) continue;
    const localItem = localByCode.get(code);
    if (!localItem) return true;
    if ((Number(localItem?.qty) || 0) !== (Number(cloudItem?.qty) || 0)) return true;
    if ((Number(localItem?.cost) || 0) !== (Number(cloudItem?.cost) || 0)) return true;
  }
  return false;
}

export function getCachedQuotesForCodes(cache, codes) {
  const priceCache = normalizeMarketPriceCache(cache);
  if (!priceCache || !priceCache.prices) return {};
  const codeSet = new Set((codes || []).map(code => String(code || "").trim()).filter(Boolean));
  if (codeSet.size === 0) return {};
  return Object.fromEntries(
    Object.entries(priceCache.prices).filter(([code, quote]) => codeSet.has(code) && quote?.price)
  );
}

export async function fetchJsonWithTimeout(input, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json().catch((err) => {
      console.warn(`JSON parse error from ${input}:`, err);
      return {};
    });
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

export function createDefaultPortfolios() {
  return [{ id: OWNER_PORTFOLIO_ID, name: "我", isOwner: true, createdAt: todayStorageDate() }];
}

export function clonePortfolioNotes() {
  return { ...DEFAULT_PORTFOLIO_NOTES };
}

export function pfKey(pid, suffix) {
  return `pf-${pid}-${suffix}`;
}

export function getEmptyFallback(suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  return field ? field.emptyFallback() : null;
}

export async function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`localStorage load error for key "${key}":`, err);
    return fallback;
  }
}

export async function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`localStorage save error for key "${key}":`, err);
  }
}

export async function loadAppliedTradePatches() {
  return load("pf-applied-trade-patches-v1", []);
}

export async function saveAppliedTradePatches(ids) {
  return save("pf-applied-trade-patches-v1", Array.from(new Set(ids || [])));
}

export function getPersistedMarketQuotes() {
  try {
    const raw = localStorage.getItem("pf-market-price-cache-v1");
    if (raw == null) return null;
    return normalizeMarketPriceCache(JSON.parse(raw))?.prices || null;
  } catch {
    return null;
  }
}

export function sanitizePortfolioField(suffix, data) {
  if (suffix === "holdings-v2") {
    return normalizeHoldings(data, getPersistedMarketQuotes());
  }
  return data;
}

export function collectPortfolioBackupStorage() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("pf-")) continue;
    if (
      key.startsWith("pf-") &&
      !(
        key.startsWith("pf-portfolios-v1") ||
        key.startsWith("pf-active-portfolio-v1") ||
        key.startsWith("pf-view-mode-v1") ||
        key.startsWith("pf-schema-version") ||
        key.startsWith("pf-cloud-sync-at") ||
        key.startsWith("pf-analysis-cloud-sync-at") ||
        key.startsWith("pf-research-cloud-sync-at") ||
        key.startsWith("pf-applied-trade-patches-v1")
      ) &&
      !PORTFOLIO_STORAGE_FIELDS.some(item => key.endsWith(`-${item.suffix}`))
    ) continue;
    const raw = localStorage.getItem(key);
    try { storage[key] = JSON.parse(raw); } catch { storage[key] = raw; }
  }
  return storage;
}

export function normalizeImportedStorageKey(rawKey) {
  if (
    rawKey === "pf-cloud-sync-at" ||
    rawKey === "pf-analysis-cloud-sync-at" ||
    rawKey === "pf-research-cloud-sync-at"
  ) return null;
  if (
    rawKey === "pf-portfolios-v1" ||
    rawKey === "pf-active-portfolio-v1" ||
    rawKey === "pf-view-mode-v1" ||
    rawKey === "pf-schema-version"
  ) return rawKey;

  const legacyField = PORTFOLIO_SUFFIX_TO_FIELD.find(item => item.hasLegacy !== false && `pf-${item.suffix}` === rawKey);
  if (legacyField) return pfKey(OWNER_PORTFOLIO_ID, legacyField.suffix);

  if (rawKey.startsWith("pf-") && PORTFOLIO_STORAGE_FIELDS.some(item => rawKey.endsWith(`-${item.suffix}`))) {
    return rawKey;