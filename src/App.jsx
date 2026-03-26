import { useState, useEffect, useRef, useDeferredValue, useMemo, createElement as h } from "react";
import { C, A, alpha } from "./theme.js";
import {
  EVENTS,
  IND_COLOR,
  INIT_HOLDINGS,
  INIT_HOLDINGS_JINLIANCHENG,
  INIT_TARGETS,
  INIT_TARGETS_JINLIANCHENG,
  INIT_WATCHLIST,
  NEWS_EVENTS,
  RELAY_PLAN,
  RELAY_PLAN_CODES,
  STOCK_META,
  avgTarget,
} from "./seedData.js";
import { HoldingsPanel, HoldingsTable } from "./components/holdings/index.js";
import { WatchlistPanel } from "./components/watchlist/index.js";
import { EventsPanel } from "./components/events/index.js";
import { DailyReportPanel } from "./components/reports/index.js";
import { ResearchPanel } from "./components/research/index.js";
import { usePortfolioManagement } from "./hooks/usePortfolioManagement.js";
import Md from "./components/Md.jsx";
import { TextInput, TextArea } from "./components/Form.jsx";

// ── 種子資料改由 seedData.js 提供，讓 App.jsx 只保留邏輯 ───────────

// ── 配色系統 ──────────────────────────────────────────────────────
const TYPE_COLOR = {
  法說: C.up,
  財報: C.teal,
  營收: C.olive,
  催化: C.amber,
  操作: C.text,
  總經: C.lavender,
  權證: C.choco,
};

const MEMO_Q = {
  "買進": ["為什麼選這檔？核心邏輯是什麼？", "進場的技術或籌碼依據？", "出場計畫：目標價？停損價？"],
  "賣出": ["為什麼在這個價位賣？", "達成原本預期了嗎？", "這筆資金的下一步？"],
};

const PARSE_PROMPT = `你是台股券商成交回報截圖的解析器。解析截圖中的交易，以JSON格式輸出，不輸出其他文字：
{"trades":[{"action":"買進或賣出","code":"代碼","name":"名稱","qty":股數,"price":成交價,"amount":金額或null}],"targetPriceUpdates":[{"code":"代碼","firm":"券商名稱","target":目標價數字,"date":"日期"}],"note":"有疑問時說明"}
交易別判斷規則（極重要）：
- 現買、融買、借資買 → action 一律填「買進」
- 現賣、融賣、借券賣 → action 一律填「賣出」
- 看「交易別」欄位的文字，不要用顏色或其他欄位猜測買賣方向
targetPriceUpdates：如果截圖中有提到分析師目標價或研究報告目標價，請一併擷取。否則為空陣列。`;

// ── helpers ─────────────────────────────────────────────────────
// 台股慣例：紅=漲/獲利，綠=跌/虧損（莫蘭迪版）
const pc    = (p) => p==null ? C.textMute : p>=0 ? C.up : C.down;
const pcBg  = (p) => p==null ? "transparent" : p>=0 ? C.upBg : C.downBg;
const fmtN  = (n) => n==null?"—":Math.abs(n)>=10000?(n/10000).toFixed(1)+"萬":n.toLocaleString();
const card  = {
  background:C.card,
  border:`1px solid ${C.border}`,
  borderRadius:10,
  padding:"12px 14px",
  boxShadow:`${C.insetLine}, ${C.shadow}`,
};
const lbl   = { fontSize:10, color:C.textMute, letterSpacing:"0.06em", fontWeight:600, marginBottom:5 };
const ghostBtn = {
  borderRadius:20,
  padding:"4px 11px",
  fontSize:9,
  fontWeight:500,
  cursor:"pointer",
  whiteSpace:"nowrap",
  transition:"all 0.18s ease",
};
const metricCard = {
  background:C.card,
  border:`1px solid ${C.border}`,
  borderRadius:8,
  padding:"8px 11px",
  boxShadow:`${C.insetLine}, ${C.shadow}`,
};
const CLOUD_SYNC_TTL = 1000 * 60 * 30;
const CLOUD_SAVE_DEBOUNCE = 1000 * 20;
const OWNER_PORTFOLIO_ID = "me";
export const PORTFOLIO_VIEW_MODE = "portfolio";
const OVERVIEW_VIEW_MODE = "overview";
const MARKET_PRICE_CACHE_KEY = "pf-market-price-cache-v1";
const MARKET_PRICE_SYNC_KEY = "pf-market-price-sync-v1";
const MARKET_TIMEZONE = "Asia/Taipei";
const POST_CLOSE_SYNC_MINUTES = 13 * 60 + 35;
const CURRENT_SCHEMA_VERSION = 3;
const PORTFOLIOS_KEY = "pf-portfolios-v1";
const ACTIVE_PORTFOLIO_KEY = "pf-active-portfolio-v1";
const VIEW_MODE_KEY = "pf-view-mode-v1";
const SCHEMA_VERSION_KEY = "pf-schema-version";
const GLOBAL_SYNC_KEYS = [
  "pf-cloud-sync-at",
  "pf-analysis-cloud-sync-at",
  "pf-research-cloud-sync-at",
];
const GLOBAL_SYNC_KEY_SET = new Set(GLOBAL_SYNC_KEYS);
export const BACKUP_GLOBAL_KEYS = [
  PORTFOLIOS_KEY,
  ACTIVE_PORTFOLIO_KEY,
  VIEW_MODE_KEY,
  SCHEMA_VERSION_KEY,
];
const BACKUP_GLOBAL_KEY_SET = new Set(BACKUP_GLOBAL_KEYS);
const APPLIED_TRADE_PATCHES_KEY = "pf-applied-trade-patches-v1";
export const DEFAULT_PORTFOLIO_NOTES = {
  riskProfile: "",
  preferences: "",
  customNotes: "",
};
const EVENT_HISTORY_LIMIT = 90;
const REPORT_REFRESH_DAILY_LIMIT = 5;
const REPORT_EXTRACT_MAX_ITEMS = 2;
const BRAIN_VALIDATION_CASE_LIMIT = 240;
const DEFAULT_REVIEW_FORM = {
  actual: "up",
  actualNote: "",
  lessons: "",
  exitDate: null,
  priceAtExit: null,
};
const DEFAULT_NEW_EVENT = {
  date: "",
  title: "",
  detail: "",
  stocks: "",
  pred: "up",
  predReason: "",
};
const DEFAULT_FUNDAMENTAL_DRAFT = {
  code: "",
  revenueMonth: "",
  revenueYoY: "",
  revenueMoM: "",
  quarter: "",
  eps: "",
  grossMargin: "",
  roe: "",
  source: "",
  updatedAt: "",
  note: "",
};
const TRADE_BACKFILL_PATCHES = [
  { // This is an example patch, it should be applied only once
    id: "2026-03-25-sell-039108-5000",
    portfolioId: OWNER_PORTFOLIO_ID,
    expectedQtyAfter: 3000,
    entry: {
      id: 202603250001,
      patchId: "2026-03-25-sell-039108-5000",
      date: "2026/3/25",
      time: "15:00",
      action: "賣出",
      code: "039108",
      name: "禾伸堂元富57購",
      qty: 5000,
      price: 1.9,
      qa: [
        { q: MEMO_Q["賣出"][0], a: "補登 2026/03/25 實際賣出 5000 股，修正 OCR 漏讀。" },
        { q: MEMO_Q["賣出"][1], a: "是，先落袋部分獲利並降低權證時間價值風險。" },
        { q: MEMO_Q["賣出"][2], a: "保留剩餘 3000 股續追蹤，等待下一步配置。" },
      ],
    },
  },
];
export const PORTFOLIO_STORAGE_FIELDS = [
  { suffix: "holdings-v2", alias: "holdings", ownerFallback: () => INIT_HOLDINGS, emptyFallback: () => [] },
  { suffix: "log-v2", alias: "tradeLog", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "targets-v1", alias: "targets", ownerFallback: () => INIT_TARGETS, emptyFallback: () => ({}) },
  { suffix: "fundamentals-v1", alias: "fundamentals", ownerFallback: () => ({}), emptyFallback: () => ({}), hasLegacy: false },
  { suffix: "watchlist-v1", alias: "watchlist", ownerFallback: () => normalizeWatchlist(INIT_WATCHLIST), emptyFallback: () => [], hasLegacy: false },
  { suffix: "analyst-reports-v1", alias: "analystReports", ownerFallback: () => ({}), emptyFallback: () => ({}), hasLegacy: false },
  { suffix: "report-refresh-meta-v1", alias: "reportRefreshMeta", ownerFallback: () => ({}), emptyFallback: () => ({}), hasLegacy: false },
  { suffix: "holding-dossiers-v1", alias: "holdingDossiers", ownerFallback: () => [], emptyFallback: () => [], hasLegacy: false },
  { suffix: "news-events-v1", alias: "newsEvents", ownerFallback: () => NEWS_EVENTS, emptyFallback: () => [] },
  { suffix: "analysis-history-v1", alias: "analysisHistory", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "daily-report-v1", alias: "dailyReport", ownerFallback: () => null, emptyFallback: () => null },
  { suffix: "reversal-v1", alias: "reversalConditions", ownerFallback: () => ({}), emptyFallback: () => ({}) },
  { suffix: "brain-v1", alias: "strategyBrain", ownerFallback: () => null, emptyFallback: () => null },
  { suffix: "brain-validation-v1", alias: "brainValidation", ownerFallback: () => ({ version: 1, cases: [] }), emptyFallback: () => ({ version: 1, cases: [] }), hasLegacy: false },
  { suffix: "research-history-v1", alias: "researchHistory", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "notes-v1", alias: "portfolioNotes", ownerFallback: () => ({ ...DEFAULT_PORTFOLIO_NOTES }), emptyFallback: () => ({ ...DEFAULT_PORTFOLIO_NOTES }), hasLegacy: false },
];
export const PORTFOLIO_SUFFIX_TO_FIELD = Object.fromEntries(PORTFOLIO_STORAGE_FIELDS.map(item => [item.suffix, item]));
export const PORTFOLIO_ALIAS_TO_SUFFIX = Object.fromEntries(PORTFOLIO_STORAGE_FIELDS.map(item => [item.alias, item.suffix]));
const LEGACY_STORAGE_KEYS = PORTFOLIO_STORAGE_FIELDS
  .filter(item => item.hasLegacy !== false)
  .map(item => `pf-${item.suffix}`);
const GLOBAL_STORAGE_KEYS = [
  ...BACKUP_GLOBAL_KEYS,
  ...GLOBAL_SYNC_KEYS,
];
const CLOSED_EVENT_STATUSES = new Set(["past", "closed"]);

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
    brainAudit: normalizeBrainAuditBuckets(value.brainAudit),
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

  (Array.isArray(fallbackRows) ? fallbackRows : []).forEach(row => {
    const code = String(row?.code || "").trim();
    const price = Number(row?.price);
    if (!code || !Number.isFinite(price) || price <= 0 || hints[code]) return;
    hints[code] = price;
  });

  return hints;
}

export function getTaipeiClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const info = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const hour = Number(info.hour || 0);
  const minute = Number(info.minute || 0);
  return {
    marketDate: `${info.year}-${info.month}-${info.day}`,
    weekday: info.weekday || "",
    hour,
    minute,
    minutes: hour * 60 + minute,
    isWeekend: info.weekday === "Sat" || info.weekday === "Sun",
  };
}

export function parseStoredDate(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createEmptyMarketPriceCache() {
  return {
    marketDate: null,
    syncedAt: null,
    source: "twse",
    status: "idle",
    prices: {},
  };
}

export function normalizeMarketPriceCache(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prices = Object.fromEntries(
    Object.entries(value.prices || {})
      .map(([code, quote]) => {
        if (!quote || typeof quote !== "object" || Array.isArray(quote)) return null;
        const price = Number(quote.price);
        const yesterday = Number(quote.yesterday);
        const change = Number(quote.change);
        const changePct = Number(quote.changePct);
        if (!Number.isFinite(price) || price <= 0) return null;
        return [
          code,
          {
            price,
            yesterday: Number.isFinite(yesterday) && yesterday > 0 ? yesterday : null,
            change: Number.isFinite(change) ? change : 0,
            changePct: Number.isFinite(changePct) ? changePct : 0,
          },
        ];
      })
      .filter(Boolean)
  );
  const normalized = {
    ...createEmptyMarketPriceCache(),
    marketDate: typeof value.marketDate === "string" ? value.marketDate : null,
    syncedAt: typeof value.syncedAt === "string" ? value.syncedAt : null,
    source: typeof value.source === "string" ? value.source : "twse",
    status: typeof value.status === "string" ? value.status : "idle",
    prices,
  };
  return normalized.marketDate || normalized.syncedAt || Object.keys(normalized.prices).length > 0 ? normalized : null;
}

export function normalizeMarketPriceSync(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = {
    marketDate: typeof value.marketDate === "string" ? value.marketDate : null,
    syncedAt: typeof value.syncedAt === "string" ? value.syncedAt : null,
    status: typeof value.status === "string" ? value.status : "idle",
    codes: Array.isArray(value.codes) ? value.codes.filter(Boolean) : [],
    failedCodes: Array.isArray(value.failedCodes) ? value.failedCodes.filter(Boolean) : [],
  };
  return normalized.marketDate || normalized.syncedAt || normalized.codes.length > 0 || normalized.failedCodes.length > 0 ? normalized : null;
}

export function canRunPostClosePriceSync(date = new Date(), syncMeta = null) {
  const clock = getTaipeiClock(date);
  if (clock.isWeekend) return { allowed: false, reason: "market-closed", clock };
  if (clock.minutes < POST_CLOSE_SYNC_MINUTES) return { allowed: false, reason: "before-close", clock };
  if (syncMeta?.marketDate === clock.marketDate && syncMeta?.status && syncMeta.status !== "idle") {
    return { allowed: false, reason: "already-synced", clock };
  }
  return { allowed: true, reason: "ready", clock };
}

export function getHoldingCostBasis(item) {
  if (!item || typeof item !== "object") return 0;
  return (Number(item?.cost) || 0) * (Number(item?.qty) || 0);
}

export function resolveHoldingPrice(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  
  // 優先使用覆蓋價格（來自 API 的即時股價）
  if (overridePrice != null) {
    const candidate = Number(overridePrice);
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  
  // 其次使用 stored price
  const storedPrice = Number(item?.price);
  if (Number.isFinite(storedPrice) && storedPrice > 0) return storedPrice;

  // 最後使用 value / qty 計算
  const qty = Number(item?.qty) || 0;
  const storedValue = Number(item?.value);
  if (qty > 0 && Number.isFinite(storedValue) && storedValue > 0) {
    return storedValue / qty;
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
  
  // 如果 item 已经有計算好的 pnl（來自 normalizeHoldingMetrics），直接使用
  if (typeof item.pnl === "number") return item.pnl;
  
  // 否則實時計算
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  return (price * qty) - (cost * qty);
}

export function getHoldingReturnPct(item, overridePrice = null) {
  if (!item || typeof item !== "object") return 0;
  
  // 如果 item 已经有計算好的 pct（來自 normalizeHoldingMetrics），直接使用
  if (typeof item.pct === "number") return item.pct;
  
  // 否則實時計算
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  const costBasis = cost * qty;
  if (costBasis <= 0) return 0;
  return ((price * qty - costBasis) / costBasis) * 100;
}

export function normalizeHoldingMetrics(item, overridePrice = null) {
  if (!item || typeof item !== "object") return item;
  
  // 使用 overridePrice（來自 API 的即時股價）或 item 中存儲的價格
  const price = resolveHoldingPrice(item, overridePrice);
  const qty = Number(item?.qty) || 0;
  const cost = Number(item?.cost) || 0;
  
  // 計算市值、損益、報酬率
  const value = price * qty;  // 市值 = 現價 × 股數
  const costBasis = cost * qty;  // 成本基礎 = 成本價 × 股數
  const pnl = value - costBasis;  // 損益 = 市值 - 成本基礎
  const pct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;  // 報酬率 = 損益 / 成本基礎
  
  return {
    ...item,
    price,  // 更新為最新股價
    value: Math.round(value),  // 市值
    pnl: Math.round(pnl),  // 未實現損益
    pct: Math.round(pct * 100) / 100,  // 報酬率百分比
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

function createEmptyBrainChecklists() {
  return {
    preEntry: [],
    preAdd: [],
    preExit: [],
  };
}

function normalizeBrainChecklistStage(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!raw) return "";
  if (raw === "entry" || raw === "preentry") return "preEntry";
  if (raw === "add" || raw === "preadd") return "preAdd";
  if (raw === "exit" || raw === "preexit") return "preExit";
  return "";
}

function brainChecklistStageLabel(stage) {
  if (stage === "preEntry") return "進場前";
  if (stage === "preAdd") return "加碼前";
  if (stage === "preExit") return "出場前";
  return "未分類";
}

function normalizeBrainChecklistItems(items) {
  return Array.isArray(items)
    ? Array.from(new Set(items.map(item => String(item || "").trim()).filter(Boolean))).slice(0, 12)
    : [];
}

function normalizeBrainStringList(items, { limit = 8 } = {}) {
  return Array.isArray(items)
    ? Array.from(new Set(items.map(item => String(item || "").trim()).filter(Boolean))).slice(0, limit)
    : [];
}

function brainRuleText(rule) {
  if (typeof rule === "string") return rule.trim();
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return "";
  return String(rule.text || rule.rule || "").trim();
}

function brainRuleKey(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return "";
  return String(rule.id || "").trim() || brainRuleText(rule);
}

function normalizeBrainRuleStaleness(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["fresh", "aging", "stale", "missing"].includes(normalized) ? normalized : "";
}

function brainRuleStalenessLabel(value) {
  switch (normalizeBrainRuleStaleness(value)) {
    case "fresh":
      return "新鮮";
    case "aging":
      return "待更新";
    case "stale":
      return "陳舊";
    case "missing":
      return "未驗證";
    default:
      return "";
  }
}

function brainRuleStalenessRank(value) {
  switch (normalizeBrainRuleStaleness(value)) {
    case "fresh":
      return 3;
    case "aging":
      return 2;
    case "stale":
      return 1;
    case "missing":
    default:
      return 0;
  }
}

function normalizeBrainEvidenceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["analysis", "research", "review", "event", "fundamental", "target", "report", "dossier", "note"].includes(normalized)
    ? normalized
    : "note";
}

function normalizeBrainEvidenceRef(value) {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? { type: "note", refId: null, code: null, label, date: null } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const label = String(value.label || value.text || value.title || "").trim();
  if (!label) return null;
  return {
    type: normalizeBrainEvidenceType(value.type),
    refId: String(value.refId || value.id || "").trim() || null,
    code: String(value.code || "").trim() || null,
    label,
    date: String(value.date || value.updatedAt || "").trim() || null,
  };
}

function normalizeBrainEvidenceRefs(value) {
  return Array.isArray(value)
    ? value.map(normalizeBrainEvidenceRef).filter(Boolean).slice(0, 8)
    : [];
}

function normalizeBrainAnalogVerdict(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["supported", "mixed", "contradicted"].includes(normalized) ? normalized : "";
}

function brainAnalogVerdictLabel(value) {
  switch (normalizeBrainAnalogVerdict(value)) {
    case "supported":
      return "支持";
    case "mixed":
      return "部分支持";
    case "contradicted":
      return "相反";
    default:
      return "";
  }
}

function normalizeBrainAnalogDifferenceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["none", "stock_specific", "market_regime", "timing", "liquidity", "rule_miss"].includes(normalized)
    ? normalized
    : "";
}

function brainAnalogDifferenceTypeLabel(value) {
  switch (normalizeBrainAnalogDifferenceType(value)) {
    case "none":
      return "無明顯差異";
    case "stock_specific":
      return "個股特性差異";
    case "market_regime":
      return "市場節奏不同";
    case "timing":
      return "時間窗口不同";
    case "liquidity":
      return "流動性差異";
    case "rule_miss":
      return "規則判斷失準";
    default:
      return "";
  }
}

function normalizeBrainAnalogCase(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const code = String(value.code || "").trim();
  const name = String(value.name || "").trim();
  const thesis = String(value.thesis || value.reason || "").trim();
  const verdict = normalizeBrainAnalogVerdict(value.verdict);
  const differenceType = normalizeBrainAnalogDifferenceType(value.differenceType);
  if (!code && !name && !thesis) return null;
  return {
    code,
    name,
    period: String(value.period || value.window || "").trim(),
    thesis,
    verdict,
    differenceType,
    note: String(value.note || value.notes || "").trim(),
  };
}

function normalizeBrainAnalogCases(value) {
  return Array.isArray(value)
    ? value.map(normalizeBrainAnalogCase).filter(Boolean).slice(0, 5)
    : [];
}

function latestBrainEvidenceDate(lastValidatedAt, evidenceRefs) {
  const candidates = [
    lastValidatedAt,
    ...(Array.isArray(evidenceRefs) ? evidenceRefs.map(ref => ref?.date).filter(Boolean) : []),
  ]
    .map(item => ({ raw: item, parsed: parseFlexibleDate(item) }))
    .filter(item => item.parsed);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.parsed.getTime() - a.parsed.getTime());
  return candidates[0].raw;
}

function deriveBrainRuleStaleness({ lastValidatedAt = null, evidenceRefs = [] } = {}, { now = new Date() } = {}) {
  const latestDate = latestBrainEvidenceDate(lastValidatedAt, evidenceRefs);
  if (!latestDate) return "missing";
  const freshness = computeStaleness(latestDate, 30, { now });
  if (freshness === "fresh") return "fresh";
  const age = daysSince(latestDate, now);
  if (age == null) return "missing";
  return age <= 90 ? "aging" : "stale";
}

function deriveBrainRuleValidationScore({ confidence = null, evidenceCount = 0, staleness = "", status = "active" } = {}) {
  const hasConfidence = Number.isFinite(confidence);
  const hasEvidence = Number.isFinite(evidenceCount) && evidenceCount > 0;
  const normalizedStaleness = normalizeBrainRuleStaleness(staleness);
  if (!hasConfidence && !hasEvidence && !["fresh", "aging", "stale"].includes(normalizedStaleness)) return null;

  let score = hasConfidence ? Math.round((confidence / 10) * 55) : 25;
  score += hasEvidence ? Math.min(30, Math.round(evidenceCount) * 6) : 0;

  if (normalizedStaleness === "fresh") score += 15;
  if (normalizedStaleness === "aging") score += 7;
  if (normalizedStaleness === "stale") score -= 8;
  if (normalizedStaleness === "missing") score -= 12;

  if (status === "candidate") score = Math.min(score, 69);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function brainRuleEvidenceSummary(evidenceRefs, { limit = 2 } = {}) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs.filter(Boolean) : [];
  if (refs.length === 0) return "";
  const labels = refs
    .map(ref => String(ref?.label || "").trim())
    .filter(Boolean)
    .slice(0, limit);
  if (labels.length === 0) return `證據${refs.length}筆`;
  return `證據${refs.length}筆：${labels.join("、")}${refs.length > limit ? "…" : ""}`;
}

function brainRuleMetaParts(rule, { includeEvidencePreview = false } = {}) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return [];
  return [
    rule.when ? `條件:${rule.when}` : null,
    rule.action ? `動作:${rule.action}` : null,
    rule.scope ? `範圍:${rule.scope}` : null,
    (rule.appliesTo || []).length > 0 ? `適用:${rule.appliesTo.slice(0, 3).join("/")}` : null,
    rule.marketRegime ? `市況:${rule.marketRegime}` : null,
    rule.catalystWindow ? `窗口:${rule.catalystWindow}` : null,
    rule.confidence != null ? `信心${rule.confidence}/10` : null,
    rule.evidenceCount > 0 ? `驗證${rule.evidenceCount}次` : null,
    rule.validationScore != null ? `驗證分${rule.validationScore}` : null,
    rule.lastValidatedAt ? `最近驗證${rule.lastValidatedAt}` : null,
    rule.staleness ? `狀態:${brainRuleStalenessLabel(rule.staleness)}` : null,
    rule.checklistStage ? `檢查點:${brainChecklistStageLabel(rule.checklistStage)}` : null,
    (rule.historicalAnalogs || []).length > 0 ? `歷史比對${rule.historicalAnalogs.length}例` : null,
    includeEvidencePreview ? brainRuleEvidenceSummary(rule.evidenceRefs) : null,
  ].filter(Boolean);
}

function compareBrainRulesByStrength(a, b) {
  const scoreDiff = (Number(b?.validationScore) || -1) - (Number(a?.validationScore) || -1);
  if (scoreDiff !== 0) return scoreDiff;
  const freshnessDiff = brainRuleStalenessRank(b?.staleness) - brainRuleStalenessRank(a?.staleness);
  if (freshnessDiff !== 0) return freshnessDiff;
  const evidenceDiff = (Number(b?.evidenceCount) || 0) - (Number(a?.evidenceCount) || 0);
  if (evidenceDiff !== 0) return evidenceDiff;
  const confidenceDiff = (Number(b?.confidence) || 0) - (Number(a?.confidence) || 0);
  if (confidenceDiff !== 0) return confidenceDiff;
  return brainRuleText(a).localeCompare(brainRuleText(b), "zh-Hant");
}

function normalizeBrainAuditConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100);
  if (numeric >= 1 && numeric <= 10) return Math.round(numeric * 10);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeBrainAuditItem(value, defaultBucket = "validated") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const text = brainRuleText(value) || String(value.ruleText || "").trim();
  const id = String(value.id || value.ruleId || "").trim() || null;
  if (!text && !id) return null;
  const bucket = ["validated", "stale", "invalidated"].includes(value.bucket) ? value.bucket : defaultBucket;
  return {
    id,
    text: text || "",
    bucket,
    reason: String(value.reason || value.note || "").trim(),
    confidence: normalizeBrainAuditConfidence(value.confidence),
    lastValidatedAt: String(value.lastValidatedAt || "").trim() || null,
    staleness: normalizeBrainRuleStaleness(value.staleness) || "",
    nextStatus: ["active", "candidate", "archived"].includes(value.nextStatus) ? value.nextStatus : "",
    evidenceRefs: normalizeBrainEvidenceRefs(value.evidenceRefs),
  };
}

function createEmptyBrainAudit() {
  return {
    validatedRules: [],
    staleRules: [],
    invalidatedRules: [],
  };
}

function normalizeBrainAuditBuckets(value) {
  const normalized = createEmptyBrainAudit();
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
  normalized.validatedRules = Array.isArray(value.validatedRules)
    ? value.validatedRules.map(item => normalizeBrainAuditItem(item, "validated")).filter(Boolean).slice(0, 20)
    : [];
  normalized.staleRules = Array.isArray(value.staleRules)
    ? value.staleRules.map(item => normalizeBrainAuditItem(item, "stale")).filter(Boolean).slice(0, 20)
    : [];
  normalized.invalidatedRules = Array.isArray(value.invalidatedRules)
    ? value.invalidatedRules.map(item => normalizeBrainAuditItem(item, "invalidated")).filter(Boolean).slice(0, 20)
    : [];
  return normalized;
}

function attachEvidenceRefsToBrainAudit(brainAudit, evidenceRefs, { defaultLastValidatedAt = null } = {}) {
  const normalized = normalizeBrainAuditBuckets(brainAudit);
  const extraRefs = normalizeBrainEvidenceRefs(evidenceRefs);
  const patchItem = (item, bucket) => normalizeBrainAuditItem({
    ...item,
    bucket,
    lastValidatedAt: item?.lastValidatedAt || defaultLastValidatedAt || "",
    evidenceRefs: mergeBrainEvidenceRefs(item?.evidenceRefs, extraRefs),
  }, bucket);

  return normalizeBrainAuditBuckets({
    validatedRules: normalized.validatedRules.map(item => patchItem(item, "validated")),
    staleRules: normalized.staleRules.map(item => patchItem(item, "stale")),
    invalidatedRules: normalized.invalidatedRules.map(item => patchItem(item, "invalidated")),
  });
}

function createEmptyBrainValidationStore() {
  return {
    version: 1,
    cases: [],
  };
}

function normalizeBrainValidationPositionType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "stock";
  if (normalized.includes("權證")) return "warrant";
  if (normalized.includes("etf")) return "etf";
  return "stock";
}

function brainValidationPositionTypeLabel(value) {
  switch (normalizeBrainValidationPositionType(value)) {
    case "warrant":
      return "權證";
    case "etf":
      return "ETF";
    case "stock":
    default:
      return "股票";
  }
}

function normalizeBrainValidationStrategyClass(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("權證")) return "權證";
  if (text.includes("ETF") || text.includes("指數")) return "ETF/指數";
  if (text.includes("事件")) return "事件驅動";
  if (text.includes("成長")) return "成長股";
  if (text.includes("景氣")) return "景氣循環";
  if (text.includes("防禦") || text.includes("停損")) return "防禦/停損觀察";
  if (text.includes("轉型")) return "轉型股";
  if (text.includes("價值")) return "價值股";
  return text;
}

function normalizeBrainValidationEventPhase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["no_event", "pre_event", "tracking", "post_event"].includes(normalized) ? normalized : "no_event";
}

function normalizeBrainValidationIndustryTheme(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("AI") || text.includes("伺服器")) return "AI伺服器";
  if (text.includes("PCB") || text.includes("材料") || text.includes("CCL")) return "PCB/CCL";
  if (text.includes("記憶體") || text.includes("IC")) return "記憶體/半導體";
  if (text.includes("光通訊")) return "光通訊";
  if (text.includes("生技")) return "生技";
  if (text.includes("ETF")) return "ETF/指數";
  if (text.includes("精密機械")) return "精密機械";
  return text;
}

function normalizeBrainValidationHoldingPeriod(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("短") && text.includes("長")) return "mid";
  if (text.includes("短") && text.includes("中")) return "mid";
  if (text.includes("長")) return "long";
  if (text.includes("中")) return "mid";
  if (text.includes("短")) return "short";
  return "";
}

function normalizeBrainValidationBand(value, allowed) {
  const normalized = String(value || "").trim();
  return allowed.includes(normalized) ? normalized : "unknown";
}

function normalizeBrainValidationFingerprint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    positionType: normalizeBrainValidationPositionType(value.positionType),
    strategyClass: normalizeBrainValidationStrategyClass(value.strategyClass),
    eventPhase: normalizeBrainValidationEventPhase(value.eventPhase),
    catalystTags: normalizeBrainStringList(value.catalystTags, { limit: 8 }),
    industryTheme: normalizeBrainValidationIndustryTheme(value.industryTheme),
    holdingPeriod: normalizeBrainValidationHoldingPeriod(value.holdingPeriod),
    fundamentalState: {
      revenueYoYBand: normalizeBrainValidationBand(value.fundamentalState?.revenueYoYBand, ["<0", "0-15", "15-30", "30+", "unknown"]),
      epsState: normalizeBrainValidationBand(value.fundamentalState?.epsState, ["up", "flat", "down", "unknown"]),
      grossMarginTrend: normalizeBrainValidationBand(value.fundamentalState?.grossMarginTrend, ["up", "flat", "down", "unknown"]),
    },
    priceState: {
      pnlBand: normalizeBrainValidationBand(value.priceState?.pnlBand, ["<-15", "-15~-5", "-5~5", "5~15", "15+", "unknown"]),
      targetGapBand: normalizeBrainValidationBand(value.priceState?.targetGapBand, [">20", "10~20", "0~10", "<0", "unknown"]),
    },
    freshness: {
      fundamentals: normalizeBrainRuleStaleness(value.freshness?.fundamentals) || "missing",
      targets: normalizeBrainRuleStaleness(value.freshness?.targets) || "missing",
      analyst: normalizeBrainRuleStaleness(value.freshness?.analyst) || "missing",
      research: normalizeBrainRuleStaleness(value.freshness?.research) || "missing",
    },
  };
}

function buildBrainValidationHash(text) {
  const source = String(text || "").trim();
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildBrainRuleKey(rule) {
  const id = String(rule?.id || "").trim();
  if (id) return id;
  const text = brainRuleText(rule);
  return text ? `rule-${buildBrainValidationHash(text)}` : `rule-${Date.now()}`;
}

function classifyBrainValidationEventPhase(dossier) {
  const events = dossier?.events || {};
  if (Array.isArray(events.tracking) && events.tracking.length > 0) return "tracking";
  if (Array.isArray(events.pending) && events.pending.length > 0) return "pre_event";
  if (events.latestClosed) return "post_event";
  return "no_event";
}

function collectBrainCatalystTags(text) {
  const source = String(text || "").toLowerCase();
  const tags = [];
  const matchTag = (tag, patterns) => {
    if (patterns.some(pattern => source.includes(pattern))) tags.push(tag);
  };
  matchTag("法說", ["法說", "說明會"]);
  matchTag("財報", ["財報", "eps", "獲利"]);
  matchTag("月營收", ["月營收", "營收"]);
  matchTag("目標價上修", ["目標價上修", "上修"]);
  matchTag("目標價下修", ["目標價下修", "下修"]);
  matchTag("AI", ["ai", "伺服器"]);
  matchTag("ASIC", ["asic"]);
  matchTag("CCL", ["ccl", "覆銅板"]);
  matchTag("DDR3", ["ddr3"]);
  matchTag("漲價", ["漲價", "asp"]);
  matchTag("去庫存", ["去庫存"]);
  matchTag("補庫存", ["補庫存"]);
  matchTag("政策", ["政策", "補助"]);
  matchTag("高殖利率", ["殖利率", "股息"]);
  matchTag("匯率", ["匯率", "升值", "貶值"]);
  matchTag("中國刺激", ["中國", "刺激"]);
  matchTag("生技", ["藥證", "臨床", "授權", "生技"]);
  return tags;
}

function revenueYoYBand(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "unknown";
  if (num < 0) return "<0";
  if (num < 15) return "0-15";
  if (num < 30) return "15-30";
  return "30+";
}

function epsStateBand(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "unknown";
  if (num < 0) return "down";
  if (num < 5) return "flat";
  return "up";
}

function grossMarginBand(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "unknown";
  if (num < 25) return "down";
  if (num < 40) return "flat";
  return "up";
}

function pnlBand(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "unknown";
  if (num < -15) return "<-15";
  if (num < -5) return "-15~-5";
  if (num < 5) return "-5~5";
  if (num < 15) return "5~15";
  return "15+";
}

function targetGapBand(avgTarget, price) {
  const target = Number(avgTarget);
  const current = Number(price);
  if (!Number.isFinite(target) || !Number.isFinite(current) || current <= 0) return "unknown";
  const pct = ((target - current) / current) * 100;
  if (pct > 20) return ">20";
  if (pct > 10) return "10~20";
  if (pct >= 0) return "0~10";
  return "<0";
}

function buildScenarioFingerprintFromDossier(dossier) {
  if (!dossier) return null;
  const position = dossier.position || {};
  const meta = dossier.meta || {};
  const fundamentals = dossier.fundamentals || {};
  const targets = dossier.targets || {};
  const analyst = dossier.analyst || {};
  const research = dossier.research || {};
  const events = dossier.events || {};
  const catalystText = [
    meta.strategy,
    meta.industry,
    dossier.thesis?.summary,
    analyst.summary,
    research.summary,
    ...(Array.isArray(events.pending) ? events.pending.map(item => item?.title) : []),
    ...(Array.isArray(events.tracking) ? events.tracking.map(item => item?.title) : []),
  ].filter(Boolean).join(" | ");
  return normalizeBrainValidationFingerprint({
    positionType: position.type,
    strategyClass: meta.strategy,
    eventPhase: classifyBrainValidationEventPhase(dossier),
    catalystTags: collectBrainCatalystTags(catalystText),
    industryTheme: meta.industry,
    holdingPeriod: meta.period,
    fundamentalState: {
      revenueYoYBand: revenueYoYBand(fundamentals.revenueYoY),
      epsState: epsStateBand(fundamentals.eps),
      grossMarginTrend: grossMarginBand(fundamentals.grossMargin),
    },
    priceState: {
      pnlBand: pnlBand(position.pct),
      targetGapBand: targetGapBand(targets.avgTarget, position.price),
    },
    freshness: {
      fundamentals: fundamentals.freshness,
      targets: targets.freshness,
      analyst: analyst.freshness,
      research: research.freshness,
    },
  });
}

function ratioOverlap(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const matched = left.filter(item => rightSet.has(item)).length;
  return matched / Math.max(left.length, right.length, 1);
}

function isHardExcludedAnalog(left, right) {
  if (!left || !right) return true;
  if (left.positionType !== right.positionType) {
    if (left.positionType === "warrant" || right.positionType === "warrant") return true;
    if (left.positionType === "etf" || right.positionType === "etf") return true;
  }
  if (["權證", "ETF/指數"].includes(left.strategyClass) || ["權證", "ETF/指數"].includes(right.strategyClass)) {
    if (left.strategyClass !== right.strategyClass) return true;
  }
  if ((left.eventPhase === "pre_event" && right.eventPhase === "post_event") || (left.eventPhase === "post_event" && right.eventPhase === "pre_event")) {
    return true;
  }
  return false;
}

function scoreBrainValidationAnalog(left, right) {
  if (!left || !right || isHardExcludedAnalog(left, right)) {
    return { score: 0, excluded: true, matchedDimensions: [], mismatchedDimensions: ["hard_exclusion"] };
  }

  let score = 0;
  const matchedDimensions = [];
  const mismatchedDimensions = [];

  if (left.positionType === right.positionType) { score += 18; matchedDimensions.push("positionType"); } else mismatchedDimensions.push("positionType");
  if (left.strategyClass && left.strategyClass === right.strategyClass) { score += 18; matchedDimensions.push("strategyClass"); } else mismatchedDimensions.push("strategyClass");

  if (left.eventPhase === right.eventPhase) {
    score += 14; matchedDimensions.push("eventPhase");
  } else if ((left.eventPhase === "pre_event" && right.eventPhase === "tracking") || (left.eventPhase === "tracking" && right.eventPhase === "pre_event")) {
    score += 7; matchedDimensions.push("eventPhase");
  } else if ((left.eventPhase === "tracking" && right.eventPhase === "post_event") || (left.eventPhase === "post_event" && right.eventPhase === "tracking")) {
    score += 6; matchedDimensions.push("eventPhase");
  } else {
    mismatchedDimensions.push("eventPhase");
  }

  const catalystOverlap = ratioOverlap(left.catalystTags, right.catalystTags);
  if (catalystOverlap >= 0.67) { score += 14; matchedDimensions.push("catalystTags"); }
  else if (catalystOverlap >= 0.34) { score += 9; matchedDimensions.push("catalystTags"); }
  else if (catalystOverlap > 0) { score += 5; matchedDimensions.push("catalystTags"); }
  else mismatchedDimensions.push("catalystTags");

  if (left.industryTheme && left.industryTheme === right.industryTheme) { score += 10; matchedDimensions.push("industryTheme"); }
  else mismatchedDimensions.push("industryTheme");

  if (left.holdingPeriod && left.holdingPeriod === right.holdingPeriod) { score += 8; matchedDimensions.push("holdingPeriod"); }
  else if ([left.holdingPeriod, right.holdingPeriod].includes("mid") && left.holdingPeriod && right.holdingPeriod) { score += 4; matchedDimensions.push("holdingPeriod"); }
  else mismatchedDimensions.push("holdingPeriod");

  const fundamentalsMatched = [
    left.fundamentalState?.revenueYoYBand === right.fundamentalState?.revenueYoYBand,
    left.fundamentalState?.epsState === right.fundamentalState?.epsState,
    left.fundamentalState?.grossMarginTrend === right.fundamentalState?.grossMarginTrend,
  ].filter(Boolean).length;
  if (fundamentalsMatched === 3) { score += 10; matchedDimensions.push("fundamentalState"); }
  else if (fundamentalsMatched === 2) { score += 7; matchedDimensions.push("fundamentalState"); }
  else if (fundamentalsMatched === 1) { score += 3; matchedDimensions.push("fundamentalState"); }
  else mismatchedDimensions.push("fundamentalState");

  const priceMatched = [
    left.priceState?.pnlBand === right.priceState?.pnlBand,
    left.priceState?.targetGapBand === right.priceState?.targetGapBand,
  ].filter(Boolean).length;
  if (priceMatched === 2) { score += 8; matchedDimensions.push("priceState"); }
  else if (priceMatched === 1) { score += 4; matchedDimensions.push("priceState"); }
  else mismatchedDimensions.push("priceState");

  const freshnessPenalty = [
    { key: "fundamentals", weight: 12 },
    { key: "targets", weight: 10 },
    { key: "analyst", weight: 8 },
    { key: "research", weight: 5 },
  ].reduce((sum, item) => {
    const status = left.freshness?.[item.key];
    return sum + (["stale", "missing"].includes(status) ? item.weight : 0);
  }, 0);

  score -= freshnessPenalty;
  return {
    score: Math.max(0, Math.min(100, score)),
    excluded: false,
    matchedDimensions,
    mismatchedDimensions,
  };
}

function classifyBrainDifferenceType(reason, bucket) {
  const source = String(reason || "").toLowerCase();
  if (!source) return bucket === "invalidated" ? "rule_miss" : "none";
  if (["流動性", "量能", "權證", "換手", "成交"].some(token => source.includes(token.toLowerCase()))) return "liquidity";
  if (["市況", "題材", "輪動", "風險偏好", "大盤", "資金"].some(token => source.includes(token.toLowerCase()))) return "market_regime";
  if (["法說", "月營收", "財報", "時間", "時序", "窗口"].some(token => source.includes(token.toLowerCase()))) return "timing";
  if (["個股", "供應鏈", "客戶", "產品", "藥證", "內部人"].some(token => source.includes(token.toLowerCase()))) return "stock_specific";
  return bucket === "invalidated" ? "rule_miss" : "none";
}

function refineBrainDifferenceType(baseType, { reviewOutcome = null, bestComparison = null } = {}) {
  if (bestComparison?.differenceType && bestComparison.differenceType !== "none") return bestComparison.differenceType;
  const mismatches = bestComparison?.mismatchedDimensions || [];
  if (mismatches.includes("eventPhase")) return "timing";
  if (mismatches.includes("industryTheme")) return "stock_specific";
  if (mismatches.includes("priceState")) return "market_regime";
  if (reviewOutcome?.outcomeLabel === "contradicted") return baseType === "none" ? "rule_miss" : baseType;
  return baseType;
}

function normalizeBrainValidationMatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const caseId = String(value.caseId || "").trim();
  const code = String(value.code || "").trim();
  const name = String(value.name || "").trim();
  if (!caseId && !code && !name) return null;
  return {
    caseId: caseId || null,
    code: code || null,
    name: name || "",
    capturedAt: String(value.capturedAt || "").trim() || null,
    score: Number.isFinite(Number(value.score)) ? Math.max(0, Math.min(100, Math.round(Number(value.score)))) : null,
    verdict: normalizeBrainAnalogVerdict(value.verdict),
    differenceType: normalizeBrainAnalogDifferenceType(value.differenceType),
    matchedDimensions: normalizeBrainStringList(value.matchedDimensions, { limit: 8 }),
    mismatchedDimensions: normalizeBrainStringList(value.mismatchedDimensions, { limit: 8 }),
    note: String(value.note || "").trim(),
  };
}

function normalizeBrainValidationCase(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const caseId = String(value.caseId || "").trim();
  const ruleKey = String(value.ruleKey || "").trim();
  const ruleText = String(value.ruleText || "").trim();
  const code = String(value.code || "").trim();
  if (!caseId || !ruleKey || !ruleText || !code) return null;
  const fingerprint = normalizeBrainValidationFingerprint(value.fingerprint);
  if (!fingerprint) return null;
  return {
    caseId,
    portfolioId: String(value.portfolioId || "").trim() || OWNER_PORTFOLIO_ID,
    sourceType: ["dailyAnalysis", "eventReview"].includes(value.sourceType) ? value.sourceType : "dailyAnalysis",
    sourceRefId: String(value.sourceRefId || "").trim() || null,
    capturedAt: String(value.capturedAt || "").trim() || toSlashDate(),
    code,
    name: String(value.name || "").trim() || code,
    ruleKey,
    ruleId: String(value.ruleId || "").trim() || null,
    ruleText,
    bucket: ["validated", "stale", "invalidated"].includes(value.bucket) ? value.bucket : "validated",
    verdict: normalizeBrainAnalogVerdict(value.verdict) || "supported",
    differenceType: normalizeBrainAnalogDifferenceType(value.differenceType) || "none",
    note: String(value.note || "").trim(),
    similarityScore: Number.isFinite(Number(value.similarityScore)) ? Math.max(0, Math.min(100, Math.round(Number(value.similarityScore)))) : null,
    matchedDimensions: normalizeBrainStringList(value.matchedDimensions, { limit: 8 }),
    mismatchedDimensions: normalizeBrainStringList(value.mismatchedDimensions, { limit: 8 }),
    reviewOutcome: value.reviewOutcome && typeof value.reviewOutcome === "object" && !Array.isArray(value.reviewOutcome)
      ? {
        code: String(value.reviewOutcome.code || code).trim() || code,
        name: String(value.reviewOutcome.name || value.name || "").trim() || code,
        predicted: ["up", "down", "neutral"].includes(value.reviewOutcome.predicted) ? value.reviewOutcome.predicted : null,
        actual: ["up", "down", "neutral"].includes(value.reviewOutcome.actual) ? value.reviewOutcome.actual : null,
        changePct: Number.isFinite(Number(value.reviewOutcome.changePct)) ? Math.round(Number(value.reviewOutcome.changePct) * 100) / 100 : null,
        outcomeLabel: normalizeEventOutcomeLabel(value.reviewOutcome.outcomeLabel),
        note: String(value.reviewOutcome.note || "").trim(),
      }
      : null,
    fingerprint,
    evidenceRefs: normalizeBrainEvidenceRefs(value.evidenceRefs),
    analogMatches: Array.isArray(value.analogMatches) ? value.analogMatches.map(normalizeBrainValidationMatch).filter(Boolean).slice(0, 3) : [],
  };
}

function normalizeBrainValidationStore(value) {
  const normalized = createEmptyBrainValidationStore();
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
  normalized.cases = Array.isArray(value.cases)
    ? value.cases.map(normalizeBrainValidationCase).filter(Boolean)
      .sort((a, b) => {
        const aTime = parseFlexibleDate(a?.capturedAt)?.getTime() || 0;
        const bTime = parseFlexibleDate(b?.capturedAt)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, BRAIN_VALIDATION_CASE_LIMIT)
    : [];
  return normalized;
}

function normalizeBrainRule(rule, { defaultSource = "ai", defaultStatus = "active" } = {}) {
  const text = brainRuleText(rule);
  if (!text) return null;
  if (typeof rule === "string") {
    return {
      id: null,
      text,
      when: "",
      action: "",
      avoid: "",
      scope: "",
      appliesTo: [],
      marketRegime: "",
      catalystWindow: "",
      contextRequired: [],
      invalidationSignals: [],
      historicalAnalogs: [],
      confidence: null,
      evidenceCount: 0,
      validationScore: null,
      lastValidatedAt: null,
      staleness: "missing",
      evidenceRefs: [],
      status: defaultStatus,
      source: defaultSource,
      checklistStage: "",
      note: "",
    };
  }

  const confidence = Number(rule.confidence);
  const evidenceRefs = normalizeBrainEvidenceRefs(rule.evidenceRefs);
  const historicalAnalogs = normalizeBrainAnalogCases(rule.historicalAnalogs || rule.analogCases);
  const evidenceCount = Number(rule.evidenceCount ?? rule.evidence ?? evidenceRefs.length ?? 0);
  const lastValidatedAt = String(rule.lastValidatedAt || "").trim() || null;
  const source = ["ai", "user", "coach", "system"].includes(rule.source) ? rule.source : defaultSource;
  const status = ["active", "candidate", "archived"].includes(rule.status) ? rule.status : defaultStatus;
  const normalizedEvidenceCount = Number.isFinite(evidenceCount) ? Math.max(0, Math.round(evidenceCount)) : 0;
  const staleness = normalizeBrainRuleStaleness(rule.staleness)
    || deriveBrainRuleStaleness({ lastValidatedAt, evidenceRefs });
  const explicitValidationScore = Number(rule.validationScore);
  const normalizedConfidence = Number.isFinite(confidence) ? Math.max(1, Math.min(10, Math.round(confidence))) : null;
  const validationScore = Number.isFinite(explicitValidationScore)
    ? Math.max(0, Math.min(100, Math.round(explicitValidationScore)))
    : deriveBrainRuleValidationScore({
      confidence: normalizedConfidence,
      evidenceCount: normalizedEvidenceCount,
      staleness,
      status,
    });
  return {
    id: String(rule.id || "").trim() || null,
    text,
    when: String(rule.when || "").trim(),
    action: String(rule.action || "").trim(),
    avoid: String(rule.avoid || "").trim(),
    scope: String(rule.scope || "").trim(),
    appliesTo: normalizeBrainStringList(rule.appliesTo || rule.tags, { limit: 6 }),
    marketRegime: String(rule.marketRegime || "").trim(),
    catalystWindow: String(rule.catalystWindow || "").trim(),
    contextRequired: normalizeBrainStringList(rule.contextRequired, { limit: 6 }),
    invalidationSignals: normalizeBrainStringList(rule.invalidationSignals, { limit: 6 }),
    historicalAnalogs,
    confidence: normalizedConfidence,
    evidenceCount: normalizedEvidenceCount,
    validationScore,
    lastValidatedAt,
    staleness,
    evidenceRefs,
    status,
    source,
    checklistStage: normalizeBrainChecklistStage(rule.checklistStage),
    note: String(rule.note || "").trim(),
  };
}

function brainRuleSummary(rule, { includeMeta = false } = {}) {
  const text = brainRuleText(rule);
  if (!text) return "";
  if (!includeMeta || !rule || typeof rule !== "object" || Array.isArray(rule)) return text;
  const meta = brainRuleMetaParts(rule, { includeEvidencePreview: false });
  return meta.length > 0 ? `${text}（${meta.join("｜")}）` : text;
}

function hasBrainChecklistContent(checklists) {
  return Object.values(checklists || {}).some(items => Array.isArray(items) && items.length > 0);
}

function normalizeBrainChecklists(value, linkedRules = []) {
  const normalized = createEmptyBrainChecklists();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    normalized.preEntry = normalizeBrainChecklistItems(value.preEntry);
    normalized.preAdd = normalizeBrainChecklistItems(value.preAdd);
    normalized.preExit = normalizeBrainChecklistItems(value.preExit);
  }

  (Array.isArray(linkedRules) ? linkedRules : []).forEach(rule => {
    const stage = normalizeBrainChecklistStage(rule?.checklistStage);
    const text = brainRuleText(rule);
    if (!stage || !text || rule?.status === "archived") return;
    if (!normalized[stage].includes(text)) normalized[stage].push(text);
  });

  normalized.preEntry = normalized.preEntry.slice(0, 12);
  normalized.preAdd = normalized.preAdd.slice(0, 12);
  normalized.preExit = normalized.preExit.slice(0, 12);
  return normalized;
}

function formatBrainRulesForPrompt(rules, { limit = 8 } = {}) {
  const rows = (Array.isArray(rules) ? rules : [])
    .slice(0, limit)
    .map((rule, index) => `${index + 1}. ${brainRuleSummary(rule, { includeMeta: true })}`);
  return rows.length > 0 ? rows.join("\n") : "無";
}

function formatBrainRulesForValidationPrompt(rules, { limit = 8 } = {}) {
  const rows = (Array.isArray(rules) ? rules : [])
    .slice(0, limit)
    .map((rule, index) => {
      const ruleId = String(rule?.id || "").trim();
      const prefix = ruleId ? `[ruleId:${ruleId}] ` : "";
      return `${index + 1}. ${prefix}${brainRuleSummary(rule, { includeMeta: true })}`;
    });
  return rows.length > 0 ? rows.join("\n") : "無";
}

function formatBrainChecklistsForPrompt(checklists) {
  const normalized = normalizeBrainChecklists(checklists);
  const sections = [
    ["進場前檢查", normalized.preEntry],
    ["加碼前檢查", normalized.preAdd],
    ["出場前檢查", normalized.preExit],
  ]
    .map(([label, items]) => Array.isArray(items) && items.length > 0 ? `${label}：${items.join("；")}` : null)
    .filter(Boolean);
  return sections.length > 0 ? sections.join("\n") : "無";
}

function createEmptyStrategyBrain() {
  return {
    version: 4,
    rules: [],
    candidateRules: [],
    checklists: createEmptyBrainChecklists(),
    lessons: [],
    commonMistakes: [],
    stats: {},
    lastUpdate: null,
    coachLessons: [],
    evolution: "",
  };
}

function normalizeStrategyBrain(value, { allowEmpty = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return allowEmpty ? createEmptyStrategyBrain() : null;
  }

  const normalized = createEmptyStrategyBrain();
  const normalizedRules = Array.isArray(value.rules)
    ? value.rules.map(item => normalizeBrainRule(item, { defaultStatus: "active" })).filter(Boolean)
    : [];
  const inlineCandidates = normalizedRules.filter(rule => rule.status === "candidate");
  normalized.rules = normalizedRules.filter(rule => rule.status !== "candidate");
  normalized.candidateRules = Array.isArray(value.candidateRules)
    ? value.candidateRules.map(item => normalizeBrainRule(item, { defaultStatus: "candidate" })).filter(Boolean)
    : inlineCandidates;
  normalized.checklists = normalizeBrainChecklists(value.checklists, [...normalized.rules, ...normalized.candidateRules]);
  normalized.lessons = Array.isArray(value.lessons)
    ? value.lessons
      .filter(item => item && typeof item.text === "string" && item.text.trim())
      .map(item => ({ date: item.date || toSlashDate(), text: item.text.trim() }))
    : [];
  normalized.commonMistakes = Array.isArray(value.commonMistakes) ? value.commonMistakes.filter(Boolean) : [];
  normalized.stats = value.stats && typeof value.stats === "object" && !Array.isArray(value.stats) ? { ...value.stats } : {};
  normalized.lastUpdate = typeof value.lastUpdate === "string" ? value.lastUpdate : null;
  normalized.evolution = typeof value.evolution === "string" ? value.evolution.trim() : "";
  normalized.coachLessons = Array.isArray(value.coachLessons)
    ? value.coachLessons
      .filter(item => item && typeof item.text === "string" && item.text.trim())
      .map(item => ({
        date: item.date || toSlashDate(),
        text: item.text.trim(),
        source: item.source || "",
        sourcePortfolioId: item.sourcePortfolioId || "",
        sourceEventId: item.sourceEventId ?? null,
      }))
    : [];

  const hasContent =
    normalized.rules.length > 0 ||
    normalized.candidateRules.length > 0 ||
    hasBrainChecklistContent(normalized.checklists) ||
    normalized.lessons.length > 0 ||
    normalized.commonMistakes.length > 0 ||
    normalized.coachLessons.length > 0 ||
    Object.keys(normalized.stats).length > 0 ||
    Boolean(normalized.lastUpdate) ||
    Boolean(normalized.evolution);

  return hasContent || allowEmpty ? normalized : null;
}

function mergeBrainPreservingCoachLessons(nextBrain, currentBrain) {
  if (!nextBrain || typeof nextBrain !== "object" || Array.isArray(nextBrain)) {
    return normalizeStrategyBrain(currentBrain);
  }
  const normalizedNext = normalizeStrategyBrain(nextBrain, { allowEmpty: true });
  const normalizedCurrent = normalizeStrategyBrain(currentBrain, { allowEmpty: true });
  const coachLessons = normalizedNext?.coachLessons?.length
    ? normalizedNext.coachLessons
    : (normalizedCurrent?.coachLessons || []);

  const hasField = (key) => Object.prototype.hasOwnProperty.call(nextBrain || {}, key);
  const merged = {
    version: 4,
    rules: hasField("rules") ? (normalizedNext?.rules || []) : (normalizedCurrent?.rules || []),
    candidateRules: hasField("candidateRules") ? (normalizedNext?.candidateRules || []) : (normalizedCurrent?.candidateRules || []),
    checklists: hasField("checklists")
      ? (normalizedNext?.checklists || createEmptyBrainChecklists())
      : (
        hasField("rules") || hasField("candidateRules")
          ? normalizeBrainChecklists(normalizedCurrent?.checklists, [...(normalizedNext?.rules || []), ...(normalizedNext?.candidateRules || [])])
          : (normalizedCurrent?.checklists || createEmptyBrainChecklists())
      ),
    lessons: hasField("lessons") ? (normalizedNext?.lessons || []) : (normalizedCurrent?.lessons || []),
    commonMistakes: hasField("commonMistakes") ? (normalizedNext?.commonMistakes || []) : (normalizedCurrent?.commonMistakes || []),
    stats: hasField("stats") ? (normalizedNext?.stats || {}) : (normalizedCurrent?.stats || {}),
    lastUpdate: hasField("lastUpdate") ? (normalizedNext?.lastUpdate || null) : (normalizedCurrent?.lastUpdate || null),
    coachLessons,
    evolution: hasField("evolution") ? (normalizedNext?.evolution || "") : (normalizedCurrent?.evolution || ""),
  };

  return normalizeStrategyBrain(merged, { allowEmpty: true });
}

function mergeBrainEvidenceRefs(primaryRefs, secondaryRefs, { limit = 4 } = {}) {
  return normalizeBrainEvidenceRefs([
    ...normalizeBrainEvidenceRefs(primaryRefs),
    ...normalizeBrainEvidenceRefs(secondaryRefs),
  ]).slice(0, limit);
}

function ensureBrainAuditCoverage(brainAudit, currentBrain, { dossiers = null } = {}) {
  const normalizedAudit = normalizeBrainAuditBuckets(brainAudit);
  const current = normalizeStrategyBrain(currentBrain, { allowEmpty: true });
  const rows = normalizeHoldingDossiers(dossiers);
  const reviewed = new Set([
    ...normalizedAudit.validatedRules,
    ...normalizedAudit.staleRules,
    ...normalizedAudit.invalidatedRules,
  ].map(item => item?.id || item?.text).filter(Boolean));

  const staleMap = new Map(
    normalizedAudit.staleRules
      .map(item => [item?.id || item?.text, item])
      .filter(([key]) => Boolean(key))
  );

  const scopedRules = [...(current.rules || []), ...(current.candidateRules || [])]
    .filter(rule => rows.length === 0 || rows.some(dossier => ruleMatchesValidationDossier(rule, dossier, null)));

  scopedRules.forEach(rule => {
    const key = brainRuleKey(rule);
    if (!key || reviewed.has(key) || staleMap.has(key)) return;
    const fallbackStaleness = normalizeBrainRuleStaleness(rule?.staleness) || (rule?.status === "candidate" ? "missing" : "aging");
    const fallbackConfidence = Number.isFinite(Number(rule?.validationScore))
      ? Math.max(25, Math.min(90, Math.round(Number(rule.validationScore))))
      : Number.isFinite(Number(rule?.confidence))
        ? Math.max(25, Math.min(90, Math.round(Number(rule.confidence) * 10)))
        : 35;
    staleMap.set(key, normalizeBrainAuditItem({
      id: rule?.id || "",
      text: brainRuleText(rule),
      bucket: "stale",
      reason: "今日分析未明確覆蓋此舊規則，先標記為待更新，避免在缺乏驗證時被當成仍然有效。",
      confidence: fallbackConfidence,
      staleness: fallbackStaleness,
      lastValidatedAt: rule?.lastValidatedAt || "",
      evidenceRefs: rule?.evidenceRefs || [],
    }, "stale"));
  });

  return normalizeBrainAuditBuckets({
    ...normalizedAudit,
    staleRules: Array.from(staleMap.values()),
  });
}

function applyAuditToBrainRule(rule, auditItem, {
  status = null,
  defaultStatus = "active",
} = {}) {
  const normalized = normalizeBrainRule(rule || {
    id: auditItem?.id || null,
    text: auditItem?.text || "",
    status: status || defaultStatus,
  }, {
    defaultStatus: status || defaultStatus,
  });
  if (!normalized) return null;

  const bucket = ["validated", "stale", "invalidated"].includes(auditItem?.bucket) ? auditItem.bucket : "validated";
  const auditConfidence = normalizeBrainAuditConfidence(auditItem?.confidence);
  const mergedEvidenceRefs = mergeBrainEvidenceRefs(auditItem?.evidenceRefs, normalized.evidenceRefs);
  const normalizedStatus = ["active", "candidate", "archived"].includes(status) ? status : (normalized.status || defaultStatus);

  let validationScore = Number.isFinite(Number(normalized.validationScore))
    ? Math.round(Number(normalized.validationScore))
    : deriveBrainRuleValidationScore({
      confidence: normalized.confidence,
      evidenceCount: normalized.evidenceCount,
      staleness: normalized.staleness,
      status: normalizedStatus,
    });
  let staleness = normalizeBrainRuleStaleness(normalized.staleness) || "missing";
  let confidence = normalized.confidence;
  let lastValidatedAt = normalized.lastValidatedAt || null;

  if (auditConfidence != null) {
    const convertedConfidence = Math.max(1, Math.min(10, Math.round(auditConfidence / 10)));
    confidence = confidence != null ? Math.max(confidence, convertedConfidence) : convertedConfidence;
  }

  if (bucket === "validated") {
    staleness = "fresh";
    lastValidatedAt = auditItem?.lastValidatedAt || toSlashDate();
    validationScore = Math.max(validationScore ?? 0, auditConfidence ?? 70, 70);
  } else if (bucket === "stale") {
    staleness = normalizeBrainRuleStaleness(auditItem?.staleness) || (normalizedStatus === "candidate" ? "missing" : "aging");
    validationScore = Math.min(validationScore ?? 65, auditConfidence ?? 65);
  } else if (bucket === "invalidated") {
    staleness = "stale";
    validationScore = Math.min(validationScore ?? 45, auditConfidence ?? 45);
  }

  const evidenceCount = Math.max(
    Number(normalized.evidenceCount) || 0,
    mergedEvidenceRefs.length,
    bucket === "validated" ? 1 : 0,
  );

  return normalizeBrainRule({
    ...normalized,
    status: normalizedStatus,
    confidence,
    evidenceCount,
    validationScore,
    lastValidatedAt,
    staleness,
    evidenceRefs: mergedEvidenceRefs,
    note: String(auditItem?.reason || "").trim() || normalized.note || "",
  }, {
    defaultStatus: normalizedStatus,
    defaultSource: normalized.source || "ai",
  });
}

function mergeBrainWithAuditLifecycle(nextBrain, currentBrain, brainAudit) {
  const normalizedCurrent = normalizeStrategyBrain(currentBrain, { allowEmpty: true });
  const normalizedNext = normalizeStrategyBrain(nextBrain, { allowEmpty: true });
  const coveredAudit = ensureBrainAuditCoverage(brainAudit, normalizedCurrent);

  const currentRules = [...(normalizedCurrent.rules || []), ...(normalizedCurrent.candidateRules || [])];
  const nextActiveRules = normalizedNext.rules || [];
  const nextCandidateRules = normalizedNext.candidateRules || [];

  const currentByKey = new Map(currentRules.map(rule => [brainRuleKey(rule), rule]).filter(([key]) => Boolean(key)));
  const nextActiveByKey = new Map(nextActiveRules.map(rule => [brainRuleKey(rule), rule]).filter(([key]) => Boolean(key)));
  const nextCandidateByKey = new Map(nextCandidateRules.map(rule => [brainRuleKey(rule), rule]).filter(([key]) => Boolean(key)));

  const activeMap = new Map(nextActiveRules.map(rule => [brainRuleKey(rule), rule]).filter(([key]) => Boolean(key)));
  const candidateMap = new Map(nextCandidateRules.map(rule => [brainRuleKey(rule), rule]).filter(([key]) => Boolean(key)));

  const resolveBaseRule = (auditItem) => {
    const key = auditItem?.id || auditItem?.text || "";
    return nextActiveByKey.get(key)
      || nextCandidateByKey.get(key)
      || currentByKey.get(key)
      || null;
  };

  const upsertRule = (map, rule) => {
    const key = brainRuleKey(rule);
    if (!key || !rule) return;
    map.set(key, rule);
  };

  coveredAudit.validatedRules.forEach(auditItem => {
    const rule = applyAuditToBrainRule(resolveBaseRule(auditItem), auditItem, { status: "active" });
    if (!rule) return;
    const key = brainRuleKey(rule);
    candidateMap.delete(key);
    activeMap.set(key, rule);
  });

  coveredAudit.staleRules.forEach(auditItem => {
    const baseRule = resolveBaseRule(auditItem);
    const targetStatus = baseRule?.status === "candidate" ? "candidate" : "active";
    const rule = applyAuditToBrainRule(baseRule, auditItem, { status: targetStatus });
    if (!rule) return;
    const key = brainRuleKey(rule);
    if (targetStatus === "candidate") {
      activeMap.delete(key);
      candidateMap.set(key, rule);
    } else {
      activeMap.set(key, rule);
      candidateMap.delete(key);
    }
  });

  coveredAudit.invalidatedRules.forEach(auditItem => {
    const baseRule = resolveBaseRule(auditItem);
    const nextStatus = auditItem?.nextStatus || "candidate";
    const auditKey = (auditItem?.id || auditItem?.text || "").trim();
    const baseKey = brainRuleKey(baseRule);
    if (nextStatus === "archived") {
      if (auditKey) {
        activeMap.delete(auditKey);
        candidateMap.delete(auditKey);
      }
      if (baseKey) {
        activeMap.delete(baseKey);
        candidateMap.delete(baseKey);
      }
      return;
    }
    const rule = applyAuditToBrainRule(baseRule, auditItem, { status: "candidate", defaultStatus: "candidate" });
    if (!rule) return;
    const ruleKey = brainRuleKey(rule);
    activeMap.delete(ruleKey);
    candidateMap.set(ruleKey, rule);
  });

  const merged = {
    version: 4,
    rules: Array.from(activeMap.values()).sort(compareBrainRulesByStrength).slice(0, 12),
    candidateRules: Array.from(candidateMap.values()).sort(compareBrainRulesByStrength).slice(0, 8),
    checklists: Object.prototype.hasOwnProperty.call(nextBrain || {}, "checklists")
      ? (normalizedNext.checklists || createEmptyBrainChecklists())
      : normalizeBrainChecklists(normalizedCurrent.checklists, [
        ...Array.from(activeMap.values()),
        ...Array.from(candidateMap.values()),
      ]),
    lessons: Object.prototype.hasOwnProperty.call(nextBrain || {}, "lessons") ? (normalizedNext.lessons || []) : (normalizedCurrent.lessons || []),
    commonMistakes: Object.prototype.hasOwnProperty.call(nextBrain || {}, "commonMistakes") ? (normalizedNext.commonMistakes || []) : (normalizedCurrent.commonMistakes || []),
    stats: Object.prototype.hasOwnProperty.call(nextBrain || {}, "stats") ? (normalizedNext.stats || {}) : (normalizedCurrent.stats || {}),
    lastUpdate: Object.prototype.hasOwnProperty.call(nextBrain || {}, "lastUpdate") ? (normalizedNext.lastUpdate || null) : (normalizedCurrent.lastUpdate || null),
    coachLessons: (normalizedNext.coachLessons || []).length > 0 ? normalizedNext.coachLessons : (normalizedCurrent.coachLessons || []),
    evolution: Object.prototype.hasOwnProperty.call(nextBrain || {}, "evolution") ? (normalizedNext.evolution || "") : (normalizedCurrent.evolution || ""),
  };

  return normalizeStrategyBrain(merged, { allowEmpty: true });
}

function formatPortfolioNotesContext(notes) {
  const normalized = notes && typeof notes === "object" ? { ...DEFAULT_PORTFOLIO_NOTES, ...notes } : DEFAULT_PORTFOLIO_NOTES;
  const lines = [
    normalized.riskProfile ? `風險屬性：${normalized.riskProfile}` : null,
    normalized.preferences ? `操作偏好：${normalized.preferences}` : null,
    normalized.customNotes ? `自訂備註：${normalized.customNotes}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? `個人備註：\n${lines.join("\n")}` : "個人備註：無";
}

export function normalizeWatchlist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const code = String(item.code || "").trim();
      const name = String(item.name || "").trim();
      if (!code || !name) return null;
      const price = Number(item.price);
      const target = Number(item.target);
      return {
        code,
        name,
        price: Number.isFinite(price) && price > 0 ? price : 0,
        target: Number.isFinite(target) && target > 0 ? target : 0,
        status: typeof item.status === "string" ? item.status.trim() : "",
        catalyst: typeof item.catalyst === "string" ? item.catalyst.trim() : "",
        scKey: typeof item.scKey === "string" ? item.scKey : "blue",
        note: typeof item.note === "string" ? item.note.trim() : "",
      };
    })
    .filter(Boolean);
}

export function normalizeFundamentalsEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const readNumber = (raw) => {
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const normalizeRevenueHistory = (items) => Array.isArray(items)
    ? items.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const month = String(item.month || item.revenueMonth || "").trim();
        const releasedAt = String(item.releasedAt || item.updatedAt || "").trim();
        const yoy = readNumber(item.yoy ?? item.revenueYoY);
        const mom = readNumber(item.mom ?? item.revenueMoM);
        if (!month && yoy == null && mom == null && !releasedAt) return null;
        return {
          month: month || null,
          yoy,
          mom,
          releasedAt: releasedAt || null,
        };
      }).filter(Boolean).slice(0, 12)
    : [];
  const revenueMonth = typeof value.revenueMonth === "string" ? value.revenueMonth.trim() : "";
  const quarter = typeof value.quarter === "string" ? value.quarter.trim() : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : "";
  const conferenceDate = typeof value.conferenceDate === "string" ? value.conferenceDate.trim() : "";
  const earningsDate = typeof value.earningsDate === "string" ? value.earningsDate.trim() : "";
  const source = typeof value.source === "string" ? value.source.trim() : "";
  const note = typeof value.note === "string" ? value.note.trim() : "";
  const normalized = {
    revenueMonth: revenueMonth || null,
    revenueYoY: readNumber(value.revenueYoY),
    revenueMoM: readNumber(value.revenueMoM),
    eps: readNumber(value.eps),
    grossMargin: readNumber(value.grossMargin),
    roe: readNumber(value.roe),
    quarter: quarter || null,
    updatedAt: updatedAt || null,
    conferenceDate: conferenceDate || null,
    earningsDate: earningsDate || null,
    revenueHistory: normalizeRevenueHistory(value.revenueHistory),
    source: source || "",
    note: note || "",
  };
  const numericValues = [
    normalized.revenueYoY,
    normalized.revenueMoM,
    normalized.eps,
    normalized.grossMargin,
    normalized.roe,
  ].filter(item => item != null);
  const looksLikePlaceholderZeros = numericValues.length > 0
    && numericValues.every(item => Number(item) === 0)
    && !normalized.revenueMonth
    && !normalized.quarter
    && !normalized.note;
  if (looksLikePlaceholderZeros) return null;
  const hasContent = Object.values(normalized).some(item => item !== null && item !== "");
  return hasContent ? normalized : null;
}

export function normalizeFundamentalsStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([code, entry]) => {
        const normalized = normalizeFundamentalsEntry(entry);
        return normalized ? [code, normalized] : null;
      })
      .filter(Boolean)
  );
}

export function normalizeAnalystReportItem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = String(value.id || "").trim();
  const title = String(value.title || "").trim();
  const url = String(value.url || "").trim();
  if (!id || !title) return null;
  const target = Number(value.target);
  const confidence = Number(value.confidence);
  return {
    id,
    title,
    url,
    source: String(value.source || "").trim(),
    publishedAt: String(value.publishedAt || "").trim() || null,
    snippet: String(value.snippet || "").trim(),
    summary: String(value.summary || "").trim(),
    firm: String(value.firm || "").trim(),
    target: Number.isFinite(target) && target > 0 ? target : null,
    stance: ["bullish", "neutral", "bearish", "unknown"].includes(value.stance) ? value.stance : "unknown",
    tags: Array.isArray(value.tags) ? value.tags.filter(Boolean).slice(0, 5) : [],
    confidence: Number.isFinite(confidence) ? confidence : null,
    extractedAt: String(value.extractedAt || "").trim() || null,
    hash: String(value.hash || id).trim(),
  };
}

export function normalizeAnalystReportsStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([code, entry]) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const items = Array.isArray(entry.items)
          ? entry.items.map(normalizeAnalystReportItem).filter(Boolean)
          : [];
        const latestPublishedAt = String(entry.latestPublishedAt || "").trim() || null;
        const latestTargetAt = String(entry.latestTargetAt || "").trim() || null;
        return [code, {
          items,
          latestPublishedAt,
          latestTargetAt,
          lastCheckedAt: String(entry.lastCheckedAt || "").trim() || null,
        }];
      })
      .filter(Boolean)
  );
}

export function normalizeReportRefreshMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [code, entry] of Object.entries(value)) {
    if (code === "__daily") {
      normalized.__daily = {
        date: String(entry?.date || "").trim() || null,
        processedCodes: Array.isArray(entry?.processedCodes) ? entry.processedCodes.filter(Boolean) : [],
        runCount: Number(entry?.runCount) || 0,
        lastRunAt: String(entry?.lastRunAt || "").trim() || null,
      };
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    normalized[code] = {
      lastCheckedAt: String(entry.lastCheckedAt || "").trim() || null,
      lastChangedAt: String(entry.lastChangedAt || "").trim() || null,
      lastStatus: String(entry.lastStatus || "").trim() || "idle",
      lastMessage: String(entry.lastMessage || "").trim() || "",
      lastHashes: Array.isArray(entry.lastHashes) ? entry.lastHashes.filter(Boolean).slice(0, 20) : [],
      checkedDate: String(entry.checkedDate || "").trim() || null,
    };
  }
  return normalized;
}

export function mergeAnalystReportItems(existingItems, nextItems) {
  const merged = [...(Array.isArray(existingItems) ? existingItems : [])];
  (Array.isArray(nextItems) ? nextItems : []).forEach(item => {
    const normalized = normalizeAnalystReportItem(item);
    if (!normalized) return;
    const idx = merged.findIndex(existing => existing.id === normalized.id || existing.hash === normalized.hash);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...normalized };
    else merged.push(normalized);
  });
  return merged
    .sort((a, b) => {
      const aTime = parseFlexibleDate(a.publishedAt || a.extractedAt || 0)?.getTime() || 0;
      const bTime = parseFlexibleDate(b.publishedAt || b.extractedAt || 0)?.getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, 12);
}

export function formatAnalystReportSummary(items, limit = 2) {
  const rows = (Array.isArray(items) ? items : [])
    .map(item => {
      const summary = item.summary || item.title;
      const source = item.firm || item.source || "公開來源";
      const target = item.target ? ` 目標價 ${item.target}` : "";
      return `${source}${target}：${summary}`;
    })
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join("；") : "無";
}

export function formatFundamentalsSummary(entry) {
  const normalized = normalizeFundamentalsEntry(entry);
  if (!normalized) return "尚未建立";
  const parts = [
    normalized.revenueMonth ? `${normalized.revenueMonth} 營收` : null,
    normalized.revenueYoY != null ? `YoY ${normalized.revenueYoY >= 0 ? "+" : ""}${normalized.revenueYoY.toFixed(1)}%` : null,
    normalized.revenueMoM != null ? `MoM ${normalized.revenueMoM >= 0 ? "+" : ""}${normalized.revenueMoM.toFixed(1)}%` : null,
    normalized.eps != null ? `EPS ${normalized.eps.toFixed(2)}` : null,
    normalized.grossMargin != null ? `毛利率 ${normalized.grossMargin.toFixed(1)}%` : null,
    normalized.roe != null ? `ROE ${normalized.roe.toFixed(1)}%` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "尚未建立";
}

export function mergeTargetReports(existingReports, incomingReports) {
  const merged = [...(Array.isArray(existingReports) ? existingReports : [])];
  (Array.isArray(incomingReports) ? incomingReports : []).forEach(report => {
    const firm = String(report?.firm || "").trim();
    const date = String(report?.date || "").trim();
    const target = Number(report?.target);
    if (!firm || !Number.isFinite(target) || target <= 0) return;
    const normalized = { firm, target, date: date || toSlashDate() };
    const idx = merged.findIndex(item => item?.firm === normalized.firm && String(item?.date || "") === normalized.date);
    if (idx >= 0) merged[idx] = normalized;
    else merged.push(normalized);
  });
  return merged;
}

export function createDefaultReviewForm(overrides = {}) {
  return { ...DEFAULT_REVIEW_FORM, ...overrides };
}

export function createDefaultEventDraft(overrides = {}) {
  return { ...DEFAULT_NEW_EVENT, ...overrides };
}

export function createDefaultFundamentalDraft(overrides = {}) {
  return { ...DEFAULT_FUNDAMENTAL_DRAFT, ...overrides };
}

export function isClosedEvent(event) {
  return CLOSED_EVENT_STATUSES.has(event?.status);
}

function toSlashDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function parseSlashDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysBetween(fromValue, toValue = new Date()) {
  const from = fromValue instanceof Date ? new Date(fromValue) : parseSlashDate(fromValue);
  const to = toValue instanceof Date ? new Date(toValue) : parseSlashDate(toValue);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function getEventStockCodes(event) {
  return Array.from(new Set(
    (event?.stocks || [])
      .map(stock => String(stock).match(/\d{4,6}[A-Z]?L?/i)?.[0] || null)
      .filter(Boolean)
  ));
}

export function normalizePriceRecord(value, event) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const codes = getEventStockCodes(event);
    return codes.length === 1 ? { [codes[0]]: value } : null;
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value)
    .map(([code, price]) => [code, Number(price)])
    .filter(([, price]) => Number.isFinite(price) && price > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function normalizePriceHistory(value, event) {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const date = typeof entry.date === "string" ? entry.date : null;
      const prices = normalizePriceRecord(entry.prices, event);
      if (!date || !prices) return null;
      return { date, prices };
    })
    .filter(Boolean)
    .slice(-EVENT_HISTORY_LIMIT);
}

export function parseEventStockDescriptor(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const code = String(value.code || "").trim();
    const name = String(value.name || "").trim() || STOCK_META[code]?.name || code;
    return code ? { code, name } : null;
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  const code = raw.match(/\d{4,6}[A-Z]?L?/i)?.[0] || "";
  if (!code) return null;
  const stripped = raw
    .replace(code, " ")
    .replace(/[()（）-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    code,
    name: stripped || STOCK_META[code]?.name || code,
  };
}

export function buildEventStockDescriptors(event) {
  return (Array.isArray(event?.stocks) ? event.stocks : [])
    .map(parseEventStockDescriptor)
    .filter(Boolean);
}

export function averagePriceRecord(value) {
  const prices = Object.values(value || {})
    .map(Number)
    .filter(price => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

export function inferEventActual(priceAtEvent, priceAtExit, weights = null) {
  // 如果有权重，使用加權平均
  if (weights && typeof weights === "object" && !Array.isArray(weights)) {
    const codes = Object.keys(priceAtEvent || {}).filter(code => 
      Object.keys(priceAtExit || {}).includes(code) && Object.keys(weights).includes(code)
    );
    if (codes.length > 0) {
      const totalWeight = codes.reduce((sum, code) => sum + (weights[code] || 0), 0);
      if (totalWeight > 0) {
        let weightedEntry = 0;
        let weightedExit = 0;
        codes.forEach(code => {
          const weight = (weights[code] || 0) / totalWeight;
          weightedEntry += (priceAtEvent[code] || 0) * weight;
          weightedExit += (priceAtExit[code] || 0) * weight;
        });
        if (weightedEntry > 0 && weightedExit > 0) {
          const pct = ((weightedExit / weightedEntry) - 1) * 100;
          if (Math.abs(pct) <= 1) return "neutral";
          return pct > 0 ? "up" : "down";
        }
      }
    }
  }
  
  // 退化為簡單平均（向後相容）
  const entryAvg = averagePriceRecord(priceAtEvent);
  const exitAvg = averagePriceRecord(priceAtExit);
  if (!entryAvg || !exitAvg) return null;
  const pct = ((exitAvg / entryAvg) - 1) * 100;
  if (Math.abs(pct) <= 1) return "neutral";
  return pct > 0 ? "up" : "down";
}

// 新增：計算個股漲跌幅，用於多股票事件的詳細顯示
export function inferEventStockOutcomes(priceAtEvent, priceAtExit) {
  if (!priceAtEvent || !priceAtExit) return [];
  const codes = new Set([...Object.keys(priceAtEvent), ...Object.keys(priceAtExit)]);
  return Array.from(codes).map(code => {
    const entry = priceAtEvent[code];
    const exit = priceAtExit[code];
    if (!entry || !exit) return { code, outcome: "inconclusive", changePct: null };
    const pct = ((exit / entry) - 1) * 100;
    let outcome = "inconclusive";
    if (Math.abs(pct) <= 1) outcome = "neutral";
    else outcome = pct > 0 ? "up" : "down";
    return { code, outcome, changePct: Math.round(pct * 100) / 100 };
  });
}

export function appendPriceHistory(history, date, prices) {
  const next = Array.isArray(history) ? [...history] : [];
  const idx = next.findIndex(item => item?.date === date);
  const record = { date, prices };
  if (idx >= 0) next[idx] = record;
  else next.push(record);
  return next.slice(-EVENT_HISTORY_LIMIT);
}

export function normalizeEventOutcomeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["supported", "contradicted", "mixed", "inconclusive"].includes(normalized) ? normalized : "inconclusive";
}

export function normalizeEventStockOutcome(value, event) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const descriptor = parseEventStockDescriptor(value) || parseEventStockDescriptor({ code: value.code, name: value.name });
  const code = descriptor?.code || "";
  if (!code) return null;
  const predicted = ["up", "down", "neutral"].includes(value.predicted) ? value.predicted : (["up", "down", "neutral"].includes(event?.pred) ? event.pred : null);
  const actual = ["up", "down", "neutral"].includes(value.actual)
    ? value.actual
    : inferEventActual(
      Number.isFinite(Number(value.priceAtEvent)) ? { [code]: Number(value.priceAtEvent) } : event?.priceAtEvent,
      Number.isFinite(Number(value.priceAtExit)) ? { [code]: Number(value.priceAtExit) } : event?.priceAtExit,
    );
  const priceAtEvent = Number(value.priceAtEvent);
  const priceAtExit = Number(value.priceAtExit);
  const changePct = Number(value.changePct);
  const thesisHeld = typeof value.thesisHeld === "boolean" ? value.thesisHeld : null;
  return {
    code,
    name: descriptor?.name || code,
    predicted,
    actual: actual || null,
    priceAtEvent: Number.isFinite(priceAtEvent) && priceAtEvent > 0 ? priceAtEvent : null,
    priceAtExit: Number.isFinite(priceAtExit) && priceAtExit > 0 ? priceAtExit : null,
    changePct: Number.isFinite(changePct) ? Math.round(changePct * 100) / 100 : null,
    thesisHeld,
    outcomeLabel: normalizeEventOutcomeLabel(value.outcomeLabel),
    note: String(value.note || "").trim(),
  };
}

export function buildEventStockOutcomes(event) {
  const descriptors = buildEventStockDescriptors(event);
  if (descriptors.length === 0) return [];
  return descriptors
    .map(({ code, name }) => {
      const entryPrice = Number(event?.priceAtEvent?.[code]);
      const exitPrice = Number(event?.priceAtExit?.[code]);
      const actual = inferEventActual(
        Number.isFinite(entryPrice) && entryPrice > 0 ? { [code]: entryPrice } : null,
        Number.isFinite(exitPrice) && exitPrice > 0 ? { [code]: exitPrice } : null,
      ) || (descriptors.length === 1 && ["up", "down", "neutral"].includes(event?.actual) ? event.actual : null);
      const changePct = Number.isFinite(entryPrice) && entryPrice > 0 && Number.isFinite(exitPrice) && exitPrice > 0
        ? ((exitPrice / entryPrice) - 1) * 100
        : null;
      const predicted = ["up", "down", "neutral"].includes(event?.pred) ? event.pred : null;
      let outcomeLabel = "inconclusive";
      if (predicted && actual) {
        if (predicted === actual) outcomeLabel = "supported";
        else if (actual === "neutral" || predicted === "neutral") outcomeLabel = "mixed";
        else outcomeLabel = "contradicted";
      }
      const thesisHeld = outcomeLabel === "supported" ? true : outcomeLabel === "contradicted" ? false : null;
      const autoNote = Number.isFinite(changePct)
        ? `${name} 事件價 ${entryPrice.toFixed(1)} → 結案 ${exitPrice.toFixed(1)}（${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%）`
        : (event?.actualNote || "");
      return normalizeEventStockOutcome({
        code,
        name,
        predicted,
        actual,
        priceAtEvent: entryPrice,
        priceAtExit: exitPrice,
        changePct,
        thesisHeld,
        outcomeLabel,
        note: autoNote,
      }, event);
    })
    .filter(Boolean);
}

export function formatEventStockOutcomeLine(outcome) {
  if (!outcome) return "";
  const actualLabel = outcome.actual === "up" ? "上漲" : outcome.actual === "down" ? "下跌" : outcome.actual === "neutral" ? "中性" : "未明";
  const verdict = outcome.outcomeLabel === "supported"
    ? "支持原判斷"
    : outcome.outcomeLabel === "contradicted"
      ? "與原判斷相反"
      : outcome.outcomeLabel === "mixed"
        ? "部分支持"
        : "暫無定論";
  const pct = Number.isFinite(Number(outcome.changePct))
    ? `（${Number(outcome.changePct) >= 0 ? "+" : ""}${Number(outcome.changePct).toFixed(1)}%）`
    : "";
  return `${outcome.name || outcome.code}：${actualLabel}${pct}｜${verdict}`;
}

export function normalizeEventRecord(event) {
  if (!event || typeof event !== "object") return null;
  const status = event.status === "tracking" ? "tracking" : isClosedEvent(event) ? "closed" : "pending";
  const priceAtEvent = normalizePriceRecord(event.priceAtEvent, event);
  const priceAtExit = normalizePriceRecord(event.priceAtExit, event);
  const reviewDate = event.reviewDate || null;
  const eventDate = event.eventDate || (status === "closed" ? event.date || reviewDate || null : null);
  const trackingStart = event.trackingStart || eventDate || null;
  const exitDate = event.exitDate || (status === "closed" ? reviewDate || null : null);
  const actual = ["up", "down", "neutral"].includes(event.actual) ? event.actual : inferEventActual(priceAtEvent, priceAtExit);
  const stockOutcomes = Array.isArray(event.stockOutcomes) && event.stockOutcomes.length > 0
    ? event.stockOutcomes.map(item => normalizeEventStockOutcome(item, event)).filter(Boolean)
    : (status === "closed" ? buildEventStockOutcomes({ ...event, priceAtEvent, priceAtExit, actual }) : []);

  return {
    ...event,
    status,
    stocks: buildEventStockDescriptors(event).map(item => `${item.name} ${item.code}`),
    eventDate,
    trackingStart,
    exitDate,
    priceAtEvent,
    priceAtExit,
    priceHistory: normalizePriceHistory(event.priceHistory, event),
    actual: actual || null,
    actualNote: event.actualNote || "",
    stockOutcomes,
    correct: typeof event.correct === "boolean" ? event.correct : null,
    lessons: event.lessons || "",
    reviewDate,
  };
}

export function normalizeNewsEvents(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeEventRecord)
    .filter(Boolean);
}

export function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const slashDate = parseSlashDate(raw);
  if (slashDate) return slashDate;
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysSince(value, now = new Date()) {
  const parsed = parseFlexibleDate(value);
  if (!parsed) return null;
  const current = now instanceof Date ? new Date(now) : parseFlexibleDate(now);
  if (!current) return null;
  parsed.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  return Math.round((current - parsed) / (1000 * 60 * 60 * 24));
}

export function computeStaleness(value, thresholdDays, { missingWhenEmpty = true, now = new Date() } = {}) {
  if (value == null || value === "") return missingWhenEmpty ? "missing" : "stale";
  const age = daysSince(value, now);
  if (age == null) return "missing";
  return age <= thresholdDays ? "fresh" : "stale";
}

export function averageTargetFromEntry(entry) {
  const reports = Array.isArray(entry?.reports) ? entry.reports : [];
  const targets = reports
    .map(report => Number(report?.target))
    .filter(value => Number.isFinite(value) && value > 0);
  if (targets.length === 0) return null;
  return Math.round(targets.reduce((sum, value) => sum + value, 0) / targets.length);
}

export function extractResearchConclusion(report) {
  const lastRound = Array.isArray(report?.rounds) && report.rounds.length > 0
    ? report.rounds[report.rounds.length - 1]
    : null;
  const content = typeof lastRound?.content === "string" ? lastRound.content : "";
  const match = content.match(/(?:結論|建議|策略)[：:]\s*(.{0,300})/);
  return (match?.[1] || content.slice(0, 300) || "").trim();
}

export function buildBrainTokens(holding, meta) {
  return [
    holding?.code,
    holding?.name,
    meta?.industry,
    meta?.strategy,
    meta?.period,
    meta?.position,
    meta?.leader,
    holding?.type,
  ]
    .filter(Boolean)
    .map(token => String(token).trim().toLowerCase())
    .filter(token => token.length >= 2);
}

export function textMatchesBrainTokens(text, tokens) {
  const source = brainRuleText(text).toLowerCase();
  if (!source) return false;
  return tokens.some(token => source.includes(token));
}

export function summarizeEventForDossier(event) {
  if (!event) return null;
  return {
    id: event.id,
    date: event.date || null,
    title: event.title || "",
    status: event.status || "pending",
    pred: event.pred || null,
    actual: event.actual || null,
    correct: typeof event.correct === "boolean" ? event.correct : null,
    trackingStart: event.trackingStart || null,
    exitDate: event.exitDate || null,
  };
}

export function normalizeTaiwanValidationSignalStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["fresh", "watch", "stale", "missing"].includes(normalized) ? normalized : "missing";
}

export function formatTaiwanValidationSignalLabel(value) {
  switch (normalizeTaiwanValidationSignalStatus(value)) {
    case "fresh":
      return "有效";
    case "watch":
      return "窗口內";
    case "stale":
      return "過期";
    case "missing":
    default:
      return "缺資料";
  }
}

export function detectTaiwanEventSignal(events, keywords, { now = new Date(), beforeDays = 14, afterDays = 7 } = {}) {
  const rows = Array.isArray(events) ? events.filter(Boolean) : [];
  const matched = rows.filter(event => {
    const title = String(event?.title || "").trim().toLowerCase();
    return keywords.some(keyword => title.includes(keyword));
  });
  if (matched.length === 0) return { status: "missing", title: "", date: null };

  const tracking = matched.find(event => event.status === "tracking");
  if (tracking) return { status: "fresh", title: tracking.title || "", date: tracking.date || tracking.trackingStart || null };

  const pending = matched
    .map(event => ({ event, days: daysSince(event.date || event.trackingStart, now) }))
    .find(item => item.days != null && item.days <= 0 && Math.abs(item.days) <= beforeDays);
  if (pending) {
    return {
      status: "watch",
      title: pending.event.title || "",
      date: pending.event.date || pending.event.trackingStart || null,
    };
  }

  const closed = matched
    .map(event => ({ event, days: daysSince(event.exitDate || event.date, now) }))
    .find(item => item.days != null && item.days >= 0 && item.days <= afterDays);
  if (closed) {
    return {
      status: "fresh",
      title: closed.event.title || "",
      date: closed.event.exitDate || closed.event.date || null,
    };
  }

  const latest = matched
    .map(event => ({
      event,
      date: parseFlexibleDate(event.exitDate || event.date || event.trackingStart || null)?.getTime() || 0,
    }))
    .sort((a, b) => b.date - a.date)[0];

  return {
    status: "stale",
    title: latest?.event?.title || "",
    date: latest?.event?.exitDate || latest?.event?.date || latest?.event?.trackingStart || null,
  };
}

export function buildTaiwanValidationSignals({ fundamentals = {}, targets = {}, analyst = {}, events = {}, research = {} } = {}, { now = new Date() } = {}) {
  const relatedEvents = [
    ...(Array.isArray(events.pending) ? events.pending : []),
    ...(Array.isArray(events.tracking) ? events.tracking : []),
    ...(events.latestClosed ? [events.latestClosed] : []),
  ];
  const monthlyRevenueGate = fundamentals.revenueMonth
    ? (fundamentals.freshness === "fresh" ? "fresh" : "stale")
    : "missing";
  const conferenceSignal = detectTaiwanEventSignal(relatedEvents, ["法說", "說明會"], { now, beforeDays: 14, afterDays: 10 });
  const earningsSignal = detectTaiwanEventSignal(relatedEvents, ["財報", "季報", "年報", "業績"], { now, beforeDays: 21, afterDays: 14 });
  const targetFreshnessGate = [targets.freshness, analyst.freshness].includes("fresh")
    ? "fresh"
    : ([targets.freshness, analyst.freshness].includes("stale") ? "stale" : "missing");
  const researchGate = research.freshness === "fresh" ? "fresh" : (research.freshness === "stale" ? "stale" : "missing");
  const primaryStatuses = [monthlyRevenueGate, conferenceSignal.status, earningsSignal.status, targetFreshnessGate]
    .map(normalizeTaiwanValidationSignalStatus);
  let hardGateStatus = "missing";
  if (primaryStatuses.some(status => status === "stale")) {
    hardGateStatus = "stale";
  } else if (primaryStatuses.some(status => status === "watch")) {
    hardGateStatus = "watch";
  } else if (primaryStatuses.some(status => status === "fresh")) {
    hardGateStatus = "fresh";
  }

  return {
    monthlyRevenueGate,
    conferenceGate: conferenceSignal.status,
    conferenceDate: conferenceSignal.date,
    conferenceTitle: conferenceSignal.title,
    earningsGate: earningsSignal.status,
    earningsDate: earningsSignal.date,
    earningsTitle: earningsSignal.title,
    targetFreshnessGate,
    researchGate,
    hardGateStatus,
  };
}

export function buildHoldingDossiers({
  holdings,
  watchlist,
  targets,
  fundamentals,
  analystReports,
  newsEvents,
  researchHistory,
  strategyBrain,
  marketPriceCache,
  marketPriceSync,
}) {
  const rows = Array.isArray(holdings) ? holdings : [];
  const notesByCode = new Map((Array.isArray(watchlist) ? watchlist : []).map(item => [item.code, item]));
  const events = normalizeNewsEvents(newsEvents || []);
  const allResearch = Array.isArray(researchHistory) ? researchHistory : [];
  const fundamentalsStore = normalizeFundamentalsStore(fundamentals);
  const analystStore = normalizeAnalystReportsStore(analystReports);
  const brain = normalizeStrategyBrain(strategyBrain, { allowEmpty: true });
  const now = new Date();
  const todayClock = getTaipeiClock(now);
  const marketCache = normalizeMarketPriceCache(marketPriceCache);
  const marketSync = normalizeMarketPriceSync(marketPriceSync);
  const buildStamp = marketSync?.syncedAt || marketCache?.syncedAt || null;

  return rows.map(holding => {
    const meta = STOCK_META[holding.code] || null;
    const noteRow = notesByCode.get(holding.code) || null;
    const targetEntry = targets?.[holding.code] || null;
    const relatedEvents = events.filter(event => getEventStockCodes(event).includes(holding.code));
    const pendingEvents = relatedEvents.filter(event => event.status === "pending").map(summarizeEventForDossier);
    const trackingEvents = relatedEvents.filter(event => event.status === "tracking").map(summarizeEventForDossier);
    const latestClosed = relatedEvents
      .filter(isClosedEvent)
      .sort((a, b) => {
        const aDate = parseFlexibleDate(a.reviewDate || a.exitDate || a.date || 0)?.getTime() || 0;
        const bDate = parseFlexibleDate(b.reviewDate || b.exitDate || b.date || 0)?.getTime() || 0;
        return bDate - aDate;
      })[0] || null;

    const latestResearch = allResearch
      .filter(report => report?.code === holding.code)
      .sort((a, b) => {
        const aTime = Number(a?.timestamp) || parseFlexibleDate(a?.date)?.getTime() || 0;
        const bTime = Number(b?.timestamp) || parseFlexibleDate(b?.date)?.getTime() || 0;
        return bTime - aTime;
      })[0] || null;

    const avgTarget = averageTargetFromEntry(targetEntry);
    const targetFreshness = targetEntry?.reports?.length ? computeStaleness(targetEntry.updatedAt, 30, { now }) : "missing";
    const researchFreshness = latestResearch ? computeStaleness(latestResearch.date || latestResearch.timestamp, 30, { now }) : "missing";
    const fundamentalsEntry = fundamentalsStore[holding.code] || null;
    const fundamentalFreshness = fundamentalsEntry ? computeStaleness(fundamentalsEntry.updatedAt, 45, { now }) : "missing";
    const analystEntry = analystStore[holding.code] || { items: [] };
    const analystFreshness = analystEntry.items?.length > 0
      ? computeStaleness(analystEntry.latestPublishedAt || analystEntry.lastCheckedAt, 14, { now })
      : "missing";
    const quote = marketCache?.prices?.[holding.code] || null;
    const failedCodes = Array.isArray(marketSync?.failedCodes) ? marketSync.failedCodes : [];
    const priceFreshness = quote?.price
      ? (marketSync?.marketDate === todayClock.marketDate && !failedCodes.includes(holding.code) ? "fresh" : "stale")
      : "missing";

    const brainTokens = buildBrainTokens(holding, meta);
    const matchedRules = (brain.rules || [])
      .filter(rule => textMatchesBrainTokens(rule, brainTokens))
      .sort(compareBrainRulesByStrength)
      .slice(0, 5);
    const matchedCandidateRules = (brain.candidateRules || [])
      .filter(rule => textMatchesBrainTokens(rule, brainTokens))
      .sort(compareBrainRulesByStrength)
      .slice(0, 3);
    const matchedMistakes = (brain.commonMistakes || []).filter(item => textMatchesBrainTokens(item, brainTokens)).slice(0, 5);
    const matchedLessons = (brain.lessons || []).filter(item => textMatchesBrainTokens(item?.text, brainTokens)).slice(-5);
    const matchedCoachLessons = (brain.coachLessons || []).filter(item => textMatchesBrainTokens(item?.text, brainTokens)).slice(-5);
    const taiwanValidationSignals = buildTaiwanValidationSignals({
      fundamentals: {
        revenueMonth: fundamentalsEntry?.revenueMonth || null,
        freshness: fundamentalFreshness,
      },
      targets: { freshness: targetFreshness },
      analyst: { freshness: analystFreshness },
      research: { freshness: researchFreshness },
      events: {
        pending: pendingEvents,
        tracking: trackingEvents,
        latestClosed: latestClosed ? summarizeEventForDossier(latestClosed) : null,
      },
    }, { now });

    return {
      code: holding.code,
      name: holding.name,
      position: {
        qty: holding.qty,
        cost: holding.cost,
        price: holding.price,
        value: getHoldingMarketValue(holding),
        pnl: getHoldingUnrealizedPnl(holding),
        pct: getHoldingReturnPct(holding),
        type: holding.type || "股票",
        alert: holding.alert || "",
        expire: holding.expire || null,
        warrantTargetPrice: Number.isFinite(Number(holding.targetPrice)) ? Number(holding.targetPrice) : null,
      },
      meta: meta ? { ...meta } : null,
      thesis: {
        summary: noteRow?.note || holding.alert || "",
        catalyst: noteRow?.catalyst || "",
        status: noteRow?.status || "",
        holdingPeriod: meta?.period || "",
      },
      targets: {
        avgTarget,
        reports: Array.isArray(targetEntry?.reports) ? targetEntry.reports : [],
        updatedAt: targetEntry?.updatedAt || null,
        isNew: Boolean(targetEntry?.isNew),
        freshness: targetFreshness,
      },
      fundamentals: {
        revenueMonth: fundamentalsEntry?.revenueMonth || null,
        revenueYoY: fundamentalsEntry?.revenueYoY ?? null,
        revenueMoM: fundamentalsEntry?.revenueMoM ?? null,
        eps: fundamentalsEntry?.eps ?? null,
        grossMargin: fundamentalsEntry?.grossMargin ?? null,
        roe: fundamentalsEntry?.roe ?? null,
        quarter: fundamentalsEntry?.quarter || null,
        updatedAt: fundamentalsEntry?.updatedAt || null,
        source: fundamentalsEntry?.source || "",
        note: fundamentalsEntry?.note || "",
        freshness: fundamentalFreshness,
      },
      events: {
        pending: pendingEvents,
        tracking: trackingEvents,
        latestClosed: latestClosed ? summarizeEventForDossier(latestClosed) : null,
      },
      research: latestResearch ? {
        latestConclusion: extractResearchConclusion(latestResearch),
        latestAt: latestResearch.date || null,
        latestTimestamp: latestResearch.timestamp || null,
        freshness: researchFreshness,
      } : {
        latestConclusion: "",
        latestAt: null,
        latestTimestamp: null,
        freshness: "missing",
      },
      analyst: {
        latestSummary: formatAnalystReportSummary(analystEntry.items, 2),
        latestAt: analystEntry.latestPublishedAt || null,
        latestTargetAt: analystEntry.latestTargetAt || null,
        items: analystEntry.items || [],
        freshness: analystFreshness,
      },
      brainContext: {
        matchedRules,
        matchedCandidateRules,
        matchedMistakes,
        matchedLessons,
        matchedCoachLessons,
      },
      validationSignals: taiwanValidationSignals,
      freshness: {
        price: priceFreshness,
        targets: targetFreshness,
        fundamentals: fundamentalFreshness,
        research: researchFreshness,
        analyst: analystFreshness,
      },
      sync: {
        lastBuiltAt: buildStamp,
        usedMarketDate: marketCache?.marketDate || null,
        priceSyncStatus: marketSync?.status || "idle",
      },
    };
  });
}

function normalizeHoldingDossiers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === "object" && typeof item.code === "string" && typeof item.name === "string")
    .map(item => ({ ...item }));
}

function listTaiwanHardGateIssues(dossier) {
  const signals = dossier?.validationSignals || {};
  const items = [
    { key: "monthlyRevenueGate", label: "月營收", status: signals.monthlyRevenueGate },
    { key: "conferenceGate", label: "法說", status: signals.conferenceGate },
    { key: "earningsGate", label: "財報", status: signals.earningsGate },
    { key: "targetFreshnessGate", label: "目標價/報告", status: signals.targetFreshnessGate },
  ].map(item => ({ ...item, status: normalizeTaiwanValidationSignalStatus(item.status) }));
  return items.filter(item => ["missing", "stale"].includes(item.status));
}

export function buildTaiwanHardGateEvidenceRefs(dossier, issues) {
  return (Array.isArray(issues) ? issues : []).slice(0, 4).map(item => ({
    type: "dossier",
    refId: `dossier-${dossier?.code || "unknown"}`,
    code: dossier?.code || "",
    label: `${dossier?.name || dossier?.code || "持股"} ${item.label}${formatTaiwanValidationSignalLabel(item.status)}`,
    date: dossier?.sync?.lastBuiltAt || null,
  }));
}

export function formatTaiwanHardGateIssueList(issues) {
  return (Array.isArray(issues) ? issues : [])
    .map(item => `${item.label}${formatTaiwanValidationSignalLabel(item.status)}`)
    .join("、");
}

export function enforceTaiwanHardGatesOnBrainAudit(brainAudit, currentBrain, {
  dossiers = null,
  defaultLastValidatedAt = null,
} = {}) {
  const normalizedAudit = normalizeBrainAuditBuckets(brainAudit);
  const rows = normalizeHoldingDossiers(dossiers);
  if (rows.length === 0) return normalizedAudit;

  const current = normalizeStrategyBrain(currentBrain, { allowEmpty: true });
  const allRules = [
    ...(current.rules || []),
    ...(current.candidateRules || []),
  ];
  const byId = new Map(allRules.filter(rule => rule?.id).map(rule => [rule.id, rule]));
  const byText = new Map(allRules.map(rule => [brainRuleText(rule), rule]).filter(([text]) => Boolean(text)));

  const nextValidated = [];
  const nextInvalidated = [];
  const staleMap = new Map(
    normalizedAudit.staleRules
      .map(item => [item?.id || item?.text, item])
      .filter(([key]) => Boolean(key))
  );

  const processBucket = (items, bucket, sink) => {
    items.forEach(item => {
      const rule = (item?.id && byId.get(item.id)) || byText.get(item?.text) || null;
      const matchedRows = rows.filter(dossier => ruleMatchesValidationDossier(rule, dossier, item));
      if (matchedRows.length === 0) {
        sink.push(item);
        return;
      }
      const blockingRows = matchedRows
        .map(dossier => ({ dossier, issues: listTaiwanHardGateIssues(dossier) }))
        .filter(entry => entry.issues.length > 0);
      const hasFreshOrWatch = matchedRows.some(dossier => {
        const status = normalizeTaiwanValidationSignalStatus(dossier?.validationSignals?.hardGateStatus);
        return status === "fresh" || status === "watch";
      });
      if (blockingRows.length === 0 || hasFreshOrWatch) {
        sink.push(item);
        return;
      }
      const nextStaleness = blockingRows.some(entry => entry.issues.some(issue => issue.status === "missing")) ? "missing" : "stale";
      const hardGateReason = blockingRows
        .map(entry => `${entry.dossier.name}(${entry.dossier.code}) ${formatTaiwanHardGateIssueList(entry.issues)}`)
        .join("；");
      const key = item?.id || item?.text;
      staleMap.set(key, normalizeBrainAuditItem({
        ...item,
        bucket: "stale",
        staleness: nextStaleness,
        lastValidatedAt: item?.lastValidatedAt || defaultLastValidatedAt || "",
        reason: `台股驗證門檻未過：${hardGateReason}${item?.reason ? `｜原判定：${item.reason}` : ""}`,
        evidenceRefs: mergeBrainEvidenceRefs(
          item?.evidenceRefs,
          blockingRows.flatMap(entry => buildTaiwanHardGateEvidenceRefs(entry.dossier, entry.issues)),
          { limit: 6 }
        ),
      }, "stale"));
    });
  };

  processBucket(normalizedAudit.validatedRules, "validated", nextValidated);
  processBucket(normalizedAudit.invalidatedRules, "invalidated", nextInvalidated);

  return normalizeBrainAuditBuckets({
    validatedRules: nextValidated,
    staleRules: Array.from(staleMap.values()),
    invalidatedRules: nextInvalidated,
  });
}

export function ruleMatchesValidationDossier(rule, dossier, auditItem) {
  if (!dossier) return false;
  const codeHints = normalizeBrainStringList([
    ...(Array.isArray(auditItem?.evidenceRefs) ? auditItem.evidenceRefs.map(ref => ref?.code) : []),
    ...(Array.isArray(rule?.evidenceRefs) ? rule.evidenceRefs.map(ref => ref?.code) : []),
  ], { limit: 8 });
  if (codeHints.includes(dossier.code)) return true;

  const meta = dossier.meta || {};
  const appliesTo = normalizeBrainStringList(rule?.appliesTo, { limit: 8 }).map(item => item.toLowerCase());
  const tokens = buildBrainTokens({ ...dossier.position, code: dossier.code, name: dossier.name }, meta);
  if (codeHints.length === 0 && textMatchesBrainTokens(rule, tokens)) return true;
  if (appliesTo.length === 0) return false;

  const strategy = normalizeBrainValidationStrategyClass(meta.strategy).toLowerCase();
  const industry = normalizeBrainValidationIndustryTheme(meta.industry).toLowerCase();
  const positionType = brainValidationPositionTypeLabel(dossier.position?.type).toLowerCase();
  return appliesTo.some(item =>
    strategy.includes(item) ||
    industry.includes(item) ||
    positionType.includes(item)
  );
}

export function findTopBrainAnalogMatches(store, fingerprint, { ruleKey, limit = 2, portfolioId } = {}) {
  const cases = normalizeBrainValidationStore(store).cases;
  const sameRuleCases = cases.filter(item => item.ruleKey === ruleKey && (!portfolioId || item.portfolioId === portfolioId));
  const pool = sameRuleCases.length > 0
    ? sameRuleCases
    : cases.filter(item => item.fingerprint?.strategyClass === fingerprint?.strategyClass && (!portfolioId || item.portfolioId === portfolioId));

  const scored = pool
    .map(item => {
      const score = scoreBrainValidationAnalog(fingerprint, item.fingerprint);
      return { item, score };
    })
    .filter(({ score }) => !score.excluded)
    .sort((a, b) => b.score.score - a.score.score);

  const bestComparison = scored[0]
    ? {
      caseId: scored[0].item.caseId,
      code: scored[0].item.code,
      name: scored[0].item.name,
      capturedAt: scored[0].item.capturedAt,
      score: scored[0].score.score,
      verdict: scored[0].item.verdict,
      differenceType: scored[0].item.differenceType,
      matchedDimensions: scored[0].score.matchedDimensions,
      mismatchedDimensions: scored[0].score.mismatchedDimensions,
      note: scored[0].item.note,
    }
    : null;

  const matches = scored
    .filter(({ score }) => score.score >= 65)
    .slice(0, limit)
    .map(({ item, score }) => ({
      caseId: item.caseId,
      code: item.code,
      name: item.name,
      capturedAt: item.capturedAt,
      score: score.score,
      verdict: item.verdict,
      differenceType: item.differenceType,
      matchedDimensions: score.matchedDimensions,
      mismatchedDimensions: score.mismatchedDimensions,
      note: item.note,
    }));

  return {
    matches,
    bestComparison,
  };
}

export function createBrainValidationCase({
  portfolioId,
  sourceType,
  sourceRefId,
  dossier,
  rule,
  auditItem,
  bucket,
  verdict,
  store,
  capturedAt,
  reviewOutcome = null,
}) {
  const fingerprint = buildScenarioFingerprintFromDossier(dossier);
  if (!fingerprint) return null;
  const ruleKey = buildBrainRuleKey(rule || auditItem);
  const analogResult = findTopBrainAnalogMatches(store, fingerprint, { ruleKey, portfolioId });
  const analogMatches = analogResult.matches || [];
  const bestComparison = analogResult.bestComparison || null;
  const similarityScore = bestComparison?.score ?? null;
  const resolvedVerdict = reviewOutcome?.outcomeLabel === "supported"
    ? "supported"
    : reviewOutcome?.outcomeLabel === "contradicted"
      ? "contradicted"
      : reviewOutcome?.outcomeLabel === "mixed"
        ? "mixed"
        : verdict;
  const resolvedDifferenceType = refineBrainDifferenceType(
    classifyBrainDifferenceType(auditItem?.reason, bucket),
    { reviewOutcome, bestComparison }
  );
  const noteParts = [
    String(auditItem?.reason || "").trim(),
    reviewOutcome?.note ? `逐檔結果：${reviewOutcome.note}` : "",
  ].filter(Boolean);
  return normalizeBrainValidationCase({
    caseId: `${sourceType}-${sourceRefId}-${dossier.code}-${ruleKey}`,
    portfolioId,
    sourceType,
    sourceRefId,
    capturedAt,
    code: dossier.code,
    name: dossier.name,
    ruleKey,
    ruleId: rule?.id || auditItem?.id || null,
    ruleText: brainRuleText(rule || auditItem),
    bucket,
    verdict: resolvedVerdict,
    differenceType: resolvedDifferenceType,
    note: noteParts.join("｜"),
    similarityScore,
    matchedDimensions: bestComparison?.matchedDimensions || [],
    mismatchedDimensions: bestComparison?.mismatchedDimensions || [],
    reviewOutcome,
    fingerprint,
    evidenceRefs: [
      ...normalizeBrainEvidenceRefs(auditItem?.evidenceRefs),
      ...normalizeBrainEvidenceRefs(rule?.evidenceRefs),
    ].slice(0, 4),
    analogMatches,
  });
}

export function appendBrainValidationCases(store, {
  portfolioId,
  sourceType = "dailyAnalysis",
  sourceRefId,
  dossiers,
  brain,
  brainAudit,
  capturedAt = toSlashDate(),
  reviewEvent = null,
} = {}) {
  const current = normalizeBrainValidationStore(store);
  const nextMap = new Map(current.cases.map(item => [item.caseId, item]));
  const normalizedBrain = normalizeStrategyBrain(brain, { allowEmpty: true });
  const allRules = [
    ...(normalizedBrain?.rules || []),
    ...(normalizedBrain?.candidateRules || []),
  ];
  const byId = new Map(allRules.filter(item => item?.id).map(item => [item.id, item]));
  const byText = new Map(allRules.map(item => [brainRuleText(item), item]).filter(([text]) => Boolean(text)));
  const rows = normalizeHoldingDossiers(dossiers);

  [
    { key: "validatedRules", bucket: "validated", verdict: "supported" },
    { key: "staleRules", bucket: "stale", verdict: "mixed" },
    { key: "invalidatedRules", bucket: "invalidated", verdict: "contradicted" },
  ].forEach(section => {
    const items = brainAudit?.[section.key] || [];
    items.forEach(auditItem => {
      const rule = (auditItem.id && byId.get(auditItem.id)) || byText.get(auditItem.text) || null;
      const matchedRows = rows.filter(dossier => ruleMatchesValidationDossier(rule, dossier, auditItem))
        .slice(0, sourceType === "eventReview" ? 8 : 3);
      matchedRows.forEach(dossier => {
        const reviewOutcome = sourceType === "eventReview"
          ? (Array.isArray(reviewEvent?.stockOutcomes) ? reviewEvent.stockOutcomes.find(item => item?.code === dossier.code) || null : null)
          : null;
        const entry = createBrainValidationCase({
          portfolioId,
          sourceType,
          sourceRefId,
          dossier,
          rule,
          auditItem,
          bucket: section.bucket,
          verdict: section.verdict,
          store: current,
          capturedAt,
          reviewOutcome,
        });
        if (entry) nextMap.set(entry.caseId, entry);
      });
    });
  });

  return normalizeBrainValidationStore({
    version: 1,
    cases: Array.from(nextMap.values()),
  });
}

export function buildBrainValidationSummaryMap(store, portfolioId) {
  const cases = normalizeBrainValidationStore(store).cases
    .filter(item => !portfolioId || item.portfolioId === portfolioId);
  const map = new Map();
  cases.forEach(item => {
    const current = map.get(item.ruleKey) || {
      supported: 0,
      mixed: 0,
      contradicted: 0,
      recentCases: [],
    };
    current[item.verdict] = (current[item.verdict] || 0) + 1;
    current.recentCases.push(item);
    current.recentCases.sort((a, b) => {
      const aTime = parseFlexibleDate(a?.capturedAt)?.getTime() || 0;
      const bTime = parseFlexibleDate(b?.capturedAt)?.getTime() || 0;
      return bTime - aTime;
    });
    current.recentCases = current.recentCases.slice(0, 3);
    map.set(item.ruleKey, current);
  });
  return map;
}

export function createFallbackValidationDossier(code, event = null) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) return null;
  const meta = STOCK_META[normalizedCode] || {};
  const fallbackName = meta.name || buildEventStockDescriptors(event).find(item => item?.code === normalizedCode)?.name || normalizedCode;
  return {
    code: normalizedCode,
    name: fallbackName,
    meta,
    position: {
      code: normalizedCode,
      name: fallbackName,
      type: "股票",
      qty: null,
      cost: null,
      price: null,
      pct: null,
    },
    thesis: {},
    targets: {},
    fundamentals: {},
    analyst: {},
    events: {},
    research: {},
    brainContext: {},
    freshness: {},
  };
}

export function buildEventReviewDossiers(event, dossierLookup) {
  const lookup = dossierLookup instanceof Map ? dossierLookup : new Map();
  const codes = buildEventStockDescriptors(event).map(item => item.code);

  return codes
    .map(code => lookup.get(code) || createFallbackValidationDossier(code, event))
    .filter(Boolean)
    .slice(0, event?.status === "closed" ? 8 : 4);
}

export function buildEventReviewEvidenceRefs(event, reviewDate = toSlashDate()) {
  const refId = String(event?.id || "").trim();
  const label = event?.title ? `事件復盤：${event.title}` : "事件復盤";
  const codes = buildEventStockDescriptors(event).map(item => item.code);
  const refs = (codes.length > 0 ? codes : [""]).map(code => ({
    type: "review",
    refId,
    code,
    label,
    date: reviewDate,
  }));
  return normalizeBrainEvidenceRefs(refs);
}

export function formatPromptNumber(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return digits === 0 ? String(Math.round(num)) : num.toFixed(digits);
}

export function formatFreshnessLabel(status) {
  if (status === "fresh") return "新";
  if (status === "stale") return "舊";
  return "缺";
}

export function summarizeTargetReportsForPrompt(reports, limit = 2) {
  const rows = (Array.isArray(reports) ? reports : [])
    .map(report => {
      const firm = report?.firm || "未署名";
      const target = Number(report?.target);
      const date = report?.date || "日期未知";
      if (!Number.isFinite(target) || target <= 0) return null;
      return `${firm} ${target} (${date})`;
    })
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join("；") : "無";
}

export function summarizeEventListForPrompt(items, limit = 3) {
  const rows = (Array.isArray(items) ? items : [])
    .map(event => {
      const label = event?.title || "未命名事件";
      const date = event?.date || event?.trackingStart || event?.exitDate || "日期未定";
      const status = event?.status || "pending";
      return `${label}(${date}/${status})`;
    })
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join("；") : "無";
}

export function buildDailyHoldingDossierContext(dossier, change, { blind = false } = {}) {
  if (!dossier) return "";
  const position = dossier.position || {};
  const meta = dossier.meta || {};
  const thesis = dossier.thesis || {};
  const targets = dossier.targets || {};
  const fundamentals = dossier.fundamentals || {};
  const analyst = dossier.analyst || {};
  const events = dossier.events || {};
  const research = dossier.research || {};
  const brainContext = dossier.brainContext || {};
  const freshness = dossier.freshness || {};
  const validationSignals = dossier.validationSignals || {};
  const typeLabel = position.type || "股票";
  const expireLabel = position.expire ? ` 到期${position.expire}` : "";

  // blind 模式：不顯示今日漲跌和現價，只保留成本和基本面
  const positionLine = blind
    ? `持倉：${typeLabel}${expireLabel} | 成本 ${formatPromptNumber(position.cost)} | 股數 ${formatPromptNumber(position.qty, 0)}`
    : (() => {
        const changePct = Number.isFinite(change?.changePct) ? `${change.changePct >= 0 ? "+" : ""}${change.changePct.toFixed(2)}%` : "—";
        const totalPct = Number.isFinite(change?.totalPct) ? `${change.totalPct >= 0 ? "+" : ""}${change.totalPct.toFixed(2)}%` : "—";
        const todayPnl = Number.isFinite(change?.todayPnl) ? `${change.todayPnl >= 0 ? "+" : ""}${Math.round(change.todayPnl)}` : "—";
        const totalPnl = Number.isFinite(change?.totalPnl) ? `${change.totalPnl >= 0 ? "+" : ""}${Math.round(change.totalPnl)}` : "—";
        return `持倉：${typeLabel}${expireLabel} | 現價 ${formatPromptNumber(change?.price ?? position.price)} 成本 ${formatPromptNumber(position.cost)} | 今日 ${changePct} / ${todayPnl} | 累計 ${totalPct} / ${totalPnl} | 股數 ${formatPromptNumber(position.qty, 0)}`;
      })();

  const targetLine = targets.avgTarget
    ? `目標價：均值 ${formatPromptNumber(targets.avgTarget, 0)} | 報告 ${summarizeTargetReportsForPrompt(targets.reports)}`
    : "目標價：無";
  const fundamentalsLine = fundamentals.eps != null || fundamentals.grossMargin != null || fundamentals.roe != null || fundamentals.revenueYoY != null
    ? `財報/營收：${formatFundamentalsSummary(fundamentals)}${fundamentals.source ? ` | 來源 ${fundamentals.source}` : ""}`
    : "財報/營收：無";
  const researchLine = research.latestConclusion
    ? `研究摘要：${research.latestConclusion}`
    : "研究摘要：無";
  const analystLine = analyst.latestSummary
    ? `公開報告：${analyst.latestSummary}`
    : "公開報告：無";
  const ruleLine = (brainContext.matchedRules || []).length > 0
    ? `相關規則：${brainContext.matchedRules.slice(0, 3).map(rule => brainRuleSummary(rule)).join("；")}`
    : null;
  const candidateLine = (brainContext.matchedCandidateRules || []).length > 0
    ? `候選規則：${brainContext.matchedCandidateRules.slice(0, 2).map(rule => brainRuleSummary(rule)).join("；")}`
    : null;
  const mistakeLine = (brainContext.matchedMistakes || []).length > 0
    ? `風險提醒：${brainContext.matchedMistakes.slice(0, 3).join("；")}`
    : null;
  return [
    `【${dossier.name}(${dossier.code})】`,
    positionLine,
    `定位：${meta.industry || "未分類"} / ${meta.strategy || "未分類"} / ${meta.period || "?"}期 / ${meta.position || "未定"} / ${meta.leader || "未知"}`,
    thesis.summary ? `thesis：${thesis.summary}` : null,
    thesis.catalyst ? `催化劑：${thesis.catalyst}` : null,
    thesis.status ? `目前狀態：${thesis.status}` : null,
    position.alert ? `持倉提醒：${position.alert}` : null,
    targetLine,
    fundamentalsLine,
    analystLine,
    `台股驗證門檻：月營收${formatTaiwanValidationSignalLabel(validationSignals.monthlyRevenueGate)} / 法說${formatTaiwanValidationSignalLabel(validationSignals.conferenceGate)} / 財報${formatTaiwanValidationSignalLabel(validationSignals.earningsGate)} / 目標價/報告${formatTaiwanValidationSignalLabel(validationSignals.targetFreshnessGate)} / 總體${formatTaiwanValidationSignalLabel(validationSignals.hardGateStatus)}`,
    `事件：待觀察 ${summarizeEventListForPrompt(events.pending)} | 追蹤中 ${summarizeEventListForPrompt(events.tracking, 2)} | 最近結案 ${events.latestClosed?.title ? `${events.latestClosed.title}(${events.latestClosed.exitDate || events.latestClosed.date || "—"})` : "無"}`,
    researchLine,
    ruleLine,
    candidateLine,
    mistakeLine,
    `資料新鮮度：價格${formatFreshnessLabel(freshness.price)} / 目標價${formatFreshnessLabel(freshness.targets)} / 財報${formatFreshnessLabel(freshness.fundamentals)} / 研究${formatFreshnessLabel(freshness.research)}`,
  ].filter(Boolean).join("\n");
}

export function buildResearchHoldingDossierContext(dossier, { compact = false } = {}) {
  if (!dossier) return "";
  const position = dossier.position || {};
  const meta = dossier.meta || {};
  const thesis = dossier.thesis || {};
  const targets = dossier.targets || {};
  const fundamentals = dossier.fundamentals || {};
  const analyst = dossier.analyst || {};
  const events = dossier.events || {};
  const research = dossier.research || {};
  const brainContext = dossier.brainContext || {};
  const freshness = dossier.freshness || {};
  const validationSignals = dossier.validationSignals || {};
  const lines = [
    `【${dossier.name}(${dossier.code})】`,
    `持倉：${position.type || "股票"} | 現價 ${formatPromptNumber(position.price)} 成本 ${formatPromptNumber(position.cost)} | 累計 ${position.pct >= 0 ? "+" : ""}${formatPromptNumber(position.pct, 2)}% | 股數 ${formatPromptNumber(position.qty, 0)}`,
    `定位：${meta.industry || "未分類"} / ${meta.strategy || "未分類"} / ${meta.period || "?"}期 / ${meta.position || "未定"} / ${meta.leader || "未知"}`,
    thesis.summary ? `thesis：${thesis.summary}` : null,
    thesis.catalyst ? `催化劑：${thesis.catalyst}` : null,
    thesis.status ? `狀態：${thesis.status}` : null,
    targets.avgTarget ? `目標價：均值 ${formatPromptNumber(targets.avgTarget, 0)}；${summarizeTargetReportsForPrompt(targets.reports, compact ? 2 : 3)}` : "目標價：無",
    (fundamentals.eps != null || fundamentals.grossMargin != null || fundamentals.roe != null || fundamentals.revenueYoY != null) ? `財報/營收：${formatFundamentalsSummary(fundamentals)}${fundamentals.source ? `；來源 ${fundamentals.source}` : ""}` : "財報/營收：無",
    analyst.latestSummary ? `公開報告：${analyst.latestSummary}` : "公開報告：無",
    `台股驗證門檻：月營收${formatTaiwanValidationSignalLabel(validationSignals.monthlyRevenueGate)} / 法說${formatTaiwanValidationSignalLabel(validationSignals.conferenceGate)} / 財報${formatTaiwanValidationSignalLabel(validationSignals.earningsGate)} / 目標價/報告${formatTaiwanValidationSignalLabel(validationSignals.targetFreshnessGate)} / 總體${formatTaiwanValidationSignalLabel(validationSignals.hardGateStatus)}`,
    `事件：待觀察 ${summarizeEventListForPrompt(events.pending, compact ? 2 : 3)} | 追蹤中 ${summarizeEventListForPrompt(events.tracking, compact ? 2 : 3)}`,
    research.latestConclusion ? `最近研究：${research.latestConclusion}` : "最近研究：無",
    (brainContext.matchedRules || []).length > 0 ? `相關規則：${brainContext.matchedRules.slice(0, compact ? 2 : 4).map(rule => brainRuleSummary(rule)).join("；")}` : null,
    (brainContext.matchedCandidateRules || []).length > 0 ? `候選規則：${brainContext.matchedCandidateRules.slice(0, compact ? 2 : 3).map(rule => brainRuleSummary(rule)).join("；")}` : null,
    (brainContext.matchedMistakes || []).length > 0 ? `常見風險：${brainContext.matchedMistakes.slice(0, compact ? 2 : 4).join("；")}` : null,
    `資料新鮮度：價格${formatFreshnessLabel(freshness.price)} / 目標價${formatFreshnessLabel(freshness.targets)} / 財報${formatFreshnessLabel(freshness.fundamentals)} / 研究${formatFreshnessLabel(freshness.research)}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function normalizePortfolios(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();

  for (const item of source) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    normalized.push({
      id: item.id,
      name: item.name,
      isOwner: item.id === OWNER_PORTFOLIO_ID ? true : Boolean(item.isOwner),
      createdAt: item.createdAt || todayStorageDate(),
    });
  }

  if (!seen.has(OWNER_PORTFOLIO_ID)) {
    normalized.unshift(...createDefaultPortfolios());
  }

  return normalized.length > 0 ? normalized : createDefaultPortfolios();
}

export function pfKey(pid, suffix) {
  return `pf-${pid}-${suffix}`;
}

export function getEmptyFallback(suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  return field ? field.emptyFallback() : null;
}

export function getPortfolioFallback(pid, suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  if (!field) return null;
  return (pid === OWNER_PORTFOLIO_ID ? field.ownerFallback : field.emptyFallback)();
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
  return load(APPLIED_TRADE_PATCHES_KEY, []);
}

export async function saveAppliedTradePatches(ids) {
  return save(APPLIED_TRADE_PATCHES_KEY, Array.from(new Set(ids || [])));
}

export function getPersistedMarketQuotes() {
  try {
    const raw = localStorage.getItem(MARKET_PRICE_CACHE_KEY);
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

const readSyncAt = (key) => {
  try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
};
const writeSyncAt = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch {}
};

export async function savePortfolioData(pid, suffix, data) {
  return save(pfKey(pid, suffix), sanitizePortfolioField(suffix, data));
}

export function removePortfolioData(pid) {
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    try { localStorage.removeItem(pfKey(pid, field.suffix)); } catch {}
  }
}

export async function loadPortfolioData(pid, suffix, fallback) {
  return sanitizePortfolioField(suffix, await load(pfKey(pid, suffix), fallback));
}

export async function loadForPortfolio(pid, suffix) {
  return loadPortfolioData(pid, suffix, getPortfolioFallback(pid, suffix));
}

function readStorageValue(key) {
  const raw = localStorage.getItem(key);
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

export function collectPortfolioBackupStorage() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("pf-")) continue;
    if (GLOBAL_SYNC_KEY_SET.has(key)) continue;
    if (
      !BACKUP_GLOBAL_KEY_SET.has(key) &&
      !PORTFOLIO_STORAGE_FIELDS.some(item => key.endsWith(`-${item.suffix}`))
    ) continue;
    storage[key] = readStorageValue(key);
  }
  return storage;
}

export function normalizeImportedStorageKey(rawKey) {
  if (GLOBAL_SYNC_KEY_SET.has(rawKey)) return null;
  if (BACKUP_GLOBAL_KEY_SET.has(rawKey)) return rawKey;
  if (PORTFOLIO_ALIAS_TO_SUFFIX[rawKey]) return pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX[rawKey]);

  const legacyField = PORTFOLIO_STORAGE_FIELDS.find(item => item.hasLegacy !== false && `pf-${item.suffix}` === rawKey);
  if (legacyField) return pfKey(OWNER_PORTFOLIO_ID, legacyField.suffix);

  if (rawKey.startsWith("pf-") && PORTFOLIO_STORAGE_FIELDS.some(item => rawKey.endsWith(`-${item.suffix}`))) {
    return rawKey;
  }

  return null;
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function normalizeBackupStorage(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const looksLikeHistory = payload.every(item => item && typeof item === "object" && (item.id != null || item.date || item.aiInsight));
    return looksLikeHistory ? { [pfKey(OWNER_PORTFOLIO_ID, "analysis-history-v1")]: payload } : null;
  }

  if (typeof payload !== "object") return null;

  if (payload.storage && typeof payload.storage === "object" && !Array.isArray(payload.storage)) {
    return normalizeBackupStorage(payload.storage);
  }

  const mapEntries = (source) => {
    const mapped = {};
    for (const [rawKey, value] of Object.entries(source || {})) {
      const key = normalizeImportedStorageKey(rawKey);
      if (key) mapped[key] = value;
    }
    return mapped;
  };

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    const mapped = mapEntries(payload.data);
    if (Object.keys(mapped).length > 0) return mapped;
  }

  const directMapped = mapEntries(payload);
  if (Object.keys(directMapped).length > 0) return directMapped;

  const looksLikeBrain = Array.isArray(payload.rules) || Array.isArray(payload.candidateRules) || Array.isArray(payload.lessons) || Array.isArray(payload.commonMistakes) || Array.isArray(payload.coachLessons) || payload.checklists || payload.stats || payload.evolution;
  if (looksLikeBrain) return { [pfKey(OWNER_PORTFOLIO_ID, "brain-v1")]: payload };

  const looksLikeDailyReport = payload.totalTodayPnl != null || Array.isArray(payload.changes) || typeof payload.aiInsight === "string";
  if (looksLikeDailyReport) {
    return {
      [pfKey(OWNER_PORTFOLIO_ID, "daily-report-v1")]: payload,
      [pfKey(OWNER_PORTFOLIO_ID, "analysis-history-v1")]: [payload],
    };
  }

  return null;
}

export function extractPortfolioIdsFromStorage(storage) {
  const ids = new Set([OWNER_PORTFOLIO_ID]);
  for (const key of Object.keys(storage || {})) {
    for (const field of PORTFOLIO_STORAGE_FIELDS) {
      const suffix = `-${field.suffix}`;
      if (!key.startsWith("pf-") || !key.endsWith(suffix)) continue;
      const pid = key.slice(3, -suffix.length);
      if (pid) ids.add(pid);
      break;
    }
  }
  return Array.from(ids);
}

export function buildPortfoliosFromStorage(storage) {
  const existing = normalizePortfolios(storage?.[PORTFOLIOS_KEY]);
  const byId = new Map(existing.map(item => [item.id, item]));
  const ids = extractPortfolioIdsFromStorage(storage);

  return ids.map(id => (
    byId.get(id) || {
      id,
      name: id === OWNER_PORTFOLIO_ID ? "我" : id,
      isOwner: id === OWNER_PORTFOLIO_ID,
      createdAt: todayStorageDate(),
    }
  ));
}

export async function migrateLegacyPortfolioStorageIfNeeded() {
  const currentVersion = await load(SCHEMA_VERSION_KEY, null);
  const hasLegacyData = LEGACY_STORAGE_KEYS.some(key => localStorage.getItem(key) != null);
  if (currentVersion === CURRENT_SCHEMA_VERSION || !hasLegacyData) return false;

  await save(PORTFOLIOS_KEY, createDefaultPortfolios());
  await save(ACTIVE_PORTFOLIO_KEY, OWNER_PORTFOLIO_ID);
  await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);

  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    if (field.hasLegacy === false) continue;
    const legacyKey = `pf-${field.suffix}`;
    const raw = localStorage.getItem(legacyKey);
    if (raw == null) continue;
    await savePortfolioData(OWNER_PORTFOLIO_ID, field.suffix, readStorageValue(legacyKey));
    localStorage.removeItem(legacyKey);
  }

  const migratedEvents = await loadPortfolioData(OWNER_PORTFOLIO_ID, "news-events-v1", []);
  if (Array.isArray(migratedEvents) && migratedEvents.length > 0) {
    await savePortfolioData(OWNER_PORTFOLIO_ID, "news-events-v1", migratedEvents.map(event => ({
      ...event,
      status: event.status === "past" ? "closed" : event.status,
      ...(event.status === "past" ? {
        eventDate: event.date,
        trackingStart: event.reviewDate || event.date,
        exitDate: event.reviewDate || null,
        priceAtEvent: null,
        priceAtExit: null,
        priceHistory: [],
      } : {}),
    })));
  }

  await save(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
  return true;
}

export async function repairPersistedHoldingsIfNeeded() {
  const storage = collectPortfolioBackupStorage();
  const portfolios = buildPortfoliosFromStorage(storage);
  const quotes = getPersistedMarketQuotes();
  let repaired = 0;

  for (const portfolio of portfolios) {
    const key = pfKey(portfolio.id, "holdings-v2");
    const raw = readStorageValue(key);
    if (raw === undefined) continue;
    const analysisHistory = readStorageValue(pfKey(portfolio.id, "analysis-history-v1"));
    const fallbackRows = getPortfolioFallback(portfolio.id, "holdings-v2");
    const priceHints = buildHoldingPriceHints({ analysisHistory, fallbackRows });
    const normalized = normalizeHoldings(raw, quotes, priceHints);
    if (JSON.stringify(raw) === JSON.stringify(normalized)) continue;
    await save(key, normalized);
    repaired += 1;
  }

  return repaired;
}

export async function applyTradeBackfillPatchesIfNeeded() {
  const applied = new Set(await loadAppliedTradePatches());
  let changed = 0;

  for (const patch of TRADE_BACKFILL_PATCHES) {
    if (applied.has(patch.id)) continue;

    const tradeLog = await loadPortfolioData(patch.portfolioId, "log-v2", []);
    if ((tradeLog || []).some(item => item?.patchId === patch.id)) {
      applied.add(patch.id);
      continue;
    }

    const holdings = await loadPortfolioData(
      patch.portfolioId,
      "holdings-v2",
      getPortfolioFallback(patch.portfolioId, "holdings-v2")
    );
    const existing = (holdings || []).find(item => item.code === patch.entry.code);
    const currentQty = Number(existing?.qty) || 0;
    const shouldAdjustHoldings =
      patch.expectedQtyAfter == null ||
      currentQty > patch.expectedQtyAfter;

    const nextHoldings = shouldAdjustHoldings
      ? applyTradeEntryToHoldings(holdings, patch.entry, getPersistedMarketQuotes())
      : holdings;
    const nextTradeLog = [patch.entry, ...(tradeLog || [])];

    await savePortfolioData(patch.portfolioId, "log-v2", nextTradeLog);
    await savePortfolioData(patch.portfolioId, "holdings-v2", nextHoldings);

    if (patch.portfolioId === OWNER_PORTFOLIO_ID) {
      try {
        await fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save-holdings", data: nextHoldings }),
        });
      } catch {
        // local copy is still enough; cloud can catch up later
      }
    }

    applied.add(patch.id);
    changed += 1;
  }

  if (applied.size > 0) {
    await saveAppliedTradePatches(Array.from(applied));
  }

  return changed;
}

export async function seedJinlianchengIfNeeded() {
  const portfolios = await load(PORTFOLIOS_KEY, []);
  const existing = portfolios.find(p => p.name === "金聯成");
  if (existing) {
    const holdings = await loadPortfolioData(existing.id, "holdings-v2", []);
    if (holdings.length > 0) return; // 已有持倉，不重複 seed
    await savePortfolioData(existing.id, "holdings-v2", INIT_HOLDINGS_JINLIANCHENG);
    await savePortfolioData(existing.id, "targets-v1", INIT_TARGETS_JINLIANCHENG);
    return;
  }
  // 組合不存在 → 建立並 seed
  const newPf = {
    id: `p-${Date.now().toString(36)}`,
    name: "金聯成",
    isOwner: false,
    createdAt: todayStorageDate(),
  };
  await save(PORTFOLIOS_KEY, [...portfolios, newPf]);
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    await savePortfolioData(newPf.id, field.suffix, field.emptyFallback());
  }
  await savePortfolioData(newPf.id, "holdings-v2", INIT_HOLDINGS_JINLIANCHENG);
  await savePortfolioData(newPf.id, "targets-v1", INIT_TARGETS_JINLIANCHENG);
}

export async function ensurePortfolioRegistry() {
  const storedPortfolios = await load(PORTFOLIOS_KEY, null);
  const portfolios = normalizePortfolios(storedPortfolios);
  if (!storedPortfolios || JSON.stringify(storedPortfolios) !== JSON.stringify(portfolios)) {
    await save(PORTFOLIOS_KEY, portfolios);
  }

  let activePortfolioId = await load(ACTIVE_PORTFOLIO_KEY, OWNER_PORTFOLIO_ID);
  if (typeof activePortfolioId !== "string" || !portfolios.some(item => item.id === activePortfolioId)) {
    activePortfolioId = OWNER_PORTFOLIO_ID;
    await save(ACTIVE_PORTFOLIO_KEY, activePortfolioId);
  }

  let viewMode = await load(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
  if (viewMode !== PORTFOLIO_VIEW_MODE && viewMode !== OVERVIEW_VIEW_MODE) {
    viewMode = PORTFOLIO_VIEW_MODE;
  }
  // overview mode UI 還沒落地前，先固定回 portfolio，避免匯入後卡在唯讀模式
  if (viewMode !== PORTFOLIO_VIEW_MODE) {
    viewMode = PORTFOLIO_VIEW_MODE;
  }
  await save(VIEW_MODE_KEY, viewMode);

  // 每次啟動都做一次輕量 repair，避免 schema 已是最新版但本地持倉之後又被寫壞。
  await repairPersistedHoldingsIfNeeded();

  const schemaVersion = await load(SCHEMA_VERSION_KEY, null);
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    await save(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
  }

  return { portfolios, activePortfolioId, viewMode };
}

export async function loadPortfolioSnapshot(pid) {
  const snapshot = {};
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    snapshot[field.alias] = await loadForPortfolio(pid, field.suffix);
  }
  snapshot.analysisHistory = normalizeAnalysisHistoryEntries(snapshot.analysisHistory);
  snapshot.holdings = normalizeHoldings(
    snapshot.holdings,
    getPersistedMarketQuotes(),
    buildHoldingPriceHints({
      analysisHistory: snapshot.analysisHistory,
      fallbackRows: getPortfolioFallback(pid, "holdings-v2"),
    })
  );
  return snapshot;
}

// ── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]     = useState("holdings");
  const [ready, setReady] = useState(false);  

  // persistent state
  const [holdings,  setHoldings]  = useState(null);
  const [tradeLog,  setTradeLog]  = useState(null);
  const [targets,   setTargets]   = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [watchlist, setWatchlist] = useState(null);
  const [analystReports, setAnalystReports] = useState(null);
  const [reportRefreshMeta, setReportRefreshMeta] = useState(null);
  const [holdingDossiers, setHoldingDossiers] = useState(null);

  // upload / memo
  const [img, setImg]           = useState(null);
  const [b64, setB64]           = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [parsed,  setParsed]    = useState(null);
  const [parseErr,setParseErr]  = useState(null);
  const [dragOver,setDragOver]  = useState(false);
  const [memoStep,setMemoStep]  = useState(0);
  const [memoAns, setMemoAns]   = useState([]);
  const [memoIn,  setMemoIn]    = useState("");
  const [saved,   setSaved]     = useState("");

  // dashboard UI
  const [sortBy,      setSortBy]      = useState("value");
  const [scanQuery,   setScanQuery]   = useState("");
  const [scanFilter,  setScanFilter]  = useState("全部");
  const [filterType,  setFilterType]  = useState("全部");
  const [showAll,     setShowAll]     = useState(false);
  const [showReversal, setShowReversal] = useState(false);
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const [expandedStock, setExpandedStock] = useState(null);
  const [expandedNews, setExpandedNews] = useState(new Set());
  const toggleNews = (id) => setExpandedNews(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  // watchlist editor
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [watchlistEditing, setWatchlistEditing] = useState(null);
  const [watchlistForm, setWatchlistForm] = useState({ code: "", name: "", price: "", target: "", status: "", catalyst: "", scKey: "blue", note: "" });
  const [tpCode, setTpCode] = useState("");
  const [tpFirm, setTpFirm] = useState("");
  const [tpVal,  setTpVal]  = useState("");
  const [fundamentalDraft, setFundamentalDraft] = useState(() => createDefaultFundamentalDraft());
  const [enrichingResearchCode, setEnrichingResearchCode] = useState(null);
  const [reportRefreshing, setReportRefreshing] = useState(false);
  const [reportRefreshStatus, setReportRefreshStatus] = useState("");

  // refresh prices
  const [refreshing, setRefreshing] = useState(false);
  const [marketPriceCache, setMarketPriceCache] = useState(() => normalizeMarketPriceCache(readStorageValue(MARKET_PRICE_CACHE_KEY)));
  const [marketPriceSync, setMarketPriceSync] = useState(() => normalizeMarketPriceSync(readStorageValue(MARKET_PRICE_SYNC_KEY)));
  const [lastUpdate, setLastUpdate] = useState(() => {
    const cachedSync = normalizeMarketPriceSync(readStorageValue(MARKET_PRICE_SYNC_KEY));
    const cachedPrice = normalizeMarketPriceCache(readStorageValue(MARKET_PRICE_CACHE_KEY));
    return parseStoredDate(cachedSync?.syncedAt || cachedPrice?.syncedAt);
  });

  // daily analysis
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeStep, setAnalyzeStep]   = useState("");
  const [dailyReport, setDailyReport]   = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState(null);
  const [newsEvents, setNewsEvents]     = useState(null);
  const [reviewingEvent, setReviewingEvent] = useState(null);
  const [reviewForm, setReviewForm]     = useState(() => createDefaultReviewForm());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent]         = useState(() => createDefaultEventDraft());
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [showCalendar, setShowCalendar] = useState(false);
  const [reversalConditions, setReversalConditions] = useState(null);
  const [strategyBrain, setStrategyBrain] = useState(null);
  const [brainValidation, setBrainValidation] = useState(() => createEmptyBrainValidationStore());
  const [portfolioNotes, setPortfolioNotes] = useState(() => clonePortfolioNotes());
  const [cloudSync, setCloudSync]         = useState(false);
  const [relayPlanExpanded, setRelayPlanExpanded] = useState(false);
  // AutoResearch state（必須在 useEffect 之前宣告）
  const [researching, setResearching] = useState(false);
  const [researchTarget, setResearchTarget] = useState(null);
  const [researchResults, setResearchResults] = useState(null);
  const eventLifecycleSyncRef = useRef(false);
  const cloudSaveTimersRef = useRef({});
  const cloudSyncStateRef = useRef({ enabled: false, syncedAt: 0 });
  const priceSyncInFlightRef = useRef(null);
  const priceSelfHealRef = useRef({});
  const backupFileInputRef = useRef(null);
  const imgTypeRef = useRef("image/jpeg");
  const deferredQuery = useDeferredValue(scanQuery);
  // 避免 localhost/127.0.0.1 重定向迴圈 - 只在真正需要時重定向一次
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hostname, protocol, port, pathname, search, hash } = window.location;
    // 只在 localhost 且尚未重定向過時才重定向
    if (hostname === "localhost" && !sessionStorage.getItem("pf-redirect-done")) {
      sessionStorage.setItem("pf-redirect-done", "1");
      window.location.replace(`${protocol}//127.0.0.1${port ? `:${port}` : ""}${pathname}${search}${hash}`);
    }
  }, []);
  const applyPortfolioSnapshot = useCallback((snapshot) => {
    const normalizedAnalysisHistory = normalizeAnalysisHistoryEntries(snapshot.analysisHistory);
    setHoldings(applyMarketQuotesToHoldings(snapshot.holdings, marketPriceCache?.prices));
    setTradeLog(snapshot.tradeLog);
    setTargets(snapshot.targets);
    setFundamentals(normalizeFundamentalsStore(snapshot.fundamentals));
    setWatchlist(normalizeWatchlist(snapshot.watchlist));
    setAnalystReports(normalizeAnalystReportsStore(snapshot.analystReports));
    setReportRefreshMeta(normalizeReportRefreshMeta(snapshot.reportRefreshMeta));
    setHoldingDossiers(normalizeHoldingDossiers(snapshot.holdingDossiers));
    setNewsEvents(normalizeNewsEvents(snapshot.newsEvents));
    setAnalysisHistory(normalizedAnalysisHistory);
    setReversalConditions(snapshot.reversalConditions);
    setStrategyBrain(normalizeStrategyBrain(snapshot.strategyBrain));
    setBrainValidation(normalizeBrainValidationStore(snapshot.brainValidation));
    setResearchHistory(snapshot.researchHistory);
    setPortfolioNotes(snapshot.portfolioNotes || clonePortfolioNotes());
    setDailyReport(normalizeDailyReportEntry(snapshot.dailyReport) || (normalizedAnalysisHistory.length > 0 ? normalizedAnalysisHistory[0] : null));
  }, [marketPriceCache]);
  const setCloudStateForPortfolio = useCallback((pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
    const enabled = nextViewMode === PORTFOLIO_VIEW_MODE && pid === OWNER_PORTFOLIO_ID;
    cloudSyncStateRef.current = {
      enabled,
      syncedAt: enabled ? readSyncAt("pf-cloud-sync-at") : 0,
    };
    setCloudSync(enabled);
  }, []);
  const scheduleCloudSave = (action, data, successMsg) => {
    if (!cloudSyncStateRef.current.enabled) return;
    clearTimeout(cloudSaveTimersRef.current[action]);
    cloudSaveTimersRef.current[action] = setTimeout(async () => {
      try {
        await fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, data })
        });
        const now = Date.now();
        cloudSyncStateRef.current.syncedAt = now;
        writeSyncAt("pf-cloud-sync-at", now);
        if (successMsg) {
          setSaved(successMsg);
          setTimeout(() => setSaved(""), 2000);
        }
      } catch {}
    }, CLOUD_SAVE_DEBOUNCE);
  };
  const persistMarketPriceState = useCallback(async (cache, syncMeta) => {
    const normalizedCache = normalizeMarketPriceCache(cache);
    const normalizedSync = normalizeMarketPriceSync(syncMeta);
    await save(MARKET_PRICE_CACHE_KEY, normalizedCache);
    await save(MARKET_PRICE_SYNC_KEY, normalizedSync);
    setMarketPriceCache(normalizedCache);
    setMarketPriceSync(normalizedSync);
    const syncedAt = parseStoredDate(normalizedSync?.syncedAt || normalizedCache?.syncedAt);
    if (syncedAt) setLastUpdate(syncedAt);
  }, []);
  const collectTrackedCodes = () => {
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
      const holdingRows = useLiveState ? holdings : readStorageValue(pfKey(portfolio.id, "holdings-v2"));
      const watchlistRows = useLiveState ? watchlist : readStorageValue(pfKey(portfolio.id, "watchlist-v1"));
      const eventRows = useLiveState ? newsEvents : readStorageValue(pfKey(portfolio.id, "news-events-v1"));
      addRows(holdingRows);
      addRows(watchlistRows);
      addEvents(eventRows);
    });

    return Array.from(codeSet);
  };
  const fetchPostCloseQuotes = useCallback(async (codes, timeoutMs = 8000) => {
    const normalizedCodes = Array.from(new Set((codes || []).map(code => String(code || "").trim()).filter(Boolean)));
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
        status: failedCodes.length > 0 ? "partial" : "fresh",
        prices: {
          ...((cachedPrice && cachedPrice.prices) || {}),
          ...quotes,
        },
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
          setSaved(`✅ 收盤價已同步（${trackedCodes.length - failedCodes.length}/${trackedCodes.length} 檔成功）`);
        } else {
          setSaved(`✅ 今日收盤價已同步（${trackedCodes.length} 檔）`);
        }
        setTimeout(() => setSaved(""), 4000);
      }

      return nextCache;
    })().finally(() => {
      priceSyncInFlightRef.current = null;
    });

    priceSyncInFlightRef.current = task;
    return task;
  }, [marketPriceSync, marketPriceCache, holdings, portfolios, viewMode, activePortfolioId, fetchPostCloseQuotes, persistMarketPriceState]);
  const getMarketQuotesForCodes = useCallback(async (codes, { ensureSynced = true } = {}) => {
    const normalizedCodes = Array.from(new Set((codes || []).map(code => String(code || "").trim()).filter(Boolean)));
    if (normalizedCodes.length === 0) return {};
    const cache = ensureSynced ? (await syncPostClosePrices({ silent: true })) : (marketPriceCache || normalizeMarketPriceCache(readStorageValue(MARKET_PRICE_CACHE_KEY)));
    return getCachedQuotesForCodes(cache, normalizedCodes);
  }, [syncPostClosePrices, marketPriceCache]);
  const flushCurrentPortfolio = useCallback(async (pid) => {
    if (!ready || !pid) return;
    const liveSnapshot = {
      holdings,
      tradeLog,
      targets,
      fundamentals,
      watchlist,
      analystReports,
      reportRefreshMeta,
      holdingDossiers,
      newsEvents,
      analysisHistory,
      dailyReport,
      reversalConditions,
      strategyBrain,
      researchHistory,
      portfolioNotes,
    };
    await Promise.all(
      Object.entries(liveSnapshot)
        .map(([alias, value]) => {
          const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias];
          return suffix ? savePortfolioData(pid, suffix, value) : null;
        })
        .filter(Boolean)
    );
    await save(ACTIVE_PORTFOLIO_KEY, pid);
    await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
  }, [ready, holdings, tradeLog, targets, fundamentals, watchlist, analystReports, reportRefreshMeta, holdingDossiers, newsEvents, analysisHistory, dailyReport, reversalConditions, strategyBrain, researchHistory, portfolioNotes]);
  const deleteAnalysisRecord = useCallback(async (report) => {
    if (!report?.id || !report?.date) return;
    if (!window.confirm(`確定要刪除 ${report.date} ${report.time || ""} 的歷史分析記錄？`)) return;

    const nextHistory = (analysisHistory || []).filter(item => item.id !== report.id);
    const deletingSelectedReport = dailyReport?.id === report.id;
    const nextDailyReport = deletingSelectedReport ? (nextHistory[0] || null) : dailyReport;

    setAnalysisHistory(nextHistory);
    if (deletingSelectedReport) {
      setDailyReport(normalizeDailyReportEntry(nextDailyReport));
      if (!nextDailyReport) setDailyExpanded(false);
    }

    await savePortfolioData(activePortfolioId, "analysis-history-v1", nextHistory);
    if (deletingSelectedReport) {
      await savePortfolioData(activePortfolioId, "daily-report-v1", nextDailyReport);
    }

    if (canUseCloud) {
      try {
        const res = await fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete-analysis", data: { id: report.id, date: report.date } })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `刪除失敗 (${res.status})`);
        const now = Date.now();
        cloudSyncStateRef.current.syncedAt = now;
        writeSyncAt("pf-analysis-cloud-sync-at", now);
      } catch (err) {
        setSaved("⚠️ 本機已刪除，但雲端刪除失敗");
        setTimeout(() => setSaved(""), 3000);
        return;
      }
    }

    setSaved("✅ 已刪除歷史分析");
    setTimeout(() => setSaved(""), 2500);
  }, [analysisHistory, dailyReport, activePortfolioId, canUseCloud]);
  const resetTransientUiState = useCallback(() => {
    setImg(null);
    setB64(null);
    setParsing(false);
    setParsed(null);
    setParseErr(null);
    setDragOver(false);
    setMemoStep(0);
    setMemoAns([]);
    setMemoIn("");
    setDailyExpanded(false);
    setExpandedStock(null);
    setExpandedNews(new Set());
    setReviewingEvent(null);
    setReviewForm(createDefaultReviewForm());
    setShowAddEvent(false);
    setNewEvent(createDefaultEventDraft());
    setResearchTarget(null);
    setResearchResults(null);
    setTpCode("");
    setTpFirm("");
    setTpVal("");
    setRelayPlanExpanded(false);
  }, []);
  const loadPortfolio = useCallback(async (pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
    const snapshot = await loadPortfolioSnapshot(pid);
    setActivePortfolioId(pid);
    setViewMode(nextViewMode);
    applyPortfolioSnapshot(snapshot);
    setCloudStateForPortfolio(pid, nextViewMode);
    return snapshot;
  }, [applyPortfolioSnapshot, setCloudStateForPortfolio]);

  const {
    portfolios, setPortfolios,
    activePortfolioId,
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
  } = usePortfolioManagement({
    ready,
    initialPortfolios: [],
    initialActivePortfolioId: OWNER_PORTFOLIO_ID,
    initialViewMode: PORTFOLIO_VIEW_MODE,
    activeHoldings: holdings,
    activeNewsEvents: newsEvents,
    activePortfolioNotes: portfolioNotes,
    marketPriceCache,
    flushCurrentPortfolio,
    resetTransientUiState,
    loadPortfolio,
    setSaved,
  });

  const isImeComposing = (ev) => ev.nativeEvent?.isComposing || ev.keyCode === 229;
  const canPersistPortfolioData = ready && viewMode === PORTFOLIO_VIEW_MODE && !portfolioTransitionRef.current.isHydrating;
  const canUseCloud = viewMode === PORTFOLIO_VIEW_MODE && activePortfolioId === OWNER_PORTFOLIO_ID;

  // boot
  useEffect(() => {
    (async () => {
      portfolioTransitionRef.current = {
        isHydrating: true,
        fromPid: activePortfolioId,
        toPid: activePortfolioId,
      };

      await migrateLegacyPortfolioStorageIfNeeded();
      await seedJinlianchengIfNeeded();
      const registry = await ensurePortfolioRegistry();
      await applyTradeBackfillPatchesIfNeeded();
      const pid = registry.activePortfolioId;
      const snapshot = await loadPortfolioSnapshot(pid);

      setPortfolios(registry.portfolios);
      setActivePortfolioId(pid);
      setViewMode(registry.viewMode);
      applyPortfolioSnapshot(snapshot);
      setReady(true);

      const lastCloudSyncAt = readSyncAt("pf-cloud-sync-at");
      const shouldSyncCloud = pid === OWNER_PORTFOLIO_ID && (!lastCloudSyncAt || (Date.now() - lastCloudSyncAt > CLOUD_SYNC_TTL));
      cloudSyncStateRef.current = { enabled: false, syncedAt: lastCloudSyncAt };

      if (pid !== OWNER_PORTFOLIO_ID) {
        setCloudSync(false);
        portfolioTransitionRef.current = {
          isHydrating: false,
          fromPid: pid,
          toPid: pid,
        };
        return;
      }

      // 冷卻時間內仍輕量檢查 holdings，避免本機舊持倉卡住不更新
      if (!shouldSyncCloud) {
        try {
          const cloudHoldings = await fetch("/api/brain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "load-holdings" }),
          }).then((r) => r.json());
          const cloudH = cloudHoldings?.holdings;
          if (cloudH && Array.isArray(cloudH) && cloudH.length > 0 && shouldAdoptCloudHoldings(snapshot.holdings, cloudH)) {
            const normalizedCloudHoldings = normalizeHoldings(
              cloudH,
              marketPriceCache?.prices,
              buildHoldingPriceHints({
                analysisHistory: snapshot.analysisHistory,
                fallbackRows: getPortfolioFallback(pid, "holdings-v2"),
              })
            );
            snapshot.holdings = normalizedCloudHoldings;
            setHoldings(normalizedCloudHoldings);
            savePortfolioData(pid, "holdings-v2", normalizedCloudHoldings);
          }
        } catch (e) {
          // localStorage fallback keeps app usable offline
        }
        cloudSyncStateRef.current = {
          enabled: true,
          syncedAt: readSyncAt("pf-cloud-sync-at"),
        };
        setCloudSync(true);
        portfolioTransitionRef.current = {
          isHydrating: false,
          fromPid: pid,
          toPid: pid,
        };
        return;
      }

      try {
        const [cloudBrain, cloudEvents, cloudHoldings, cloudHistory, cloudResearch] = await Promise.all([
          fetch("/api/brain?action=brain").then(r=>r.json()).catch(()=>({brain:null})),
          fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load-events"})}).then(r=>r.json()).catch(()=>({events:null})),
          fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load-holdings"})}).then(r=>r.json()).catch(()=>({holdings:null})),
          fetch("/api/brain?action=history").then(r=>r.json()).catch(()=>({history:null})),
          fetch("/api/research").then(r=>r.json()).catch(()=>({reports:null})),
        ]);
        // 雲端同步策略：本地優先，雲端只補缺（合併不覆蓋）
        if (cloudBrain.brain && !snapshot.strategyBrain) {
          const normalizedBrain = normalizeStrategyBrain(cloudBrain.brain);
          setStrategyBrain(normalizedBrain);
          savePortfolioData(pid, "brain-v1", normalizedBrain);
        }
        if (cloudEvents.events && (!snapshot.newsEvents || snapshot.newsEvents.length === 0)) {
          const normalizedEvents = normalizeNewsEvents(cloudEvents.events);
          setNewsEvents(normalizedEvents);
          savePortfolioData(pid, "news-events-v1", normalizedEvents);
        }
        const cloudH = cloudHoldings.holdings;
        if (cloudH && Array.isArray(cloudH) && cloudH.length > 0 && shouldAdoptCloudHoldings(snapshot.holdings, cloudH)) {
          const normalizedCloudHoldings = normalizeHoldings(
            cloudH,
            marketPriceCache?.prices,
            buildHoldingPriceHints({
              analysisHistory: snapshot.analysisHistory,
              fallbackRows: getPortfolioFallback(pid, "holdings-v2"),
            })
          );
          snapshot.holdings = normalizedCloudHoldings;
          setHoldings(normalizedCloudHoldings);
          savePortfolioData(pid, "holdings-v2", normalizedCloudHoldings);
        }
        // 分析歷史：合併本地+雲端，去重
        if (cloudHistory.history?.length) {
          const unique = normalizeAnalysisHistoryEntries([...(snapshot.analysisHistory || []), ...cloudHistory.history]);
          setAnalysisHistory(unique);
          savePortfolioData(pid, "analysis-history-v1", unique);
          writeSyncAt("pf-analysis-cloud-sync-at", Date.now());
          // 如果本地沒有 dailyReport，從合併結果補上
          if (!snapshot.dailyReport && unique.length > 0) setDailyReport(normalizeDailyReportEntry(unique[0]));
        }
        // 研究歷史：合併本地+雲端，去重
        if (cloudResearch.reports?.length) {
          const merged = [...(snapshot.researchHistory || []), ...cloudResearch.reports];
          const unique = merged.filter((r, i, arr) => arr.findIndex(x => x.timestamp === r.timestamp) === i)
            .sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
          setResearchHistory(unique);
          savePortfolioData(pid, "research-history-v1", unique);
          writeSyncAt("pf-research-cloud-sync-at", Date.now());
        }
        const syncedAt = Date.now();
        cloudSyncStateRef.current = {
          enabled: true,
          syncedAt,
        };
        writeSyncAt("pf-cloud-sync-at", syncedAt);
        setCloudSync(true);
      } catch(e) {
        /* 離線也能用 localStorage 版本 */
      } finally {
        portfolioTransitionRef.current = {
          isHydrating: false,
          fromPid: pid,
          toPid: pid,
        };
      }
    })();
  }, []);

  // auto-save
  useEffect(() => {
    if (canPersistPortfolioData && holdings) {
      const normalizedHoldings = normalizeHoldings(holdings, marketPriceCache?.prices);
      savePortfolioData(activePortfolioId, "holdings-v2", normalizedHoldings);
      scheduleCloudSave("save-holdings", normalizedHoldings);
    }
  }, [activePortfolioId, canPersistPortfolioData, holdings, marketPriceCache]);
  useEffect(() => { if (canPersistPortfolioData && tradeLog) savePortfolioData(activePortfolioId, "log-v2", tradeLog); }, [activePortfolioId, canPersistPortfolioData, tradeLog]);
  useEffect(() => { if (canPersistPortfolioData && targets)  savePortfolioData(activePortfolioId, "targets-v1", targets); }, [activePortfolioId, canPersistPortfolioData, targets]);
  useEffect(() => { if (canPersistPortfolioData && fundamentals) savePortfolioData(activePortfolioId, "fundamentals-v1", fundamentals); }, [activePortfolioId, canPersistPortfolioData, fundamentals]);
  useEffect(() => { if (canPersistPortfolioData && watchlist) savePortfolioData(activePortfolioId, "watchlist-v1", watchlist); }, [activePortfolioId, canPersistPortfolioData, watchlist]);

  // watchlist handlers
  const openWatchlistAddModal = () => {
    setWatchlistEditing(null);
    setWatchlistForm({ code: "", name: "", price: "", target: "", status: "", catalyst: "", scKey: "blue", note: "" });
    setWatchlistModalOpen(true);
  };
  const openWatchlistEditModal = (item) => {
    setWatchlistEditing(item);
    setWatchlistForm({
      code: item.code,
      name: item.name,
      price: String(item.price || ""),
      target: String(item.target || ""),
      status: item.status || "",
      catalyst: item.catalyst || "",
      scKey: item.scKey || "blue",
      note: item.note || "",
    });
    setWatchlistModalOpen(true);
  };
  const handleWatchlistDelete = (code) => {
    const next = (watchlist || []).filter(item => item.code !== code);
    setWatchlist(next);
  };
  const handleWatchlistSubmit = () => {
    const code = watchlistForm.code.trim();
    const name = watchlistForm.name.trim();
    if (!code || !name) return;
    const price = parseFloat(watchlistForm.price) || 0;
    const target = parseFloat(watchlistForm.target) || 0;
    const newItem = {
      code,
      name,
      price: price > 0 ? price : 0,
      target: target > 0 ? target : 0,
      status: watchlistForm.status.trim(),
      catalyst: watchlistForm.catalyst.trim(),
      scKey: watchlistForm.scKey || "blue",
      note: watchlistForm.note.trim(),
    };
    let next;
    if (watchlistEditing) {
      next = (watchlist || []).map(item => item.code === watchlistEditing.code ? newItem : item);
    } else {
      next = [...(watchlist || []), newItem];
    }
    setWatchlist(next);
    setWatchlistModalOpen(false);
  };

  useEffect(() => { if (canPersistPortfolioData && analystReports) savePortfolioData(activePortfolioId, "analyst-reports-v1", analystReports); }, [activePortfolioId, analystReports, canPersistPortfolioData]);
  useEffect(() => { if (canPersistPortfolioData && reportRefreshMeta) savePortfolioData(activePortfolioId, "report-refresh-meta-v1", reportRefreshMeta); }, [activePortfolioId, canPersistPortfolioData, reportRefreshMeta]);
  useEffect(() => {
    if (!canPersistPortfolioData || !holdings) return;
    const nextDossiers = buildHoldingDossiers({
      holdings: applyMarketQuotesToHoldings(holdings, marketPriceCache?.prices),
      watchlist,
      targets,
      fundamentals,
      analystReports,
      newsEvents,
      researchHistory,
      strategyBrain,
      marketPriceCache,
      marketPriceSync,
    });
    const prevJson = JSON.stringify(normalizeHoldingDossiers(holdingDossiers));
    const nextJson = JSON.stringify(nextDossiers);
    if (prevJson !== nextJson) {
      setHoldingDossiers(nextDossiers);
    }
  }, [
    activePortfolioId,
    canPersistPortfolioData,
    holdings,
    marketPriceCache,
    marketPriceSync,
    newsEvents,
    researchHistory,
    strategyBrain,
    targets,
    fundamentals,
    watchlist,
    analystReports,
  ]);
  useEffect(() => {
    if (canPersistPortfolioData && holdingDossiers) {
      savePortfolioData(activePortfolioId, "holding-dossiers-v1", holdingDossiers);
    }
  }, [activePortfolioId, canPersistPortfolioData, holdingDossiers]);
  useEffect(() => {
    if (canPersistPortfolioData && newsEvents) {
      savePortfolioData(activePortfolioId, "news-events-v1", newsEvents);
      scheduleCloudSave("save-events", newsEvents);
    }
  }, [activePortfolioId, canPersistPortfolioData, newsEvents]);
  useEffect(() => { if (canPersistPortfolioData && analysisHistory) savePortfolioData(activePortfolioId, "analysis-history-v1", analysisHistory); }, [activePortfolioId, analysisHistory, canPersistPortfolioData]);
  useEffect(() => { if (canPersistPortfolioData && dailyReport) savePortfolioData(activePortfolioId, "daily-report-v1", dailyReport); }, [activePortfolioId, canPersistPortfolioData, dailyReport]);
  useEffect(() => { if (canPersistPortfolioData && reversalConditions) savePortfolioData(activePortfolioId, "reversal-v1", reversalConditions); }, [activePortfolioId, canPersistPortfolioData, reversalConditions]);
  useEffect(() => {
    if (canPersistPortfolioData && strategyBrain) {
      savePortfolioData(activePortfolioId, "brain-v1", strategyBrain);
      scheduleCloudSave("save-brain", strategyBrain);
    }
  }, [activePortfolioId, canPersistPortfolioData, strategyBrain]);
  useEffect(() => {
    if (canPersistPortfolioData && brainValidation) {
      savePortfolioData(activePortfolioId, "brain-validation-v1", brainValidation);
    }
  }, [activePortfolioId, brainValidation, canPersistPortfolioData]);
  useEffect(() => {
    const lastAnalysisSyncAt = readSyncAt("pf-analysis-cloud-sync-at");
    const shouldFetchAnalysis = canUseCloud && (tab === "daily" || tab === "log") && (!lastAnalysisSyncAt || Date.now() - lastAnalysisSyncAt > CLOUD_SYNC_TTL);
    if (!shouldFetchAnalysis) return;
    fetch("/api/brain?action=history")
      .then(r=>r.json())
      .then(data => {
        if (!data.history?.length) return;
        setAnalysisHistory(prev => {
          const unique = normalizeAnalysisHistoryEntries([...(prev || []), ...data.history]);
          savePortfolioData(activePortfolioId, "analysis-history-v1", unique);
          return unique;
        });
        writeSyncAt("pf-analysis-cloud-sync-at", Date.now());
      })
      .catch(()=>{});
  }, [activePortfolioId, canUseCloud, tab]);
  useEffect(() => {
    const lastResearchSyncAt = readSyncAt("pf-research-cloud-sync-at");
    const shouldFetchResearch = canUseCloud && tab === "research" && (!lastResearchSyncAt || Date.now() - lastResearchSyncAt > CLOUD_SYNC_TTL);
    if (!shouldFetchResearch) return;
    fetch("/api/research")
      .then(r=>r.json())
      .then(data => {
        if (!data.reports?.length) return;
        const merged = [...(researchHistory || []), ...data.reports];
        const unique = merged.filter((r,i,arr) => arr.findIndex(x => x.timestamp === r.timestamp) === i)
          .sort((a,b) => b.timestamp - a.timestamp).slice(0, 30);
        setResearchHistory(unique);
        savePortfolioData(activePortfolioId, "research-history-v1", unique);
        writeSyncAt("pf-research-cloud-sync-at", Date.now());
      })
      .catch(()=>{});
  }, [activePortfolioId, canUseCloud, researchHistory, tab]);
  useEffect(() => () => {
    Object.values(cloudSaveTimersRef.current).forEach(clearTimeout);
  }, []);
  useEffect(() => { if (canPersistPortfolioData && researchHistory) savePortfolioData(activePortfolioId, "research-history-v1", researchHistory); }, [activePortfolioId, canPersistPortfolioData, researchHistory]);
  useEffect(() => { if (canPersistPortfolioData && portfolioNotes) savePortfolioData(activePortfolioId, "notes-v1", portfolioNotes); }, [activePortfolioId, canPersistPortfolioData, portfolioNotes]);
  useEffect(() => {
    const shouldSyncLifecycle =
      ready &&
      viewMode === PORTFOLIO_VIEW_MODE &&
      !portfolioTransitionRef.current.isHydrating &&
      Array.isArray(newsEvents) &&
      newsEvents.length > 0 &&
      ["holdings", "events", "news", "daily"].includes(tab);
    if (!shouldSyncLifecycle || eventLifecycleSyncRef.current) return;

    let cancelled = false;
    eventLifecycleSyncRef.current = true;

    (async () => {
      try {
        const nextEvents = await syncEventLifecycle(newsEvents);
        if (cancelled) return;
        const currentJson = JSON.stringify(normalizeNewsEvents(newsEvents));
        const nextJson = JSON.stringify(nextEvents);
        if (currentJson !== nextJson) {
          setNewsEvents(nextEvents);
        }
      } finally {
        eventLifecycleSyncRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePortfolioId, newsEvents, ready, tab, viewMode]);

  useEffect(() => {
    if (!ready || viewMode !== PORTFOLIO_VIEW_MODE) return;
    syncPostClosePrices({ silent: true }).catch(err => {
      console.warn("收盤價靜默同步失敗:", err);
    });
  }, [ready, viewMode, activePortfolioId]);

  // derived
  const H = Array.isArray(holdings) ? holdings : [];
  
  // 觀察股應用市場報價更新
  const W = useMemo(() => {
    const watchlistRows = Array.isArray(watchlist) ? watchlist : [];
    if (!marketPriceCache?.prices || watchlistRows.length === 0) return watchlistRows;
    
    return watchlistRows.map(item => {
      const quote = marketPriceCache.prices[item.code];
      if (!quote?.price) return item;
      
      // 更新價格和潛在漲幅
      const newPrice = quote.price;
      const newTarget = item.target || null;
      const newUpside = newTarget && newPrice > 0 
        ? ((newTarget - newPrice) / newPrice) * 100 
        : null;
      
      return {
        ...item,
        price: newPrice,
        change: quote.change || 0,
        changePct: quote.changePct || 0,
        upside: newUpside,
      };
    });
  }, [watchlist, marketPriceCache]);
  
  const D = useMemo(() => {
    const normalized = normalizeHoldingDossiers(holdingDossiers);
    if (normalized.length > 0) return normalized;
    return buildHoldingDossiers({
      holdings: H,
      watchlist: W,
      targets,
      fundamentals,
      analystReports,
      newsEvents,
      researchHistory,
      strategyBrain,
      marketPriceCache,
      marketPriceSync,
    });
  }, [holdingDossiers, H.length, W.length, targets, fundamentals, analystReports, newsEvents, researchHistory, strategyBrain, marketPriceCache, marketPriceSync]);
  const dossierByCode = useMemo(() => new Map(D.map(item => [item.code, item])), [D]);
  const brainValidationSummaryByRule = buildBrainValidationSummaryMap(brainValidation, activePortfolioId);
  const currentNewsEvents = Array.isArray(newsEvents) ? newsEvents : [];
  const totalVal  = H.reduce((s,h)=>s + getHoldingMarketValue(h),0);
  const totalCost = H.reduce((s,h)=>s + getHoldingCostBasis(h),0);
  const totalPnl  = totalVal - totalCost;
  const retPct    = totalCost>0 ? totalPnl/totalCost*100 : 0;
  const todayMarketClock = getTaipeiClock(new Date());
  const activeMarketDate = marketPriceSync?.marketDate || marketPriceCache?.marketDate || null;
  const activePriceSyncAt = parseStoredDate(marketPriceSync?.syncedAt || marketPriceCache?.syncedAt || null);
  const priceSyncStatusLabel = !activeMarketDate
    ? "收盤價未同步"
    : activeMarketDate === todayMarketClock.marketDate
      ? `收盤價 ${activeMarketDate.replace(/-/g, "/")}`
      : `沿用 ${activeMarketDate.replace(/-/g, "/")}`;
  const priceSyncStatusTone = !activeMarketDate
    ? C.amber
    : activeMarketDate === todayMarketClock.marketDate
      ? C.olive
      : C.textMute;
  const holdingsIntegrityIssues = H.filter(h => h?.integrityIssue === "missing-price");
  const missingTrackedQuoteCodes = H
    .map(item => String(item?.code || "").trim());

  useEffect(() => {
    if (!ready || viewMode !== PORTFOLIO_VIEW_MODE) return;
    if (todayMarketClock.isWeekend || todayMarketClock.minutes < POST_CLOSE_SYNC_MINUTES) return;
    if (H.length === 0) return;
    if (!(totalVal <= 0 || holdingsIntegrityIssues.length > 0 || activeMarketDate !== todayMarketClock.marketDate || missingTrackedQuoteCodes.length > 0)) return;

    const healKey = `${activePortfolioId}:${todayMarketClock.marketDate}`;
    if (priceSelfHealRef.current[healKey]) return;
    priceSelfHealRef.current[healKey] = true;

    syncPostClosePrices({ silent: true, force: true }).catch(err => {
      console.warn("收盤價自我修復同步失敗:", err);
    });
  }, [
    H.length,
    activeMarketDate,
    activePortfolioId,
    holdingsIntegrityIssues.length,
    missingTrackedQuoteCodes.length,
    ready,
    todayMarketClock.isWeekend,
    todayMarketClock.marketDate,
    todayMarketClock.minutes,
    totalVal,
    viewMode,
  ]);

  const getPortfolioSnapshot = useCallback((portfolioId) => {
    const useLiveState = viewMode === PORTFOLIO_VIEW_MODE && portfolioId === activePortfolioId;
    const holdingsValue = useLiveState ? H : readStorageValue(pfKey(portfolioId, "holdings-v2"));
    const eventsValue = useLiveState ? (newsEvents || []) : readStorageValue(pfKey(portfolioId, "news-events-v1"));
    const notesValue = useLiveState ? portfolioNotes : readStorageValue(pfKey(portfolioId, "notes-v1"));
    return {
      holdings: applyMarketQuotesToHoldings(Array.isArray(holdingsValue) ? holdingsValue : getPortfolioFallback(portfolioId, "holdings-v2"), marketPriceCache?.prices),
      newsEvents: normalizeNewsEvents(Array.isArray(eventsValue) ? eventsValue : getPortfolioFallback(portfolioId, "news-events-v1")),
      notes: notesValue && typeof notesValue === "object" ? { ...clonePortfolioNotes(), ...notesValue } : clonePortfolioNotes(),
    };
  }, [viewMode, activePortfolioId, H, newsEvents, portfolioNotes, marketPriceCache]);
  const activePortfolio = portfolioSummaries.find(item => item.id === activePortfolioId) || portfolioSummaries[0] || null;
  const overviewPortfolios = portfolioSummaries.map(portfolio => {
    const snapshot = getPortfolioSnapshot(portfolio.id);
    const pendingEvents = (snapshot.newsEvents || []).filter(event => !isClosedEvent(event));
    return {
      ...portfolio,
      holdings: snapshot.holdings,
      newsEvents: snapshot.newsEvents,
      notes: snapshot.notes,
      pendingEvents,
    };
  });
  const overviewTotalValue = overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalValue, 0);
  const overviewTotalPnl = overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalPnl, 0);
  const overviewTotalCost = overviewPortfolios.reduce((sum, portfolio) => sum + (portfolio.totalValue - portfolio.totalPnl), 0);
  const overviewRetPct = overviewTotalCost > 0 ? (overviewTotalPnl / overviewTotalCost) * 100 : 0;
  const displayedTotalPnl = viewMode === OVERVIEW_VIEW_MODE ? overviewTotalPnl : totalPnl;
  const displayedRetPct = viewMode === OVERVIEW_VIEW_MODE ? overviewRetPct : retPct;
  const overviewDuplicateHoldings = (() => {
    const byCode = new Map();
    overviewPortfolios.forEach(portfolio => {
      (portfolio.holdings || []).forEach(item => {
        const existing = byCode.get(item.code) || { code: item.code, name: item.name, totalValue: 0, portfolios: [] };
        const holdingValue = getHoldingMarketValue(item);
        const holdingPnl = getHoldingUnrealizedPnl(item);
        existing.totalValue += holdingValue;
        existing.portfolios.push({
          id: portfolio.id,
          name: portfolio.name,
          qty: Number(item.qty) || 0,
          value: holdingValue,
          pnl: holdingPnl,
        });
        byCode.set(item.code, existing);
      });
    });
    return Array.from(byCode.values())
      .filter(item => item.portfolios.length > 1)
      .sort((a, b) => b.portfolios.length - a.portfolios.length || b.totalValue - a.totalValue);
  })();
  const overviewPendingItems = overviewPortfolios
    .flatMap(portfolio => portfolio.pendingEvents.map(event => ({
      ...event,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
    })))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const todayAlertItems = H
    .filter(item => typeof item.alert === "string" && item.alert.trim())
    .map(item => {
      const alertText = item.alert.replace(/^⚡\s*/, "").trim();
      if (!alertText) return null;
      if (alertText.includes("法說")) return `${item.name}${alertText}`;
      if (alertText.includes("出場區間")) return `${item.name}已到${alertText.replace(/到$/, "")}`;
      return `${item.name} ${alertText}`;
    })
    .filter(Boolean);
  const urgentCount = todayAlertItems.length;
  const todayAlertSummary = urgentCount > 2
    ? `${todayAlertItems.slice(0, 2).join(" · ")} · 另有 ${urgentCount - 2} 項提醒`
    : todayAlertItems.join(" · ");
  const watchlistRows = useMemo(() => W.map((item, index) => {
    const relatedEvents = currentNewsEvents.filter(event => event.stocks?.some(stock => stock.includes(item.code)));
    const trackingCount = relatedEvents.filter(event => event.status === "tracking").length;
    const pendingCount = relatedEvents.filter(event => event.status === "pending").length;
    const hits = relatedEvents.filter(event => event.correct === true).length;
    const misses = relatedEvents.filter(event => event.correct === false).length;
    const isUrgent = /⚡/.test(item.status || "") || relatedEvents.some(event => {
      if (!event) return false;
      const eventDate = parseFlexibleDate(event.eventDate || event.date || event.trackingStart || event.exitDate);
      if (!eventDate) return false;
      const today = todayStorageDate();
      return formatDateToStorageDate(eventDate) === today;
    });
    const primaryEvent =
      relatedEvents.find(event => event.status === "tracking") ||
      relatedEvents.find(event => event.status === "pending") ||
      relatedEvents[0] ||
      null;
    const upside = item.price > 0 && item.target > 0 ? ((item.target - item.price) / item.price) * 100 : null;
    const summary = primaryEvent?.title || item.catalyst || item.note || "持續觀察";
    const action = isUrgent
      ? "今天先看事件結果，再決定是否加碼、續抱或停損。"
      : trackingCount > 0
        ? "目前已進入追蹤期，優先看價格與事件驗證。"
        : pendingCount > 0
          ? "先保留觀察，等事件落地再加大部位。"
          : item.note || "暫列觀察名單，還不急著動作。";
    const priority = (isUrgent ? 5 : 0) + (trackingCount > 0 ? 3 : 0) + (pendingCount > 0 ? 2 : 0) + (upside != null && upside >= 20 ? 1 : 0);
    return {
      item,
      index,
      relatedEvents,
      trackingCount,
      pendingCount,
      hits,
      misses,
      primaryEvent,
      upside,
      summary,
      action,
      priority,
    };
  }), [W, currentNewsEvents]);
  const watchlistFocus = useMemo(() => watchlistRows.length > 0
    ? [...watchlistRows].sort((a, b) => b.priority - a.priority || (b.upside ?? -999) - (a.upside ?? -999))[0]
    : null, [watchlistRows]);
  const showRelayPlan = activePortfolioId === OWNER_PORTFOLIO_ID || H.some(item => RELAY_PLAN_CODES.has(item.code)) || W.some(item => RELAY_PLAN_CODES.has(item.code));

  const sorted = useMemo(() => [...H].sort((a,b)=>{
    if(sortBy==="value") return getHoldingMarketValue(b)-getHoldingMarketValue(a);
    if(sortBy==="pnl")   return (getHoldingUnrealizedPnl(b) || 0) - (getHoldingUnrealizedPnl(a) || 0);
    if(sortBy==="pct") {
      const pctA = getHoldingReturnPct(a) || 0;
      const pctB = getHoldingReturnPct(b) || 0;
      return pctB - pctA;
    }
    return 0;
  }), [H, sortBy]);
  const scanRows = useMemo(() => sorted.map(h => {
    const meta = STOCK_META[h.code];
    const T = targets?.[h.code];
    const relatedEvents = (newsEvents || NEWS_EVENTS).filter(e => e.stocks?.some(s => s.includes(h.code)));
    const hasPending = relatedEvents.some(e => e.correct == null);
    const pnl = getHoldingUnrealizedPnl(h);
    const priority = h.alert || T?.isNew ? "A" : (hasPending || (pnl !== null && pnl < 0) ? "B" : "C");
    const needsAttention = priority !== "C";
    return { h, meta, T, relatedEvents, hasPending, needsAttention, priority };
  }), [sorted, targets, newsEvents]);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredRows = useMemo(() => scanRows.filter(({ h, meta, T, relatedEvents, hasPending, needsAttention }) => {
    const searchable = [
      h.name || "",
      String(h.code || ""),
      meta?.industry || "",
      meta?.strategy || "",
      meta?.position || "",
    ];
    const matchQuery = !normalizedQuery || searchable.some(v => String(v).toLowerCase().includes(normalizedQuery));
    if (!matchQuery) return false;
    if (scanFilter === "全部") return true;
    if (scanFilter === "需處理") return needsAttention;
    if (scanFilter === "虧損") {
      const pnl = getHoldingUnrealizedPnl(h);
      return pnl !== null && pnl < 0;
    }
    if (scanFilter === "待處理") return hasPending;
    if (scanFilter === "目標更新") return Boolean(T?.isNew);
    if (scanFilter === "權證") return h.type === "權證";
    return true;
  }), [scanRows, normalizedQuery, scanFilter]);
  const displayed = showAll ? filteredRows : filteredRows.slice(0,12);
  const top5 = useMemo(() => [...H].sort((a,b)=>getHoldingMarketValue(b)-getHoldingMarketValue(a)).slice(0,5), [H]);
  const topColors = [C.blue, C.amber, C.lavender, C.olive, C.teal];
  const winners = useMemo(() => H.filter(h=>getHoldingUnrealizedPnl(h)>0).sort((a,b)=>getHoldingReturnPct(b)-getHoldingReturnPct(a)), [H]);
  const losers  = useMemo(() => H.filter(h=>getHoldingUnrealizedPnl(h)<0).sort((a,b)=>getHoldingReturnPct(a)-getHoldingReturnPct(b)), [H]);
  const attentionCount = scanRows.filter(r => r.needsAttention).length;
  const pendingCount = scanRows.filter(r => r.hasPending).length;
  const targetUpdateCount = scanRows.filter(r => r.T?.isNew).length;
  const dataRefreshRows = useMemo(() => D.map(dossier => {
    const targetStatus = dossier?.freshness?.targets || "missing";
    return {
      code: dossier.code,
      name: dossier.name,
      targetStatus,
      fundamentalStatus,
      severity,
      targetUpdatedAt: dossier.targets?.updatedAt || null,
      fundamentalsUpdatedAt: dossier.fundamentals?.updatedAt || null,
    }; // Removed severity calculation, it's not used in the header
  })
    .filter(item => item.severity > 0)
    .sort((a, b) => b.severity - a.severity || String(a.code).localeCompare(String(b.code))), [D]);
  const staleTargetCount = D.filter(item => item?.freshness?.targets === "stale").length;
  const missingTargetCount = D.filter(item => item?.freshness?.targets === "missing").length;
  const staleFundamentalCount = D.filter(item => item?.freshness?.fundamentals === "stale").length;
  const missingFundamentalCount = D.filter(item => item?.freshness?.fundamentals === "missing").length;
  const todayRefreshKey = getTaipeiClock(new Date()).marketDate;
  const reportRefreshCandidates = useMemo(() => H.map(holding => {
    const dossier = dossierByCode.get(holding.code) || null;
    const refreshEntry = reportRefreshMeta?.[holding.code] || {};
    const relatedEvents = currentNewsEvents.filter(event => getEventStockCodes(event).includes(holding.code) && !isClosedEvent(event));
    const targetStatus = dossier?.freshness?.targets || "missing";
    const analystStatus = dossier?.freshness?.analyst || "missing";
    const score =
      (targetStatus === "missing" ? 5 : targetStatus === "stale" ? 3 : 0) +
      (analystStatus === "missing" ? 4 : analystStatus === "stale" ? 2 : 0) +
      (relatedEvents.length > 0 ? 2 : 0);
    return {
      holding,
      score,
      targetStatus,
      analystStatus,
      relatedEvents,
      checkedToday: refreshEntry.checkedDate === todayRefreshKey,
    };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || getHoldingMarketValue(b.holding) - getHoldingMarketValue(a.holding)), [H, dossierByCode, reportRefreshMeta, currentNewsEvents, todayRefreshKey]);
  useEffect(() => {
    let mounted = true;
    const runRefresh = async () => {
      if (!ready || viewMode !== PORTFOLIO_VIEW_MODE || tab !== "research" || reportRefreshing) return;
      if (reportRefreshMeta?.__daily?.date === todayRefreshKey) return;
      if (reportRefreshCandidates.length === 0) return;
      try {
        await refreshAnalystReports({ silent: true });
      } catch (err) {
        if (mounted) console.error("自動刷新公開報告失敗:", err);
      }
    };
    runRefresh();
    return () => { mounted = false; };
  }, [
    ready,
    viewMode,
    tab,
    reportRefreshing,
    reportRefreshMeta,
    todayRefreshKey,
    reportRefreshCandidates.length,
    refreshAnalystReports,
  ]);

  const filteredEvents = filterType==="全部" ? EVENTS : EVENTS.filter(e=>e.type===filterType);
  const fetchMarketPriceMap = async (codes) => {
    const quotes = await getMarketQuotesForCodes(codes);
    return Object.fromEntries(
      Object.entries(quotes)
        .map(([code, quote]) => [code, quote?.price])
        .filter(([, price]) => Number.isFinite(price) && price > 0)
    );
  };
  const buildEventPriceRecord = (event, priceMap) => {
    const codes = getEventStockCodes(event);
    const entries = codes
      .map(code => [code, priceMap?.[code]])
      .filter(([, price]) => Number.isFinite(price) && price > 0);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  const formatEventPriceRecord = (prices) => {
    if (!prices) return "—";
    return Object.entries(prices)
      .map(([code, price]) => `${code} ${Number(price).toFixed(1)}`)
      .join(" / ");
  };
  const getEventTrackingMetrics = (event) => {
    const latestEntry = Array.isArray(event?.priceHistory) && event.priceHistory.length > 0
      ? event.priceHistory[event.priceHistory.length - 1]
      : null;
    const currentPrices = latestEntry?.prices || event?.priceAtExit || null;
    const entryAvg = averagePriceRecord(event?.priceAtEvent);
    const currentAvg = averagePriceRecord(currentPrices);
    const changePct = entryAvg && currentAvg ? ((currentAvg / entryAvg) - 1) * 100 : null;
    const trackingDays = daysBetween(event?.trackingStart || event?.eventDate);
    return {
      latestDate: latestEntry?.date || event?.exitDate || null,
      currentPrices,
      entryAvg,
      currentAvg,
      changePct,
      trackingDays,
    };
  };
  const syncEventLifecycle = async (events = newsEvents) => {
    const normalizedEvents = normalizeNewsEvents(events);
    if (normalizedEvents.length === 0) return normalizedEvents;

    const today = toSlashDate();
    const todayDate = parseSlashDate(today);
    
    // 1. 找出需要自動結案的 tracking 事件
    const autoCloseCandidates = normalizedEvents.filter(event => {
      if (event.status !== "tracking") return false;
      const trackingStart = parseSlashDate(event.trackingStart);
      if (!trackingStart) return false;
      const trackingDays = Math.floor((todayDate - trackingStart) / (1000 * 60 * 60 * 24));
      return trackingDays >= 90; // 超過 90 天自動結案
    });

    // 2. 找出需要轉換為 tracking 的 pending 事件
    const duePending = normalizedEvents.filter(event => {
      if (event.status !== "pending") return false;
      const scheduled = parseSlashDate(event.date);
      return scheduled && scheduled.getTime() <= todayDate.getTime();
    });

    // 3. 找出需要更新價格的 tracking 事件（排除已自動結案的）
    const trackingEvents = normalizedEvents.filter(event => 
      event.status === "tracking" && !autoCloseCandidates.some(e => e.id === event.id)
    );

    // 4. 收集需要抓取的價格代碼
    const priceCodes = Array.from(new Set([
      ...autoCloseCandidates.flatMap(getEventStockCodes),
      ...duePending.flatMap(getEventStockCodes),
      ...trackingEvents.flatMap(getEventStockCodes),
    ]));

    if (priceCodes.length === 0) return normalizedEvents;

    let priceMap = {};
    try {
      priceMap = await fetchMarketPriceMap(priceCodes);
    } catch (err) {
      console.error("事件追蹤價格抓取失敗:", err);
      return normalizedEvents;
    }

    // 5. 處理自動結案
    const autoClosedIds = new Set();
    let result = normalizedEvents.map(event => {
      if (autoCloseCandidates.some(e => e.id === event.id)) {
        const latestPrices = buildEventPriceRecord(event, priceMap);
        if (!latestPrices) return event;
        autoClosedIds.add(event.id);
        return {
          ...event,
          status: "closed",
          exitDate: today,
          priceAtExit: latestPrices,
          autoClosed: true, // 標記為自動結案
          autoClosedReason: `追蹤已滿 90 天`,
        };
      }
      return event;
    });

    // 6. 處理 pending → tracking 轉換
    result = result.map(event => {
      if (event.status === "pending") {
        const scheduled = parseSlashDate(event.date);
        if (!scheduled || scheduled.getTime() > todayDate.getTime()) return event;
        const priceAtEvent = buildEventPriceRecord(event, priceMap);
        if (!priceAtEvent) return event;
        return {
          ...event,
          status: "tracking",
          eventDate: today,
          trackingStart: today,
          priceAtEvent,
          priceHistory: appendPriceHistory(event.priceHistory, today, priceAtEvent),
        };
      }
      return event;
    });

    // 7. 處理 tracking 事件的價格更新
    result = result.map(event => {
      if (event.status === "tracking") {
        const latestPrices = buildEventPriceRecord(event, priceMap);
        if (!latestPrices) return event;
        return {
          ...event,
          priceHistory: appendPriceHistory(event.priceHistory, today, latestPrices),
        };
      }
      return event;
    });

    return result;
  };
  const openEventReview = async (event, domEvent) => {
    domEvent?.stopPropagation?.();
    if (!event) return;

    if (event.status !== "tracking") {
      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
      return;
    }

    try {
      const exitPrices = buildEventPriceRecord(event, await fetchMarketPriceMap(getEventStockCodes(event)));
      if (!exitPrices) {
        setSaved("⚠️ 暫時抓不到結案價格，請先手動填寫");
        setTimeout(() => setSaved(""), 3000);
        setReviewingEvent(event.id);
        setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
        return;
      }

      const exitDate = toSlashDate();
      const actual = inferEventActual(event.priceAtEvent, exitPrices) || event.actual || "neutral";
      const entryAvg = averagePriceRecord(event.priceAtEvent);
      const exitAvg = averagePriceRecord(exitPrices);
      const changePct = entryAvg && exitAvg ? ((exitAvg / entryAvg) - 1) * 100 : null;

      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({
        actual,
        actualNote: changePct == null
          ? ""
          : `事件日均價 ${entryAvg.toFixed(1)} → 結案均價 ${exitAvg.toFixed(1)}（${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%）`,
        exitDate,
        priceAtExit: exitPrices,
      }));
    } catch (err) {
      console.error("準備事件復盤失敗:", err);
      setSaved("⚠️ 暫時抓不到結案價格，請先手動填寫");
      setTimeout(() => setSaved(""), 3000);
      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
    }
  };
  const appendCoachLessonToOwnerBrain = async ({ event, note, lesson }) => {
    if (!event || activePortfolioId === OWNER_PORTFOLIO_ID) return;

    const sourcePortfolio = portfolios.find(item => item.id === activePortfolioId);
    const text = (lesson || note || "").trim();
    if (!text) return;

    const ownerBrain = normalizeStrategyBrain(
      await loadPortfolioData(OWNER_PORTFOLIO_ID, "brain-v1", null),
      { allowEmpty: true }
    );
    const sourceLabel = sourcePortfolio?.name || activePortfolioId;
    const coachLesson = {
      date: toSlashDate(),
      text,
      source: `${sourceLabel}-${event.title}`,
      sourcePortfolioId: activePortfolioId,
      sourceEventId: event.id,
    };
    const existing = (ownerBrain.coachLessons || []).filter(item => !(
      item.sourcePortfolioId === coachLesson.sourcePortfolioId &&
      item.sourceEventId === coachLesson.sourceEventId
    ));
    const nextOwnerBrain = {
      ...ownerBrain,
      coachLessons: [...existing, coachLesson].slice(-100),
    };

    await savePortfolioData(OWNER_PORTFOLIO_ID, "brain-v1", nextOwnerBrain);
  };

  // ── 從 TWSE MIS API 回應中提取最佳股價 ──────────────────────────
  // z=最新成交 h=今高 l=今低 y=昨收 o=今開
  // 收盤後 z 可能是 "-"，需要多層 fallback
  const extractBestPrice = (item) => {
    const tryParse = (v) => { const n = parseFloat(v); return (!isNaN(n) && n > 0) ? n : null; };
    // 優先順序：最新成交 → 今高（代表今天有交易）→ 今開 → 昨收
    return tryParse(item.z) || tryParse(item.h) || tryParse(item.o) || tryParse(item.y) || null;
  };
  const extractYesterday = (item) => {
    const n = parseFloat(item.y); return (!isNaN(n) && n > 0) ? n : null;
  };

  // ── 刷新即時股價（TWSE MIS API）───────────────────────────────
  const refreshPrices = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const clock = getTaipeiClock(new Date());
      const hasMissingTrackedQuotes = Array.isArray(holdings) && holdings.some(item => {
        const code = String(item?.code || "").trim();
        return code && !(marketPriceCache?.prices?.[code]?.price > 0);
      });
      
      // 檢查是否為交易日且已收盤
      const isTradingDay = !clock.isWeekend && clock.minutes >= POST_CLOSE_SYNC_MINUTES;
      const alreadySyncedToday = marketPriceSync?.marketDate === clock.marketDate;
      
      // 如果今天已同步，詢問用戶是否要強制重新抓取
      if (isTradingDay && alreadySyncedToday && !hasMissingTrackedQuotes) {
        const confirmed = window.confirm(
          `今日收盤價已同步（${marketPriceSync?.syncedAt?.slice(11, 16) || 'N/A'} 抓取）。\n\n` +
          `點擊「確定」強制重新抓取最新收盤價，\n點擊「取消」使用既有快取。`
        );
        if (!confirmed) {
          setSaved("✅ 使用既有收盤價快取");
          setTimeout(() => setSaved(""), 2000);
          setRefreshing(false);
          return;
        }
      }
      
      const shouldForceRepair =
        Array.isArray(holdings) && (
          holdings.some(item => item?.integrityIssue === "missing-price" || resolveHoldingPrice(item) <= 0) ||
          (isTradingDay && (marketPriceSync?.marketDate !== clock.marketDate || hasMissingTrackedQuotes))
        );
      const shouldForceManualRefresh = !isTradingDay || alreadySyncedToday;
      
      // 強制重新抓取時，傳入 force: true
      const cache = await syncPostClosePrices({ 
        silent: false, 
        force: shouldForceRepair || shouldForceManualRefresh
      });
      
      if (cache?.prices && Object.keys(cache.prices).length > 0 && viewMode === PORTFOLIO_VIEW_MODE) {
        setHoldings(prev => applyMarketQuotesToHoldings(prev, cache.prices));
      }
    } catch (err) {
      console.error("收盤價同步失敗:", err);
      setSaved("❌ 收盤價同步失敗，請稍後再試");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  // ── 每日收盤分析 ─────────────────────────────────────────────────
  const runDailyAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalyzeStep("讀取收盤價快取...");
    try {
      // 1. 取得收盤價快取（符合條件時，收盤後每日只同步一次）
      const codes = H.map(h => h.code);
      const priceMap = await getMarketQuotesForCodes(codes);

      // 2. 計算每檔今日漲跌
      const changes = H.map(h => {
        const pm = priceMap[h.code];
        return {
          code: h.code, name: h.name, type: h.type,
          price: pm?.price || resolveHoldingPrice(h),
          yesterday: pm?.yesterday || resolveHoldingPrice(h),
          change: pm?.change || 0,
          changePct: pm?.changePct || 0,
          cost: h.cost, qty: h.qty,
          todayPnl: pm ? Math.round(pm.change * h.qty) : 0,
          totalPnl: pm ? Math.round((pm.price - h.cost) * h.qty) : getHoldingUnrealizedPnl(h),
          totalPct: pm ? Math.round(((pm.price / h.cost) - 1) * 10000) / 100 : getHoldingReturnPct(h),
        };
      }).sort((a, b) => b.changePct - a.changePct);

      const totalTodayPnl = changes.reduce((s, c) => s + c.todayPnl, 0);

      // 2b. 取得大盤 / 電子類指數（用於對照分析，不阻擋主流程）
      let marketContext = "";
      try {
        const idxRes = await fetch(`/api/twse?ex_ch=tse_t00.tw|tse_t01.tw`);
        const idxData = await idxRes.json();
        if (idxData?.msgArray?.length > 0) {
          const indices = idxData.msgArray.map(item => {
            const price = parseFloat(item.z) || parseFloat(item.pz) || 0;
            const yesterday = parseFloat(item.y) || 0;
            const changePct = yesterday > 0 ? ((price - yesterday) / yesterday * 100) : 0;
            return { name: item.n, price, yesterday, changePct };
          });
          const taiex = indices.find(i => i.name?.includes("加權"));
          const elec = indices.find(i => i.name?.includes("電子"));
          if (taiex || elec) {
            marketContext = `\n═══ 大盤環境 ═══\n`;
            if (taiex) marketContext += `加權指數：${taiex.price.toFixed(2)} (${taiex.changePct >= 0 ? "+" : ""}${taiex.changePct.toFixed(2)}%)\n`;
            if (elec) marketContext += `電子類指數：${elec.price.toFixed(2)} (${elec.changePct >= 0 ? "+" : ""}${elec.changePct.toFixed(2)}%)\n`;
            marketContext += `\n判斷指引：個股漲幅 < 類股平均 → 相對弱勢需分析原因；個股漲幅 > 類股平均 → 確認是個股利多還是補漲；大盤大跌但個股抗跌 → 確認是否量縮假象。\n`;
          }
        }
      } catch (idxErr) {
        console.warn("大盤指數取得失敗（不影響分析）:", idxErr);
      }

      // 3. 事件連動分析
      const NE = newsEvents || NEWS_EVENTS;
      const today = toSlashDate();
      const pendingEvents = NE.filter(e => !isClosedEvent(e));
      const eventCorrelations = pendingEvents.map(e => {
        const relatedStocks = e.stocks.map(s => {
          const code = s.match(/\d+/)?.[0];
          const ch = changes.find(c => c.code === code);
          return ch ? { name: ch.name, code: ch.code, changePct: ch.changePct, change: ch.change } : null;
        }).filter(Boolean);
        return { ...e, relatedStocks };
      }).filter(e => e.relatedStocks.length > 0 && e.relatedStocks.some(s => Math.abs(s.changePct) > 1));

      // 4. 異常波動（漲跌幅 > 3%）
      const anomalies = changes.filter(c => Math.abs(c.changePct) > 3);

      // 5. 需要復盤的事件（日期已過但未標記結果）
      const needsReview = pendingEvents.filter(e => {
        if (!e.date.match(/^\d{4}\/\d{2}/)) return false;
        return e.date <= today;
      });

      // 6. 呼叫 Claude API 產生策略分析（含策略大腦上下文）
      setAnalyzeStep("AI 策略分析中（約15-30秒）...");
      let aiInsight = null;
      let aiError = null;
      let eventAssessments = [];
      let brainAudit = createEmptyBrainAudit();
      let brainUpdatedInline = false;
      let finalBrainForValidation = normalizeStrategyBrain(strategyBrain, { allowEmpty: true });
      let analysisDossiers = [];
      try {
        const dailyDossiers = changes.map(change => {
          const base = dossierByCode.get(change.code);
          if (!base) return null;
          return {
            ...base,
            position: {
              ...(base.position || {}),
              price: change.price,
              value: Math.round(change.price * (Number(base.position?.qty) || 0)),
              pnl: change.totalPnl,
              pct: change.totalPct,
            },
          };
        }).filter(Boolean);
        analysisDossiers = dailyDossiers;
        const holdingSummary = dailyDossiers.length > 0
          ? dailyDossiers.map(dossier => {
            const change = changes.find(item => item.code === dossier.code);
            return buildDailyHoldingDossierContext(dossier, change);
          }).join("\n\n")
          : "目前沒有持股 dossier。";
        const eventSummary = pendingEvents.map(e =>
          `[eventId:${e.id}] [${e.date}] ${e.title} — 預測:${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} — 狀態:${e.status}`
        ).join("\n");
        const anomalySummary = anomalies.length > 0
          ? anomalies.map(a => `${a.name} ${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(2)}%`).join(", ")
          : "無";

        // 組裝策略大腦上下文
        const brain = strategyBrain;
        const notesContext = formatPortfolioNotesContext(portfolioNotes);
        const coachContext = activePortfolioId === OWNER_PORTFOLIO_ID && (brain?.coachLessons || []).length > 0 ? `
跨組合教練教訓：
${brain.coachLessons.slice(-5).map(item => `- [${item.date}] ${item.source || item.sourcePortfolioId}：${item.text}`).join("\n")}
` : "";
        const userRules = (brain?.rules || []).filter(rule => rule?.source === "user");
        const aiRules = (brain?.rules || []).filter(rule => rule?.source !== "user");
        const candidateRules = brain?.candidateRules || [];
        const checklistText = formatBrainChecklistsForPrompt(brain?.checklists);

        const brainContext = brain ? `
══ 策略大腦（累積知識庫）══
${userRules.length > 0 ? `✅ 已驗證規則（用戶確認）：
${formatBrainRulesForValidationPrompt(userRules, { limit: 8 })}

` : ""}🤖 核心規則（AI/系統整理）：
${formatBrainRulesForValidationPrompt(aiRules, { limit: 10 })}

🧪 候選規則（需持續驗證）：
${formatBrainRulesForValidationPrompt(candidateRules, { limit: 6 })}

📋 決策檢查表：
${checklistText}

⚠️ 今日任務不是盲目沿用規則，而是先驗證這些規則今天是否仍成立；只有當現有規則無法解釋今日表現時，才新增少量候選規則。
⚠️ 注意：AI 建議規則可能存在確認偏差，不要因為「策略大腦這樣說」就不加質疑地套用。
⚠️ 驗證規則時，要盡量對照過往台股相似案例；若結果失準，需分清楚是規則失準，還是個股 / 流動性 / 市場節奏差異。

歷史教訓：
${(brain.lessons||[]).slice(-10).map(l=>`- [${l.date}] ${l.text}`).join("\n")}

勝率統計：${brain.stats?.hitRate||"尚無"}
常犯錯誤：${(brain.commonMistakes||[]).join("、")||"尚無"}
${coachContext}
══════════════════════════` : "";

        // 反轉追蹤上下文
        const revContext = losers.length > 0 ? `
反轉追蹤持股：
${losers.map(h=>{
  const rc = (reversalConditions||{})[h.code];
  return `${h.name}(${h.code}) ${getHoldingReturnPct(h).toFixed(2)}% | 反轉條件：${rc?.signal||"未設定"} | 停損：${rc?.stopLoss||"未設定"}`;
}).join("\n")}` : "";

        // ── Phase 2: 盲測預測（不含今日漲跌） ──
        setAnalyzeStep("盲測預測中（不含今日漲跌）...");
        const blindHoldingSummary = dailyDossiers.length > 0
          ? dailyDossiers.map(dossier => {
            const change = changes.find(item => item.code === dossier.code);
            return buildDailyHoldingDossierContext(dossier, change, { blind: true });
          }).join("\n\n")
          : "目前沒有持股 dossier。";

        let blindPredictions = [];
        try {
          const blindRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemPrompt: `你是台股策略分析師。以下是持股 dossier（不含今日價格變動）。
請基於 thesis、催化劑、事件時程、財報趨勢，對每檔持股做出今日方向預判。
這是盲測——你看不到今日漲跌，必須純粹基於基本面和事件邏輯做判斷。

用 JSON 格式輸出，不要其他文字：
\`\`\`json
[{"code":"股票代號","name":"股票名稱","direction":"up/down/flat","confidence":1到10,"reason":"一句話判斷依據","risk":"一句話最大風險"}]
\`\`\``,
              userPrompt: `今日日期：${today}
${notesContext}
${brainContext}

持倉 dossier（盲測模式，不含今日漲跌）：
${blindHoldingSummary}

待觀察事件：
${eventSummary}

請對每檔持股預測今日方向。注意：你看不到今日實際漲跌，必須基於已有資訊做出判斷。`
            })
          });
          const blindData = await blindRes.json();
          const blindText = blindData.content?.[0]?.text || "";
          const jsonMatch = blindText.match(/```json\s*([\s\S]*?)```/) || blindText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (Array.isArray(parsed)) blindPredictions = parsed;
          }
        } catch (blindErr) {
          console.warn("盲測預測失敗（不影響主分析）:", blindErr);
        }

        // ── 前次分析回顧 ──
        const prevReport = (analysisHistory || [])[0];
        const prevReviewBlock = prevReport ? (() => {
          const prevPreds = prevReport.blindPredictions || [];
          const prevScores = prevReport.predictionScores;
          if (prevPreds.length === 0) return "";
          const accuracy = prevScores?.accuracy != null ? `${Math.round(prevScores.accuracy * 100)}%` : "N/A";
          const worstMiss = prevScores?.details?.reduce((worst, d) =>
            (d && Math.abs(d.error || 0) > Math.abs(worst?.error || 0)) ? d : worst, null);
          const worstLine = worstMiss ? `${worstMiss.name} 預測${worstMiss.predicted}，實際${worstMiss.actual}` : "N/A";
          return `\n═══ 前次分析回顧 ═══
上次分析：${prevReport.date}
上次盲測準確率：${accuracy}
上次最大失誤：${worstLine}
請先用 1 句話反思近期預測表現，再開始分析。如果準確率低於 60%，請降低建議的激進程度。\n`;
        })() : "";

        // ── 盲測結果注入 ──
        const blindPredBlock = blindPredictions.length > 0 ? `
═══ 你的盲測預測（已鎖定，不可修改）═══
${JSON.stringify(blindPredictions, null, 0)}

═══ 分析指引 ═══
請先用 2-3 句話對比你的盲測預測與下方的實際結果：哪些預測正確？哪些錯了？錯的原因是什麼？
預測錯誤的股票需要特別深入檢討，不要用「短期波動」帶過。
` : "";

        setAnalyzeStep("AI 策略分析中（約15-30秒）...");
        const aiRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: `你是一位專業的台股策略分析師，也是用戶的長期策略顧問。
你擁有用戶過去所有分析的記憶（策略大腦），必須基於累積的教訓和規則來給出建議。
用戶是積極型事件驅動交易者，持有股票+權證+ETF，橫跨多個產業。

⚠️ 核心原則：不同類型持股必須用不同策略框架分析，禁止一套邏輯套用全部。

【權證策略框架】
- Delta 最佳區間 0.4-0.7，低於 0.3 考慮換約至價平附近
- 到期前 30 天 Theta 加速衰減 → 提前 40 天評估滾動換約
- 隱含波動率(IV)偏高時不追買，等 IV 回落再進場
- 出場紀律：到達目標價分批出 1/2 → 1/4，剩餘部位設追蹤停利
- 標的股漲但權證沒跟 → 檢查造市商報價、IV crush

【成長股策略框架】（如：台達電、奇鋐、創意、昇達科）
- PEG < 1.5 為合理，> 2 偏貴需等待回檔
- 營收月增率連續 3 個月正成長為多頭確認
- 三大法人連續買超天數、外資持股比例變化
- 催化劑時程：法說會前 2 週佈局、新品認證消息追蹤
- 技術面：站穩月線+季線多排=持有，跌破季線=減碼警戒

【景氣循環股策略框架】（如：華通PCB、台燿CCL、長興化學、力積電）
- 國發會景氣對策信號：藍燈(谷底佈局)→綠燈(持有)→紅燈(減碼)
- 庫存循環：去庫存末期=買點，補庫存初期=加碼，庫存回升=警戒
- ASP 趨勢：報價連續上漲=正面，跌價收斂=觀望
- 產能利用率 >80% 搭配漲價=景氣好轉訊號
- 股價淨值比(PBR)在歷史低檔區=長線佈局機會

【事件驅動策略框架】（如：法說會、財報、政策）
- 事件前 1-2 週佈局，事件後 1-3 日觀察市場反應
- 預期差分析：市場共識 vs 實際結果，超預期=續抱，低於預期=出場
- 買在謠言/賣在事實：利多兌現後股價不漲=出場訊號
- 政策受惠股注意時效性，通常 1-2 週為反應期

【ETF/指數策略框架】（如：滬深300正2）
- 總經面向：央行政策方向、PMI趨勢、匯率走勢
- 槓桿 ETF 波動耗損：持有超過 2 週需計算實際追蹤偏差
- RSI >70 超買減碼、RSI <30 超賣可佈局
- 停損紀律：正2型 ETF 虧損 >15% 必須檢討是否該停損

【防禦/停損觀察】（虧損>10%的持股）
- 原始進場邏輯是否還成立？基本面有無惡化？
- 季線/半年線是否已跌破？成交量是否萎縮見底？
- 停損原則：跌破進場邏輯=停損，邏輯仍在但技術弱=減碼不清
- 攤平條件：僅限基本面未變+技術面出現止跌訊號

【反面論證原則（每檔必做）】
對每一檔持股，你必須完成以下反面論證，否則分析不合格：
1. 提出一個「現在應該賣出」的最強理由（不能說「暫無」）
2. 如果 thesis 在 30 天內被證偽，最可能的原因是什麼？
3. 對於獲利股：這波漲勢可能已經結束的具體訊號是什麼？
4. 對於虧損股：thesis 可能已經失效的具體證據是什麼？

【禁止用語清單】
以下用語代表分析偷懶，禁止使用：
- 「短期震盪不改長期趨勢」→ 必須說明判斷長期趨勢不變的具體依據
- 「逢低布局」→ 必須給出具體價位和數量
- 「持續觀察」→ 必須說觀察什麼指標，到什麼日期，達到什麼數值要行動
- 「基本面不變」→ 必須具體說哪些指標沒變，以及多久沒更新了
- 「中長期看好」→ 必須給出目標價和預計到達時間

【量化要求】
所有操作建議必須包含具體數字：
- 「加碼」→ 在什麼價位、加多少張
- 「減碼」→ 在什麼價位、減多少張
- 「停損」→ 停損價位和最大虧損金額
- 「觀望」→ 觀望條件 + 最長等待期（N 個交易日）
- 「目標價」→ 到達時間預估
- 每個操作建議附帶：「如果我錯了，最可能的原因是什麼？」

【策略大腦驗證原則】
- 今天先驗證既有核心規則與候選規則，再考慮新增規則。
- 若現有規則已足以解釋今日表現，就不要硬新增 candidate rule。
- 若資料新鮮度是 stale 或 missing，只能降級信心或標成待更新，不可硬驗證成有效。
- 若同一條舊規則今天被證偽，要明確寫進失效或待更新清單。
- 驗證每條規則時，至少檢查四類台股訊號：月營收節奏、法說/財報/事件窗口、目標價/公開報告 freshness、族群/題材輪動位置。
- 若缺少 fresh 的月營收 / 財報 / 法說 / 報告支撐，預設先進 staleRules，而不是直接 validated 或 invalidated。
- 若股價表現只是受族群輪動或大盤風險偏好驅動，需標示 differenceType=market_regime 或 stock_specific，不可直接當成規則被驗證。
- 驗證規則時，至少要用 1-2 個「過往台股相似案例 / 相似節奏」來交叉比對；先比驅動因子，再比漲法。
- 若歷史案例失準，要明確區分是「個股特性差異 / 市場節奏不同 / 流動性不同」，還是規則本身判斷失準。
- 若只是個股情境不同，不要直接刪規則；請改寫適用條件、marketRegime、catalystWindow 或 invalidationSignals。

請用繁體中文，以精準簡潔的風格分析今日收盤表現。格式：

## 今日總結
（一句話概括）

## 📊 個股策略分析
（按照上述分類，逐一分析每檔持股的策略狀態。特別標注需要行動的個股）

## 🔥 事件連動分析
（哪些股價變動與待觀察事件有關聯？邏輯是什麼？）

## ⚠️ 風險與停損追蹤
（虧損持股評估、權證時間價值風險、整體投組風險）

## ⚔️ 反面論證
（對每檔持股，提出最強的賣出理由。如果你提不出有力的反面論證，代表你的分析不夠深入，而不是代表這檔股票完美無缺。）

## 🎯 明日觀察與操作建議
（明天盤中關注重點 + 具體買賣建議或等待條件。每個建議必須附帶「如果我錯了」的原因。）

## 🧠 策略進化建議
（基於今日表現，策略大腦應該新增或修改什麼規則？）

## 📋 EVENT_ASSESSMENTS
最後，針對每一個待觀察事件輸出結構化評估。必須用以下 JSON 格式，用 \`\`\`json 包裹：
\`\`\`json
[{"eventId":"事件ID（原樣回傳）","title":"事件標題","todayImpact":"positive/negative/neutral/none","confidence":0.0到1.0,"note":"一句話說明今日與此事件的關聯","suggestClose":true或false,"suggestCloseReason":"若建議結案，說明原因"}]
\`\`\`
- todayImpact: positive=今日股價走勢符合事件預期, negative=相反, neutral=無明顯影響, none=無關
- confidence: 你對此評估的信心度(0-1)
- suggestClose: 是否建議結案（事件已充分反映或已失效）

## 🧬 BRAIN_UPDATE
最後，根據今日分析結果更新策略大腦。用 \`\`\`json 包裹，結構：
\`\`\`json
{"validatedRules":[{"id":"規則ID或空字串","text":"今天仍成立的舊規則","reason":"為何成立","confidence":0到100,"lastValidatedAt":"日期","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"staleRules":[{"id":"規則ID或空字串","text":"需要降級或待更新的規則","reason":"資料過期或證據不足","confidence":0到100,"staleness":"aging/stale","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"invalidatedRules":[{"id":"規則ID或空字串","text":"今天被證偽的規則","reason":"為何失效","confidence":0到100,"nextStatus":"candidate/archived","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"rules":[{"text":"更新後仍保留的核心規則","when":"適用情境","action":"建議動作","scope":"適用標的或情境","appliesTo":["成長股/景氣股/事件股/權證/ETF"],"marketRegime":"規則適用的台股市況或輪動節奏","catalystWindow":"月營收/法說/財報/事件窗口","contextRequired":["規則成立前必須滿足的前提"],"invalidationSignals":["哪些訊號出現就代表規則該降級或失效"],"historicalAnalogs":[{"code":"歷史相似個股代碼","name":"股票名","period":"當時的年份/區間","thesis":"為何相似","verdict":"supported/mixed/contradicted","differenceType":"none/stock_specific/market_regime/timing/liquidity/rule_miss","note":"若失準，說明是個股差異還是規則失準"}],"confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"新增或保留待驗證規則","when":"待驗證情境","action":"若成立要做什麼","appliesTo":["適用類型"],"marketRegime":"預計適用的台股市況","catalystWindow":"預計驗證窗口","contextRequired":["前提"],"invalidationSignals":["失敗訊號"],"historicalAnalogs":[{"code":"歷史相似個股代碼","name":"股票名","period":"當時年份/區間","thesis":"為何相似","verdict":"supported/mixed/contradicted","differenceType":"none/stock_specific/market_regime/timing/liquidity/rule_miss","note":"補充"}],"confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1"...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"今日日期","evolution":"這次更新一句話摘要"}
\`\`\`
- validatedRules：先列出今天被支持的舊規則，最多6條
- staleRules：列出今天證據不足、資料過期或需降級的規則，最多6條
- invalidatedRules：列出今天被證偽的規則，最多6條
- 既有核心規則與既有 candidate rule 都必須至少落入 validatedRules / staleRules / invalidatedRules 其中一個，不能遺漏
- rules：這是「今天驗證後」仍保留的核心規則，最多12條
- candidateRules：只有現有規則無法解釋時，才新增少量候選規則，最多6條
- validationScore：0-100，反映規則目前被支持的強度
- staleness：標註規則是否新鮮、待更新、陳舊或尚未驗證
- evidenceRefs：盡量附上 1-3 個證據來源，優先引用本 App 已有的 analysis / research / events / targets / fundamentals
- historicalAnalogs：每條重要規則盡量附 1-2 個過往台股相似案例；若失準，必須標 differenceType，區分個股差異還是規則失準
- marketRegime / catalystWindow / appliesTo：請把規則的台股適用情境寫清楚，避免把不同節奏硬套成同一條規則
- checklists：把最重要的規則整理成進場前 / 加碼前 / 出場前檢查表
- lessons：保留舊的+加入今日新教訓（只加有意義的）
- commonMistakes：反覆出現的錯誤模式
- stats：更新勝率統計`,
            userPrompt: `今日日期：${today}
${prevReviewBlock}${blindPredBlock}
═══ 今日實際表現 ═══
今日持倉損益：${totalTodayPnl >= 0 ? "+" : ""}${totalTodayPnl.toLocaleString()} 元
${marketContext}${notesContext}
${brainContext}
${revContext}

持倉 dossier（請把這份整合資料當成主要判斷依據；它已經包含持倉、thesis、目標價、事件、研究摘要、策略大腦線索）：
${holdingSummary}

產業集中度警告：AI/伺服器佔5檔(台達電/奇鋐/緯創/晟銘電/創意)、光通訊3檔、PCB材料3檔 — 需評估集中風險

異常波動（>3%）：${anomalySummary}

待觀察事件：
${eventSummary}

請分析今日收盤表現，事件連動，並給出策略建議。
特別注意：
1. ${blindPredictions.length > 0 ? "先對比盲測預測與實際結果，分析預測正確和錯誤的原因。" : "每檔股票都先讀 dossier 的 thesis / 目標價 / 事件 / 研究摘要 / brainContext，再結合今日漲跌，不要只看漲跌幅。"}
2. 每檔股票必須標注適合的持有週期（短/中/長期）和對應策略。
3. 如果 dossier 的資料新鮮度是 stale 或 missing，要直接指出不確定性，不要假裝有最新財報或最新投顧數字。
4. 指出產業重複風險和建議調整方向。
5. 區分龍頭股（核心持有）vs 衛星/戰術配置的不同操作建議。
6. 特別注意策略大腦中的歷史教訓。
7. 在 BRAIN_UPDATE 段落中，先驗證舊規則，再決定是否新增少量候選規則。
8. 所有操作建議必須帶具體數字（價位、張數、時間），禁止空泛描述。

預測命中率：${(() => { const NE = newsEvents || NEWS_EVENTS; const pe = NE.filter(isClosedEvent); const h2 = pe.filter(e => e.correct === true).length; const t2 = pe.filter(e => e.correct !== null).length; return `${h2}/${t2}`; })()}`
          })
        });
        const aiData = await aiRes.json();
        if (!aiRes.ok) {
          throw new Error(aiData?.detail || aiData?.error || `AI 分析失敗 (${aiRes.status})`);
        }
        const rawInsight = aiData.content?.[0]?.text || null;
        if (!rawInsight) {
          aiError = "AI 有回應，但沒有產出可顯示的文字內容";
        } else {
          let displayText = rawInsight;

          // 提取結構化事件評估 JSON
          const eventMatch = displayText.match(/## 📋 EVENT_ASSESSMENTS[\s\S]*?```json\s*([\s\S]*?)```/);
          if (eventMatch) {
            try {
              const assessments = JSON.parse(eventMatch[1].trim());
              if (Array.isArray(assessments)) eventAssessments = assessments;
            } catch (parseErr) { console.warn("事件評估 JSON 解析失敗:", parseErr); }
          }

          // 提取策略大腦更新 JSON（合併呼叫：分析+大腦進化一次完成）
          const brainMatch = displayText.match(/## 🧬 BRAIN_UPDATE[\s\S]*?```json\s*([\s\S]*?)```/);
          if (brainMatch) {
            try {
              const brainJson = JSON.parse(brainMatch[1].trim());
              if (brainJson && typeof brainJson === "object" && brainJson.rules) {
                brainAudit = ensureBrainAuditCoverage(brainJson, strategyBrain);
                brainAudit = enforceTaiwanHardGatesOnBrainAudit(brainAudit, strategyBrain, {
                  dossiers: analysisDossiers,
                  defaultLastValidatedAt: today,
                });
                const newBrain = mergeBrainWithAuditLifecycle(brainJson, strategyBrain, brainAudit);
                finalBrainForValidation = newBrain;
                setStrategyBrain(newBrain);
                brainUpdatedInline = true;
              }
            } catch (parseErr) { console.warn("大腦更新 JSON 解析失敗:", parseErr); }
          }

          // 移除 JSON 段落，只顯示人類可讀的分析
          aiInsight = displayText
            .replace(/## 📋 EVENT_ASSESSMENTS[\s\S]*?```[\s\S]*?```/g, "")
            .replace(/## 🧬 BRAIN_UPDATE[\s\S]*?```[\s\S]*?```/g, "")
            .trim();
        }
      } catch (e) {
        console.error("AI 分析失敗:", e);
        aiError = e?.message || "AI 分析失敗";
      }

      // 7. 計算盲測評分
      const predictionScores = blindPredictions.length > 0 ? (() => {
        const details = blindPredictions.map(pred => {
          const actual = changes.find(c => c.code === pred.code);
          if (!actual) return null;
          const actualDir = actual.changePct > 0.5 ? "up" : actual.changePct < -0.5 ? "down" : "flat";
          const predicted = pred.direction;
          const correct = predicted === actualDir;
          const dirScore = correct ? 1 : (predicted === "flat" && Math.abs(actual.changePct) > 1) ? -0.5 : predicted !== actualDir ? -1 : 0;
          return {
            code: pred.code, name: pred.name || actual.name,
            predicted, actual: actualDir, actualPct: actual.changePct,
            confidence: pred.confidence || 5, correct, dirScore,
            error: Math.abs(actual.changePct),
          };
        }).filter(Boolean);
        const correctCount = details.filter(d => d.correct).length;
        const accuracy = details.length > 0 ? correctCount / details.length : null;
        const weightedScore = details.reduce((sum, d) => sum + d.dirScore * (d.confidence / 10), 0);
        return { details, accuracy, correctCount, total: details.length, weightedScore };
      })() : null;

      // 8. 組裝報告
      const report = {
        id: Date.now(),
        date: today,
        time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
        totalTodayPnl,
        changes,
        anomalies,
        eventCorrelations,
        needsReview,
        aiInsight,
        aiError,
        eventAssessments,
        blindPredictions,
        predictionScores,
        brainAudit,
      };

      setDailyReport(normalizeDailyReportEntry(report));
      setAnalysisHistory(prev => normalizeAnalysisHistoryEntries([report, ...(prev || [])]));

      // 同步分析報告到雲端（不管大腦進化成不成功都要存）
      if (canUseCloud) {
        fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save-analysis", data: report })
        }).catch(() => {});
      }

      // 8. 策略大腦進化 — 已合併到主要 AI 呼叫（BRAIN_UPDATE 段）
      //    如果合併呼叫成功提取了 brain JSON，則跳過額外 API call
      if (aiInsight && !brainUpdatedInline) {
        setAnalyzeStep("策略大腦進化中（fallback）...");
        try {
          const NE2 = newsEvents || NEWS_EVENTS;
          const pastEvents = NE2.filter(isClosedEvent);
          const hits2 = pastEvents.filter(e => e.correct === true).length;
          const total2 = pastEvents.filter(e => e.correct !== null).length;

          const brainRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemPrompt: `你是策略知識庫管理器。根據今日分析結果，更新策略大腦。
回傳**純JSON**格式（不要markdown code block），結構：
{"validatedRules":[{"id":"規則ID或空字串","text":"今天仍成立的舊規則","reason":"為何成立","confidence":0到100,"lastValidatedAt":"日期","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"staleRules":[{"id":"規則ID或空字串","text":"需要降級或待更新的規則","reason":"資料過期或證據不足","confidence":0到100,"staleness":"aging/stale","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"invalidatedRules":[{"id":"規則ID或空字串","text":"今天被證偽的規則","reason":"為何失效","confidence":0到100,"nextStatus":"candidate/archived","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"rules":[{"text":"更新後仍保留的核心規則","when":"適用情境","action":"建議動作","scope":"適用範圍","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"待驗證規則","when":"情境","action":"動作","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1",...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","evolution":"一句話摘要"}

規則：先驗證舊規則，再決定是否保留
validatedRules：今天被支持的舊規則
staleRules：證據不足、資料過期或需降級的規則
invalidatedRules：今天被證偽的規則
candidateRules：只有現有規則不夠覆蓋時，才新增少量假設
既有核心規則與既有 candidate rule 都必須至少落入 validatedRules / staleRules / invalidatedRules 其中一個
驗證時至少檢查：月營收節奏、法說/財報/事件窗口、目標價/公開報告 freshness、族群/題材輪動位置；缺 fresh 證據時優先進 staleRules
checklists：把規則整理成進場前 / 加碼前 / 出場前檢查表
教訓：今日新增的具體教訓（只加新的，保留舊的）
常犯錯誤：反覆出現的錯誤模式
每條重要規則請額外補：
- appliesTo：適用類型
- marketRegime：適用的台股市況 / 輪動節奏
- catalystWindow：適用的月營收 / 財報 / 法說 / 事件窗口
- contextRequired：規則成立前提
- invalidationSignals：哪些訊號代表規則失效
- historicalAnalogs：1-2 個過往台股相似案例，若失準需在 note 中說明是規則失準還是個股 / 流動性 / 市況差異`,
              userPrompt: `今日分析：
${aiInsight}

現有策略大腦：
${JSON.stringify(strategyBrain || { rules: [], lessons: [], commonMistakes: [], stats: {} })}

預測命中率：${hits2}/${total2}
今日損益：${totalTodayPnl >= 0 ? "+" : ""}${totalTodayPnl.toLocaleString()} 元

請更新策略大腦，保留有效的舊規則，加入今日新教訓。`
            })
          });
          const brainData = await brainRes.json();
          const brainText = brainData.content?.[0]?.text || "";
          const cleanBrain = brainText.replace(/```json|```/g, "").trim();
          const rawBrain = JSON.parse(cleanBrain);
          brainAudit = ensureBrainAuditCoverage(rawBrain, strategyBrain);
          brainAudit = enforceTaiwanHardGatesOnBrainAudit(brainAudit, strategyBrain, {
            dossiers: analysisDossiers,
            defaultLastValidatedAt: today,
          });
          const newBrain = mergeBrainWithAuditLifecycle(rawBrain, strategyBrain, brainAudit);
          finalBrainForValidation = newBrain;
          setStrategyBrain(newBrain);
          setDailyReport(prev => prev ? normalizeDailyReportEntry({ ...prev, brainAudit }) : prev);
        } catch (e) {
          console.error("策略大腦更新失敗（fallback）:", e);
        }
      }

      if (analysisDossiers.length > 0 && finalBrainForValidation) {
        setBrainValidation(prev => appendBrainValidationCases(prev, {
          portfolioId: activePortfolioId,
          sourceType: "dailyAnalysis",
          sourceRefId: String(report.id),
          dossiers: analysisDossiers,
          brain: finalBrainForValidation,
          brainAudit,
          capturedAt: `${report.date} ${report.time}`,
        }));
      }

      // 同步更新持倉價格
      setHoldings(prev => normalizeHoldings((prev || []).map(h => {
        const pm = priceMap[h.code];
        if (!pm) return h;
        const newValue = Math.round(pm.price * h.qty);
        const newPnl = Math.round((pm.price - h.cost) * h.qty);
        const newPct = Math.round((pm.price / h.cost - 1) * 10000) / 100;
        return { ...h, price: pm.price, value: newValue, pnl: newPnl, pct: newPct };
      }), priceMap));

      setLastUpdate(new Date());
      if (reportRefreshMeta?.__daily?.date !== todayRefreshKey) {
        refreshAnalystReports({ silent: true, limit: Math.min(3, REPORT_REFRESH_DAILY_LIMIT) }).catch(err => {
          console.error("收盤分析後刷新公開報告失敗:", err);
        });
      }
    } catch (err) {
      console.error("收盤分析失敗:", err);
      setSaved("❌ 分析失敗");
      setTimeout(() => setSaved(""), 3000);
    }
    setAnalyzing(false);
    setAnalyzeStep("");
  };

  // ── 風險壓力測試 ─────────────────────────────────────────────────
  const [stressTesting, setStressTesting] = useState(false);
  const [stressResult, setStressResult] = useState(null);
  const runStressTest = async () => {
    if (stressTesting || analyzing) return;
    setStressTesting(true);
    setAnalyzeStep("風險壓力測試中...");
    try {
      const codes = H.map(h => h.code);
      const priceMap = await getMarketQuotesForCodes(codes);
      const changes = H.map(h => {
        const pm = priceMap[h.code];
        return {
          code: h.code, name: h.name, type: h.type,
          price: pm?.price || resolveHoldingPrice(h), cost: h.cost, qty: h.qty,
          totalPnl: pm ? Math.round((pm.price - h.cost) * h.qty) : getHoldingUnrealizedPnl(h),
          totalPct: pm ? Math.round(((pm.price / h.cost) - 1) * 10000) / 100 : getHoldingReturnPct(h),
        };
      });
      const dailyDossiers = changes.map(change => {
        const base = dossierByCode.get(change.code);
        if (!base) return null;
        return { ...base, position: { ...(base.position || {}), price: change.price, pnl: change.totalPnl, pct: change.totalPct } };
      }).filter(Boolean);
      const holdingSummary = dailyDossiers.map(dossier => {
        const change = changes.find(c => c.code === dossier.code);
        return buildDailyHoldingDossierContext(dossier, change);
      }).join("\n\n");
      const totalValue = changes.reduce((s, c) => s + Math.round(c.price * c.qty), 0);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `你是風險管理專家，你的唯一任務是找出每一檔持股的致命風險。

規則：
- 你不能說任何正面的事情。任何正面評論都代表你的分析不夠深入。
- 對每檔持股，假設它會在未來 30 天下跌 20%，列出最可能的 3 個原因
- 對每個 thesis，列出 3 個會讓它完全失效的情境
- 對每個催化劑，說明為什麼它可能不會發生或已被市場定價
- 計算整體組合在最壞情境下的最大虧損金額

格式：

## 🔴 逐股致命風險
（每檔持股的最大下行風險，假設未來 30 天跌 20% 的情境分析）

## 💀 Thesis 失效情境
（每個投資論文可能被完全推翻的 3 個情境）

## ⚡ 催化劑失效風險
（為什麼你期待的利多可能不會發生）

## 📉 最壞情境計算
（整體組合的最大虧損金額和比例）

## 🚨 最需要立即行動的 3 檔
（哪些持股的風險報酬比最差，應該優先處理）

你的分析必須讓持有者感到不安。如果看完後覺得安心，代表分析不夠深入。`,
          userPrompt: `持倉 dossier：\n${holdingSummary}\n\n目前組合總市值約 ${totalValue.toLocaleString()} 元\n\n請進行全面風險壓力測試。`
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "壓力測試無結果";
      setStressResult({ date: toSlashDate(), text, totalValue });
    } catch (err) {
      console.error("壓力測試失敗:", err);
      setStressResult({ date: toSlashDate(), text: "❌ 壓力測試失敗: " + (err?.message || ""), totalValue: 0 });
    }
    setStressTesting(false);
    setAnalyzeStep("");
  };

  // ── 事件復盤 ─────────────────────────────────────────────────────
  const submitReview = async (eventId) => {
    const NE = newsEvents || NEWS_EVENTS;
    const evt = NE.find(e => e.id === eventId);
    const submittedForm = { ...reviewForm };
    const wasCorrect = evt ? evt.pred === submittedForm.actual : null;
    const reviewDate = toSlashDate();
    const reviewRecordedAt = `${reviewDate} ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
    const baseReviewedEvent = evt
      ? normalizeEventRecord({
          ...evt,
          status: "closed",
          exitDate: submittedForm.exitDate || evt.exitDate || reviewDate,
          priceAtExit: submittedForm.priceAtExit || evt.priceAtExit || null,
          actual: submittedForm.actual,
          actualNote: submittedForm.actualNote,
          correct: wasCorrect,
          lessons: submittedForm.lessons,
          reviewDate,
        })
      : null;
    const reviewedStockOutcomes = baseReviewedEvent ? buildEventStockOutcomes(baseReviewedEvent) : [];
    const reviewedEvent = baseReviewedEvent ? normalizeEventRecord({
      ...baseReviewedEvent,
      stockOutcomes: reviewedStockOutcomes,
    }) : null;
    const reviewDossiers = reviewedEvent ? buildEventReviewDossiers(reviewedEvent, dossierByCode) : [];
    const reviewDossierContext = reviewDossiers.length > 0
      ? reviewDossiers.map(dossier => buildResearchHoldingDossierContext(dossier, { compact: true })).join("\n\n")
      : "無可用持股 dossier";
    const reviewEvidenceRefs = reviewedEvent ? buildEventReviewEvidenceRefs(reviewedEvent, reviewDate) : [];

    setNewsEvents(prev => {
      const arr = normalizeNewsEvents(prev || NEWS_EVENTS);
      const idx = arr.findIndex(e => e.id === eventId);
      if (idx < 0) return arr;
      arr[idx] = {
        ...arr[idx],
        status: "closed",
        exitDate: submittedForm.exitDate || arr[idx].exitDate || reviewDate,
        priceAtExit: submittedForm.priceAtExit || arr[idx].priceAtExit || null,
        actual: submittedForm.actual,
        actualNote: submittedForm.actualNote,
        correct: arr[idx].pred === submittedForm.actual,
        lessons: submittedForm.lessons,
        reviewDate,
        stockOutcomes: reviewedStockOutcomes,
      };
      return arr;
    });
    setReviewingEvent(null);
    const savedLessons = submittedForm.lessons;
    const savedNote = submittedForm.actualNote;
    setReviewForm(createDefaultReviewForm());
    setSaved("✅ 復盤已儲存，策略整合中...");

    if (evt && (savedLessons || savedNote)) {
      appendCoachLessonToOwnerBrain({ event: evt, note: savedNote, lesson: savedLessons }).catch(err => {
        console.error("同步 coachLessons 失敗:", err);
      });
    }

    // 將復盤心得整合進策略大腦（AI 驗證+歸納）
    if (evt && (savedLessons || savedNote)) {
      try {
        const currentBrain = normalizeStrategyBrain(strategyBrain, { allowEmpty: true });
        const notesContext = formatPortfolioNotesContext(portfolioNotes);
        const brainRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: `你是策略知識庫管理器。用戶剛完成一筆事件復盤，你要：
1. 評估用戶的覆盤心得是否合理（用戶不一定正確，需要糾正偏差）
2. 從這次復盤中提取可學習的策略教訓
3. 先驗證與本次事件 / 相關持股 dossier 有關的既有策略規則，判斷哪些被真實 outcome 支持、削弱或證偽
4. 更新策略大腦的規則和教訓

回傳**純JSON**格式（不要markdown code block），結構：
{"validatedRules":[{"id":"規則ID或空字串","text":"這次 outcome 仍支持的舊規則","reason":"為何成立","confidence":0到100,"lastValidatedAt":"日期","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"staleRules":[{"id":"規則ID或空字串","text":"這次復盤只能部分支持、證據不足或需降級的規則","reason":"為何只能先標記 stale","confidence":0到100,"staleness":"aging/stale","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"invalidatedRules":[{"id":"規則ID或空字串","text":"這次被真實 outcome 證偽的規則","reason":"為何失效","confidence":0到100,"nextStatus":"candidate/archived","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"rules":[{"text":"規則","when":"適用情境","action":"建議動作","scope":"適用範圍","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"待驗證規則","when":"情境","action":"動作","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":[...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","evolution":"一句話摘要","reviewFeedback":"給用戶的一句話反饋：覆盤是否合理？有什麼盲點？"}

另外，每條規則 / 候選規則盡量補上：
- appliesTo / marketRegime / catalystWindow
- contextRequired / invalidationSignals
- historicalAnalogs：1-2 個過往台股相似案例；若這次失準，說明是規則失準還是個股情境差異`,
            userPrompt: `事件：${evt.title}
${notesContext}
相關持股 dossier：
${reviewDossierContext}

預測：${evt.pred==="up"?"看漲":evt.pred==="down"?"看跌":"中性"} — ${evt.predReason}
實際走勢：${submittedForm.actual==="up"?"上漲":submittedForm.actual==="down"?"下跌":"中性"} — ${savedNote}
預測${wasCorrect?"正確":"錯誤"}
事件日期：${reviewedEvent?.eventDate || evt.date || "未填"}；結案日期：${reviewedEvent?.exitDate || reviewDate}
請優先用真實 outcome 驗證舊規則，再決定是否新增候選規則；只有與這次事件 / 相關持股 dossier 有關的既有核心規則與 candidate rule 才需要落入 validatedRules / staleRules / invalidatedRules。
驗證時至少檢查：月營收節奏、法說/財報/事件窗口、目標價/公開報告 freshness、族群/題材輪動位置；若缺 fresh 證據或事件資訊不足，優先進 staleRules，不要硬判 validated / invalidated。
若這次失準只是個股流動性、監管、時間差、資金面、題材輪動差異，請在 historicalAnalogs.note 與 reason 說清楚，不要直接把規則判死。
用戶覆盤心得：${savedLessons || "（未填）"}

現有策略大腦：
${JSON.stringify(currentBrain)}

請更新策略大腦，特別注意：用戶的覆盤不一定客觀，如果有歸因偏差請指出。`
          })
        });
        const brainData = await brainRes.json();
        const brainText = brainData.content?.[0]?.text || "";
        const cleanBrain = brainText.replace(/```json|```/g, "").trim();
        const rawBrain = JSON.parse(cleanBrain);
        const feedback = rawBrain.reviewFeedback;
        delete rawBrain.reviewFeedback;
        let reviewBrainAudit = ensureBrainAuditCoverage(rawBrain, currentBrain, { dossiers: reviewDossiers });
        reviewBrainAudit = attachEvidenceRefsToBrainAudit(reviewBrainAudit, reviewEvidenceRefs, {
          defaultLastValidatedAt: reviewedEvent?.exitDate || reviewDate,
        });
        reviewBrainAudit = enforceTaiwanHardGatesOnBrainAudit(reviewBrainAudit, currentBrain, {
          dossiers: reviewDossiers,
          defaultLastValidatedAt: reviewedEvent?.exitDate || reviewDate,
        });
        const newBrain = mergeBrainWithAuditLifecycle(rawBrain, currentBrain, reviewBrainAudit);
        setStrategyBrain(newBrain);
        if (reviewDossiers.length > 0) {
          setBrainValidation(prev => appendBrainValidationCases(prev, {
            portfolioId: activePortfolioId,
            sourceType: "eventReview",
            sourceRefId: String(eventId),
            dossiers: reviewDossiers,
            brain: newBrain,
            brainAudit: reviewBrainAudit,
            capturedAt: reviewRecordedAt,
            reviewEvent: reviewedEvent,
          }));
        }
        setSaved(feedback ? `🧠 ${feedback}` : "✅ 策略大腦已更新");
        setTimeout(() => setSaved(""), 6000);
      } catch (e) {
        console.error("復盤整合策略大腦失敗:", e);
        setSaved("✅ 復盤已儲存");
        setTimeout(() => setSaved(""), 2500);
      }
    } else {
      setTimeout(() => setSaved(""), 2500);
    }
  };

  // ── 大腦整理（遺忘/合併/淘汰過時教訓）─────────────────────────
  const [brainCleaning, setBrainCleaning] = useState(false);
  const cleanupBrain = async () => {
    if (brainCleaning || !strategyBrain) return;
    setBrainCleaning(true);
    try {
      const brain = strategyBrain;
      const lessonCount = (brain.lessons || []).length;
      const coachCount = (brain.coachLessons || []).length;
      const ruleCount = (brain.rules || []).length;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `你是策略知識庫整理器。用戶的策略大腦已累積大量規則和教訓，你要進行一次全面整理。

任務：
1. 規則（rules）：合併重複的規則，刪除矛盾的規則，保留最有效的。最多 12 條。
2. 候選規則（candidateRules）：整理仍值得追蹤但尚未完全證實的規則。最多 6 條。
3. 檢查表（checklists）：根據核心規則更新進場前 / 加碼前 / 出場前檢查表。
4. 教訓（lessons）：合併類似的教訓，淘汰超過 90 天且不再適用的教訓。保留最近 30 條。
5. 常犯錯誤（commonMistakes）：去重合併，保留仍然需要警惕的。最多 5 條。
6. 跨組合教練教訓（coachLessons）：超過 180 天的降級，只保留最近 50 條。
7. 產生一份「整理摘要」說明你做了什麼改動。

回傳**純JSON**格式：
{"rules":[{"text":"規則","when":"適用情境","action":"建議動作","scope":"適用範圍","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"待驗證規則","when":"情境","action":"動作","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"","text":""}],"commonMistakes":[...],"coachLessons":[原始格式保留],"stats":{保持原有},"lastUpdate":"今日日期","evolution":"一句話摘要","cleanupSummary":"整理摘要"}

額外要求：
- 保留真的有用的 historicalAnalogs，淘汰只會重複結論但沒有辨識度的案例
- 若規則失效只是因為 TWSE/TPEX、流動性、時序不同，優先改寫 appliesTo / marketRegime / catalystWindow，而不是直接刪規則`,
          userPrompt: `今日日期：${toSlashDate()}

目前策略大腦：
${JSON.stringify(brain)}

統計：
- ${ruleCount} 條規則
- ${lessonCount} 條教訓
- ${coachCount} 條跨組合教訓
- ${(brain.commonMistakes || []).length} 條常犯錯誤

請進行全面整理，重點淘汰過時的教訓，合併重複規則。`
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const cleanText = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanText);
      const summary = parsed.cleanupSummary || "整理完成";
      delete parsed.cleanupSummary;
      const newBrain = mergeBrainPreservingCoachLessons(parsed, brain);
      setStrategyBrain(newBrain);
      setSaved(`🧹 ${summary}`);
      setTimeout(() => setSaved(""), 6000);
    } catch (err) {
      console.error("大腦整理失敗:", err);
      setSaved("❌ 大腦整理失敗");
      setTimeout(() => setSaved(""), 3000);
    }
    setBrainCleaning(false);
  };

  // ── 新增事件 ─────────────────────────────────────────────────────
  const addEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date.trim()) return;
    const evt = normalizeEventRecord({
      id: Date.now(),
      date: newEvent.date,
      status: "pending",
      title: newEvent.title,
      detail: newEvent.detail,
      stocks: newEvent.stocks.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      pred: newEvent.pred,
      predReason: newEvent.predReason,
      eventDate: null,
      trackingStart: null,
      exitDate: null,
      priceAtEvent: null,
      priceAtExit: null,
      priceHistory: [],
      actual: null,
      actualNote: "",
      correct: null,
      lessons: "",
      reviewDate: null,
    });
    setNewsEvents(prev => normalizeNewsEvents([...(prev || NEWS_EVENTS), evt]));
    setNewEvent(createDefaultEventDraft());
    setShowAddEvent(false);
    setSaved("✅ 事件已新增");
    setTimeout(() => setSaved(""), 2500);
  };

  // ── 反轉條件更新 ─────────────────────────────────────────────────
  const updateReversal = (code, conditions) => {
    setReversalConditions(prev => ({
      ...(prev || {}),
      [code]: { ...conditions, updatedAt: new Date().toLocaleDateString("zh-TW") },
    }));
    setSaved("✅ 反轉條件已儲存");
    setTimeout(() => setSaved(""), 2500);
  };

  // ── 生成週報素材（供 Podcast / Claude.ai 使用）────────────────
  const generateWeeklyReport = () => {
    const today = new Date().toLocaleDateString("zh-TW");
    const NE = newsEvents || NEWS_EVENTS;
    const pastEvents = NE.filter(isClosedEvent);
    const pendingEvents = NE.filter(e => !isClosedEvent(e));
    const hits = pastEvents.filter(e => e.correct === true).length;
    const total = pastEvents.filter(e => e.correct !== null).length;

    // 持倉摘要
    const holdingLines = H.map(h =>
      `${h.name}(${h.code}) | 現價${resolveHoldingPrice(h)} | 成本${h.cost} | 損益${getHoldingUnrealizedPnl(h)>=0?"+":""}${Math.round(getHoldingUnrealizedPnl(h))}(${getHoldingReturnPct(h)>=0?"+":""}${(Math.round(getHoldingReturnPct(h) * 100) / 100)}%) | ${h.type}`
    ).join("\n");

    // 近期分析
    const recentAnalyses = (analysisHistory || []).slice(0, 7).map(r =>
      `【${r.date} ${r.time}】損益${r.totalTodayPnl>=0?"+":""}${r.totalTodayPnl}\n${r.aiInsight ? r.aiInsight.slice(0, 500) + (r.aiInsight.length > 500 ? "..." : "") : "（無 AI 分析）"}`
    ).join("\n\n---\n\n");

    // 事件預測紀錄
    const eventLines = pastEvents.map(e =>
      `[${e.correct?"✓準確":"✗失誤"}] ${e.date} ${e.title}\n  預測：${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} | 結果：${e.actualNote}`
    ).join("\n");

    const pendingLines = pendingEvents.map(e =>
      `[⏳] ${e.date} ${e.title}\n  預測：${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} | 理由：${e.predReason}`
    ).join("\n");

    // 策略大腦
    const brain = strategyBrain;
    const checklistSummary = brain ? [
      (brain.checklists?.preEntry || []).length > 0 ? `進場前：${brain.checklists.preEntry.join("；")}` : null,
      (brain.checklists?.preAdd || []).length > 0 ? `加碼前：${brain.checklists.preAdd.join("；")}` : null,
      (brain.checklists?.preExit || []).length > 0 ? `出場前：${brain.checklists.preExit.join("；")}` : null,
    ].filter(Boolean).join("\n") : "";
    const brainSection = brain ? `
## 策略大腦
核心規則：
${(brain.rules||[]).map((r,i)=>`${i+1}. ${brainRuleSummary(r, { includeMeta: true })}`).join("\n")}

候選規則：
${(brain.candidateRules||[]).length > 0 ? (brain.candidateRules||[]).map((r,i)=>`${i+1}. ${brainRuleSummary(r, { includeMeta: true })}`).join("\n") : "無"}

決策檢查表：
${checklistSummary || "無"}

常犯錯誤：${(brain.commonMistakes||[]).join("、")||"無"}
命中率：${brain.stats?.hitRate||"計算中"}
累計分析次數：${brain.stats?.totalAnalyses||0}

最近教訓：
${(brain.lessons||[]).slice(-5).map(l=>`- [${l.date}] ${l.text}`).join("\n")}` : "";

    const report = `# 持倉看板週報素材
生成日期：${today}
總成本：${totalCost.toLocaleString()} | 總市值：${totalVal.toLocaleString()} | 損益：${totalPnl>=0?"+":""}${totalPnl.toLocaleString()}（${retPct>=0?"+":""}${retPct.toFixed(2)}%）
持股數：${H.length} 檔 | 事件預測命中率：${total>0?Math.round(hits/total*100)+"%（"+hits+"/"+total+"）":"尚無數據"}

## 持倉明細
${holdingLines}

## 觀察股
${W.length > 0 ? W.map(w=>`${w.name}(${w.code}) | 現價${w.price} | 目標${w.target || "未設定"} | 狀態：${w.status || "觀察中"}`).join("\n") : "無"}

## 事件預測紀錄
已驗證（${pastEvents.length} 筆）：
${eventLines || "無"}

待處理（${pendingEvents.length} 筆）：
${pendingLines || "無"}
${brainSection}

## 近 7 日收盤分析
${recentAnalyses || "尚無分析紀錄"}

---
以上為持倉看板自動生成的週報素材，請根據這些數據撰寫 Podcast 腳本。`;

    return report;
  };

  const copyWeeklyReport = async () => {
    const report = generateWeeklyReport();
    try {
      await navigator.clipboard.writeText(report);
      setSaved("✅ 週報素材已複製到剪貼簿");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = report; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setSaved("✅ 週報素材已複製");
    }
    setTimeout(() => setSaved(""), 3000);
  };
  
  const upsertTargetReport = ({ code, firm, target, date }, { silent = false, markNew = true } = {}) => {
    const normalizedCode = String(code || "").trim();
    const normalizedFirm = String(firm || "").trim() || "手動輸入";
    const normalizedTarget = Number(target);
    if (!normalizedCode || !Number.isFinite(normalizedTarget) || normalizedTarget <= 0) return false;
    const reportDate = String(date || "").trim() || toSlashDate();
    setTargets(prev => {
      const existing = (prev || {})[normalizedCode] || { reports: [] };
      return {
        ...(prev || {}),
        [normalizedCode]: {
          reports: mergeTargetReports(existing.reports, [{ firm: normalizedFirm, target: normalizedTarget, date: reportDate }]),
          updatedAt: reportDate,
          isNew: markNew || Boolean(existing.isNew),
        },
      };
    });
    if (!silent) {
      setSaved("✅ 目標價已更新");
      setTimeout(() => setSaved(""), 2200);
    }
    return true;
  };
  
  const upsertFundamentalsEntry = (code, patch, { silent = false } = {}) => {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode || !patch || typeof patch !== "object") return false;
    let didPersist = false;
    setFundamentals(prev => {
      const existing = normalizeFundamentalsEntry(prev?.[normalizedCode]) || {};
      const merged = normalizeFundamentalsEntry({
        ...existing,
        ...patch,
        updatedAt: patch.updatedAt || existing.updatedAt || toSlashDate(),
      });
      if (!merged) return prev || {};
      didPersist = true;
      return {
        ...(prev || {}),
        [normalizedCode]: merged,
      };
    });
    if (didPersist && !silent) {
      setSaved("✅ 財報 / 營收資料已更新");
      setTimeout(() => setSaved(""), 2200);
    }
    return didPersist;
  };
  
  const applyStructuredResearchRefresh = (payload, { silent = false } = {}) => {
    if (!payload || typeof payload !== "object") return false;
    const code = String(payload.code || "").trim();
    if (!code) return false;
    let changed = false;
    if (payload.fundamentals && typeof payload.fundamentals === "object") {
      changed = upsertFundamentalsEntry(code, payload.fundamentals, { silent: true }) || changed;
    }
    const reports = Array.isArray(payload.targets?.reports) ? payload.targets.reports : [];
    reports.forEach(report => {
      changed = upsertTargetReport({ code, ...report }, { silent: true, markNew: true }) || changed;
    });
    if (changed && !silent) {
      setSaved("✅ 研究結果已同步回 dossier");
      setTimeout(() => setSaved(""), 2500);
    }
    return changed;
  };
  
  const enrichResearchToDossier = async (report, { silent = false } = {}) => {
    const code = String(report?.code || "").trim();
    if (!code || report?.mode !== "single") return false;
    const targetStock = H.find(item => item.code === code);
    if (!targetStock) return false;

    setEnrichingResearchCode(code);
    try {
      const reportText = (report.rounds || [])
        .map((round, index) => `## Round ${index + 1} ${round?.title || ""}\n${round?.content || ""}`)
        .join("\n\n");
      const dossier = dossierByCode.get(code) || null;
      const { response, data } = await fetchJsonWithTimeout("/api/research-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            code,
            name: report?.name || targetStock.name,
            date: report?.date || toSlashDate(),
            text: reportText,
          },
          stock: {
            code: targetStock.code,
            name: targetStock.name,
            price: targetStock.price,
            cost: targetStock.cost,
            qty: targetStock.qty,
          },
          dossier,
        }),
      }, 8500);
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `同步失敗 (${response.status})`);
      }
      const changed = applyStructuredResearchRefresh({ code, ...data }, { silent });
      if (!changed && !silent) {
        setSaved("ℹ️ 這份研究沒有抽到新的財報 / 目標價資料");
        setTimeout(() => setSaved(""), 2500);
      }
      return changed;
    } catch (err) {
      console.error("研究資料同步失敗:", err);
      if (!silent) {
        const detail = err?.name === "AbortError" ? "同步逾時，稍後再試" : (err?.message || "同步失敗");
        setSaved(`⚠️ ${detail}`);
        setTimeout(() => setSaved(""), 2800);
      }
      return false;
    } finally {
      setEnrichingResearchCode(current => (current === code ? null : current));
    }
  };
  
  const mergeAnalystReportBatch = (code, payload) => {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode || !payload || typeof payload !== "object") return false;
    const incomingItems = Array.isArray(payload.items) ? payload.items.map(normalizeAnalystReportItem).filter(Boolean) : [];
    setAnalystReports(prev => {
      const current = normalizeAnalystReportsStore(prev);
      const existing = current[normalizedCode] || { items: [], latestPublishedAt: null, latestTargetAt: null, lastCheckedAt: null };
      const mergedItems = mergeAnalystReportItems(existing.items, incomingItems);
      const latestPublishedAt = mergedItems[0]?.publishedAt || existing.latestPublishedAt || null;
      const latestTargetItem = mergedItems.find(item => Number.isFinite(item?.target));
      return {
        ...current,
        [normalizedCode]: {
          items: mergedItems,
          latestPublishedAt,
          latestTargetAt: latestTargetItem?.publishedAt || existing.latestTargetAt || null,
          lastCheckedAt: payload.fetchedAt || new Date().toISOString(),
        },
      };
    });
    incomingItems.filter(item => Number.isFinite(item?.target) && item.target > 0).forEach(item => {
      upsertTargetReport({
        code: normalizedCode,
        firm: item.firm || item.source || "公開報告",
        target: item.target,
        date: item.publishedAt || toSlashDate(),
      }, { silent: true, markNew: true });
    });
    return incomingItems.length > 0;
  };
  
  const refreshAnalystReports = useCallback(async ({ force = false, silent = false, limit = REPORT_REFRESH_DAILY_LIMIT } = {}) => {
    if (reportRefreshing) return false;
    const dailyMeta = reportRefreshMeta?.__daily || {};
    const processedCodes = new Set(Array.isArray(dailyMeta.processedCodes) ? dailyMeta.processedCodes : []);
    const candidates = reportRefreshCandidates
      .filter(item => force || (!item.checkedToday && !processedCodes.has(item.holding.code)))
      .slice(0, limit);

    if (candidates.length === 0) {
      if (!silent) {
        setSaved("ℹ️ 今日報告索引已是最新");
        setTimeout(() => setSaved(""), 2200);
      }
      return false;
    }

    setReportRefreshing(true);
    setReportRefreshStatus(`正在刷新公開報告索引（0/${candidates.length}）...`);
    let changedCodes = 0;
    const checkedCodes = [];
    try {
      for (let i = 0; i < candidates.length; i += 1) {
        const { holding } = candidates[i];
        setReportRefreshStatus(`正在刷新公開報告索引（${i + 1}/${candidates.length}）· ${holding.name}`);
        const existingItems = analystReports?.[holding.code]?.items || [];
        try {
          const { response, data } = await fetchJsonWithTimeout("/api/analyst-reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: holding.code,
              name: holding.name,
              knownHashes: existingItems.map(item => item.id || item.hash).filter(Boolean),
              maxItems: 6,
              maxExtract: REPORT_EXTRACT_MAX_ITEMS,
            }),
          }, 9000);
          if (!response.ok) {
            throw new Error(data?.detail || data?.error || `刷新失敗 (${response.status})`);
          }
          const changed = mergeAnalystReportBatch(holding.code, data);
          if (changed) changedCodes += 1;
          checkedCodes.push(holding.code);
          setReportRefreshMeta(prev => {
            const current = normalizeReportRefreshMeta(prev);
            const nextProcessed = Array.from(new Set([...(current.__daily?.processedCodes || []), holding.code])).slice(-20);
            return {
              ...current,
              __daily: {
                date: todayRefreshKey,
                processedCodes: nextProcessed,
                runCount: (current.__daily?.runCount || 0) + 1,
                lastRunAt: new Date().toISOString(),
              },
              [holding.code]: {
                lastCheckedAt: data?.fetchedAt || new Date().toISOString(),
                lastChangedAt: changed ? (data?.fetchedAt || new Date().toISOString()) : (current[holding.code]?.lastChangedAt || null),
                lastStatus: changed ? "updated" : "unchanged",
                lastMessage: changed ? `新增 ${data?.newCount || 0} 則公開報告` : "今日無新報告",
                lastHashes: Array.isArray(data?.items) ? data.items.map(item => item.id || item.hash).filter(Boolean) : [],
                checkedDate: todayRefreshKey,
              },
            };
          });
        } catch (err) {
          console.error(`公開報告刷新失敗 (${holding.code}):`, err);
          checkedCodes.push(holding.code);
          setReportRefreshMeta(prev => {
            const current = normalizeReportRefreshMeta(prev);
            const nextProcessed = Array.from(new Set([...(current.__daily?.processedCodes || []), holding.code])).slice(-20);
            return {
              ...current,
              __daily: {
                date: todayRefreshKey,
                processedCodes: nextProcessed,
                runCount: (current.__daily?.runCount || 0) + 1,
                lastRunAt: new Date().toISOString(),
              },
              [holding.code]: {
                lastCheckedAt: new Date().toISOString(),
                lastChangedAt: current[holding.code]?.lastChangedAt || null,
                lastStatus: "failed",
                lastMessage: err?.message || "刷新失敗",
                lastHashes: current[holding.code]?.lastHashes || [],
                checkedDate: todayRefreshKey,
              },
            };
          });
        }
      }

      if (!silent) {
        setSaved(changedCodes > 0
          ? `✅ 已刷新 ${checkedCodes.length} 檔公開報告索引（${changedCodes} 檔有新資料）`
          : `ℹ️ 已檢查 ${checkedCodes.length} 檔，今日沒有新的公開報告`);
        setTimeout(() => setSaved(""), 3200);
      }
      return changedCodes > 0;
    } finally {
      setReportRefreshing(false);
      setReportRefreshStatus("");
    }
  }, [
    reportRefreshing,
    reportRefreshMeta,
    reportRefreshCandidates,
    todayRefreshKey,
    analystReports,
    setReportRefreshing,
    setReportRefreshStatus,
    setAnalystReports,
    setReportRefreshMeta,
    upsertTargetReport,
    mergeAnalystReportBatch,
    REPORT_REFRESH_DAILY_LIMIT
  ]);
  
  const exportLocalBackup = () => {
    try {
      const storage = collectPortfolioBackupStorage();
      storage[PORTFOLIOS_KEY] = portfolios;
      storage[ACTIVE_PORTFOLIO_KEY] = activePortfolioId;
      storage[VIEW_MODE_KEY] = viewMode;
      storage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION;

      const liveSnapshot = {
        holdings,
        tradeLog,
        targets,
        fundamentals,
        watchlist,
        analystReports,
        reportRefreshMeta,
        holdingDossiers,
        newsEvents,
        analysisHistory,
        dailyReport,
        reversalConditions,
        strategyBrain,
        researchHistory,
        portfolioNotes,
      };

      for (const [alias, value] of Object.entries(liveSnapshot)) {
        const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias];
        if (!suffix || value === undefined) continue;
        storage[pfKey(activePortfolioId, suffix)] = value;
      }

      if (Object.keys(storage).length === 0) {
        setSaved("⚠️ 目前沒有可匯出的本機資料");
        setTimeout(() => setSaved(""), 3000);
        return;
      }
      downloadJson(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1,
        app: "portfolio-dashboard",
        exportedAt: new Date().toISOString(),
        origin: window.location.origin,
        storage,
      });
      setSaved("✅ 本機備份已匯出");
      setTimeout(() => setSaved(""), 3000);
    } catch (err) {
      console.error("匯出備份失敗:", err);
      setSaved("❌ 匯出失敗");
      setTimeout(() => setSaved(""), 3000);
    }
  };
  
  const importLocalBackup = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!confirm("匯入會覆蓋這個瀏覽器目前的本機資料；未包含在備份檔內的項目不會被改動。確定繼續？")) return;

    let nextPid = activePortfolioId;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const storage = normalizeBackupStorage(parsed);

      if (!storage || Object.keys(storage).length === 0) {
        throw new Error("備份檔內沒有可識別的資料");
      }

      const normalizedStorage = { ...storage };
      const importedPortfolios = buildPortfoliosFromStorage(normalizedStorage);
      for (const key of Object.keys(normalizedStorage)) {
        if (!key.endsWith("-holdings-v2")) continue;
        normalizedStorage[key] = normalizeHoldings(normalizedStorage[key], marketPriceCache?.prices);
      }
      normalizedStorage[PORTFOLIOS_KEY] = importedPortfolios;
      normalizedStorage[ACTIVE_PORTFOLIO_KEY] =
        typeof normalizedStorage[ACTIVE_PORTFOLIO_KEY] === "string" &&
        importedPortfolios.some(item => item.id === normalizedStorage[ACTIVE_PORTFOLIO_KEY])
          ? normalizedStorage[ACTIVE_PORTFOLIO_KEY]
          : OWNER_PORTFOLIO_ID;
      normalizedStorage[VIEW_MODE_KEY] = PORTFOLIO_VIEW_MODE;
      normalizedStorage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION;

      portfolioTransitionRef.current = {
        isHydrating: true,
        fromPid: activePortfolioId,
        toPid: normalizedStorage[ACTIVE_PORTFOLIO_KEY],
      };

      for (const [key, value] of Object.entries(normalizedStorage)) {
        await save(key, value);
      }

      const registry = await ensurePortfolioRegistry();
      nextPid = registry.activePortfolioId;
      const snapshot = await loadPortfolioSnapshot(nextPid);

      setPortfolios(registry.portfolios);
      setActivePortfolioId(nextPid);
      setViewMode(registry.viewMode);
      applyPortfolioSnapshot(snapshot);

      const cloudEnabled = registry.viewMode === PORTFOLIO_VIEW_MODE && nextPid === OWNER_PORTFOLIO_ID;
      cloudSyncStateRef.current = {
        enabled: cloudEnabled,
        syncedAt: cloudEnabled ? readSyncAt("pf-cloud-sync-at") : 0,
      };
      setCloudSync(cloudEnabled);

      setSaved(`✅ 已匯入 ${Object.keys(normalizedStorage).length} 項本機資料`);
      setTimeout(() => setSaved(""), 4000);
    } catch (err) {
      console.error("匯入備份失敗:", err);
      alert(`匯入失敗：${err.message || "JSON 格式不正確"}`);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: nextPid,
        toPid: nextPid,
      };
    }
  };
  
  // 收盤分析完全手動觸發，不自動執行

  // file
  const processFile = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImg(URL.createObjectURL(file));
    setParsed(null); setParseErr(null);
    setMemoStep(0); setMemoAns([]); setMemoIn("");
    imgTypeRef.current = file.type || "image/jpeg";
    const r = new FileReader();
    r.onload = e => setB64(e.target.result.split(",")[1]);
    r.readAsDataURL(file);
  };

  const parseShot = async () => {
    if (!b64) return;
    setParsing(true); setParseErr(null);
    try {
      const res = await fetch("/api/parse", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          systemPrompt: PARSE_PROMPT,
          base64: b64,
          mediaType: imgTypeRef.current,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "API 錯誤");
      const clean = (data.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
      if (!clean) throw new Error("AI 未回傳可解析的內容");
      setParsed(JSON.parse(clean));
    } catch (err) {
      console.error("parseShot error:", err);
      setParseErr(err.message || "解析失敗，請確認截圖清晰");
    }
    finally { setParsing(false); }
  };

  const submitMemo = () => {
    if (!parsed?.trades?.length) return;
    const t = parsed.trades[0];
    const qs = MEMO_Q[t.action]||MEMO_Q["買進"];
    const ans = [...memoAns, memoIn];
    setMemoIn("");
    if (memoStep < qs.length-1) { setMemoAns(ans); setMemoStep(memoStep+1); return; }

    const entry = {
      id:Date.now(),
      date:new Date().toLocaleDateString("zh-TW"),
      time:new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}),
      action:t.action, code:t.code, name:t.name, qty:t.qty, price:t.price,
      qa: qs.map((q,i)=>({q, a:ans[i]||""})),
    };
    setTradeLog(prev=>[entry,...(prev||[])]);

    setHoldings(prev => {
      try {
        return applyTradeEntryToHoldings(prev, t, marketPriceCache?.prices);
      } catch (err) {
        console.error("Holdings update failed:", err);
        return prev;
      }
    });

    setSaved("✅ 已儲存");
    setTimeout(()=>setSaved(""),2500);

      // 若截圖含目標價更新，則一併更新
    if (parsed.targetPriceUpdates?.length) {
      setTargets(prev => {
        const updated = {...(prev||{})};
        parsed.targetPriceUpdates.forEach(u => {
          const existing = updated[u.code] || {reports:[]};
          const already  = existing.reports.find(r=>r.firm===u.firm);
          const newReport = {firm:u.firm, target:u.target, date:u.date||new Date().toLocaleDateString("zh-TW")};
          const newReports = already
            ? existing.reports.map(r=>r.firm===u.firm ? newReport : r)
            : [...existing.reports, newReport];
          updated[u.code] = { reports:newReports, updatedAt:new Date().toLocaleDateString("zh-TW"), isNew:true };
        });
        return updated;
      });
    }

    setImg(null); setB64(null); setParsed(null);
    setMemoStep(0); setMemoAns([]); setMemoIn("");
    setTab("holdings");
  };

  const qs = parsed?.trades?.[0] ? (MEMO_Q[parsed.trades[0].action]||MEMO_Q["買進"]) : [];

  if (!ready) return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",
      alignItems:"center",justifyContent:"center",color:C.textMute,
      fontFamily:"sans-serif",fontSize:13}}>載入中...</div>
  );

  const runResearch = async (mode, targetStock) => {
    if (researching) return;
    setResearching(true);
    setResearchTarget(mode === "single" ? targetStock?.code : "EVOLVE");
    try {
      const stocks = mode === "single" && targetStock
        ? [targetStock]
        : H.map(h => ({ code:h.code, name:h.name, price:resolveHoldingPrice(h), cost:h.cost, pnl:getHoldingUnrealizedPnl(h), pct:getHoldingReturnPct(h), type:h.type }));
      const researchDossiers = stocks.map(stock => {
        const dossier = dossierByCode.get(stock.code);
        if (!dossier) return null;
        return {
          ...dossier,
          position: {
            ...(dossier.position || {}),
            price: stock.price,
            pnl: stock.pnl,
            pct: stock.pct,
            cost: stock.cost,
            type: stock.type || dossier.position?.type || "股票",
          },
        };
      }).filter(Boolean);
      const body = {
        stocks,
        holdings: H,
        holdingDossiers: researchDossiers,
        meta: STOCK_META,
        brain: strategyBrain,
        portfolioNotes,
        mode,
        persist: canUseCloud,
      };
      // evolve / portfolio 模式需要事件紀錄和分析歷史
      if (mode === "evolve" || mode === "portfolio") {
        body.events = (newsEvents || []).slice(0, 20);
        body.analysisHistory = (analysisHistory || []).slice(0, 10);
      }
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.results?.length > 0) {
        const result = data.results[0];
        setResearchResults(result);
        setResearchHistory(prev => [result, ...(prev||[])].slice(0, 30));
        if (mode === "single" && result.code) {
          enrichResearchToDossier(result, { silent: true })
            .then(changed => {
              if (changed) {
                setSaved("✅ 研究完成 · 已同步目標價 / 財報到持倉");
                setTimeout(() => setSaved(""), 3200);
              }
            })
            .catch(err => {
              console.error("背景同步研究資料失敗:", err);
            });
        }
        // evolve / portfolio 模式：自動更新策略大腦
        if ((mode === "evolve" || mode === "portfolio") && result.newBrain) {
          setStrategyBrain(mergeBrainPreservingCoachLessons(result.newBrain, strategyBrain));
          setSaved("✅ 系統進化完成 · 策略大腦已更新");
        } else {
          setSaved("✅ 研究完成");
        }
      } else {
        setSaved("⚠️ 研究無結果");
      }
    } catch (e) {
      console.error("AutoResearch failed:", e);
      setSaved("❌ 研究失敗");
    }
    setResearching(false);
    setTimeout(() => setSaved(""), 3000);
  };

  const TABS = [
    {k:"holdings", label:"持倉"},
    {k:"watchlist",label:"觀察股"},
    {k:"events",   label:`行事曆${urgentCount>0?" ·":""}`},
    {k:"news",     label:"事件分析"},
    {k:"daily",    label:analyzing?"分析中...":"收盤分析"},
    {k:"research", label:researching?"研究中...":"深度研究"},
    {k:"trade",    label:"上傳成交"},
    {k:"log",      label:"交易日誌"},
  ];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,
      fontFamily:"'Inter','Noto Sans TC',system-ui,sans-serif",paddingBottom:40}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        /* Global styles moved to a separate CSS file or a dedicated style component if needed */
      `}</style>

      <Header
        C={C}
        A={A}
        alpha={alpha}
        cloudSync={cloudSync}
        saved={saved}
        refreshPrices={refreshPrices}
        refreshing={refreshing}
        copyWeeklyReport={copyWeeklyReport}
        exportLocalBackup={exportLocalBackup}
        backupFileInputRef={backupFileInputRef}
        importLocalBackup={importLocalBackup}
        priceSyncStatusTone={priceSyncStatusTone}
        priceSyncStatusLabel={priceSyncStatusLabel}
        activePriceSyncAt={activePriceSyncAt}
        lastUpdate={lastUpdate}
        pc={pc}
        displayedTotalPnl={displayedTotalPnl}
        displayedRetPct={displayedRetPct}
        activePortfolioId={activePortfolioId}
        switchPortfolio={pm.switchPortfolio}
        ready={ready}
        portfolioSwitching={portfolioSwitching}
        portfolioSummaries={portfolioSummaries}
        createPortfolio={createPortfolio}
        viewMode={viewMode}
        exitOverview={exitOverview}
        openOverview={openOverview}
        showPortfolioManager={showPortfolioManager}
        setShowPortfolioManager={setShowPortfolioManager}
        renamePortfolio={renamePortfolio}
        deletePortfolio={deletePortfolio}
        OWNER_PORTFOLIO_ID={OWNER_PORTFOLIO_ID}
        overviewTotalValue={overviewTotalValue}
        portfolioNotes={portfolioNotes}
        setPortfolioNotes={setPortfolioNotes}
        PORTFOLIO_VIEW_MODE={PORTFOLIO_VIEW_MODE}
        OVERVIEW_VIEW_MODE={OVERVIEW_VIEW_MODE}
        urgentCount={urgentCount}
        todayAlertSummary={todayAlertSummary}
        TABS={TABS}
        tab={tab}
        setTab={setTab}
      />

      <div className="app-shell" style={{padding:"10px 14px"}}>

        {viewMode === OVERVIEW_VIEW_MODE && <>
          <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.blue, A.glow)}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{...lbl,color:C.blue,marginBottom:4}}>全部總覽</div>
                <div style={{fontSize:13,color:C.text,fontWeight:600}}>跨組合檢視目前持倉、重複部位與待處理事件</div>
                <div style={{fontSize:10,color:C.textMute,marginTop:4,lineHeight:1.7}}>
                  這裡只做彙總，不會修改任何組合資料。
                </div>
              </div>
              <button className="ui-btn" onClick={exitOverview} style={{
                background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                ...ghostBtn,
              }}>
                返回目前組合
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
              {[
                ["組合數", `${overviewPortfolios.length}`, C.textSec],
                ["總市值", Math.round(overviewTotalValue).toLocaleString(), C.blue],
                ["總損益", `${overviewTotalPnl >= 0 ? "+" : ""}${Math.round(overviewTotalPnl).toLocaleString()}`, pc(overviewTotalPnl)],
              ].map(([label, value, color]) => (
                <div key={label} className="ui-card" style={metricCard}>
                  <div style={{fontSize:9,color:C.textMute,letterSpacing:"0.08em"}}>{label}</div>
                  <div className="tn" style={{fontSize:14,fontWeight:600,color,marginTop:2}}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{...card,marginBottom:8}}>
            <div style={lbl}>組合摘要</div>
            <div style={{display:"grid",gap:8}}>
              {overviewPortfolios.map(portfolio => {
                const noteSummary = [portfolio.notes.riskProfile, portfolio.notes.preferences, portfolio.notes.customNotes]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={portfolio.id} style={{
                    background: portfolio.id === activePortfolioId ? C.subtleElev : C.subtle,
                    border:`1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
                    borderRadius:8,
                    padding:"10px 12px",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>
                          {portfolio.name}
                          {portfolio.id === OWNER_PORTFOLIO_ID && <span style={{fontSize:9,color:C.textMute,marginLeft:6}}>owner</span>}
                        </div>
                        <div style={{fontSize:10,color:C.textMute,marginTop:4}}>
                          {portfolio.holdingCount} 檔 · 待處理事件 {portfolio.pendingEvents.length} 件 · 報酬 {portfolio.retPct >= 0 ? "+" : ""}{portfolio.retPct.toFixed(1)}%
                        </div>
                        {noteSummary && (
                          <div style={{fontSize:10,color:C.textSec,marginTop:6,lineHeight:1.7}}>
                            {noteSummary}
                          </div>
                        )}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="tn" style={{fontSize:16,fontWeight:700,color:pc(portfolio.totalPnl)}}>
                          {portfolio.totalPnl >= 0 ? "+" : ""}{Math.round(portfolio.totalPnl).toLocaleString()}
                        </div>
                        <button className="ui-btn" onClick={() => switchPortfolio(portfolio.id)} style={{
                          marginTop:6,
                          background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                          ...ghostBtn,
                        }}>
                          打開這組
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{...card,marginBottom:8}}>
            <div style={lbl}>重複持股</div>
            {overviewDuplicateHoldings.length === 0 ? (
              <div style={{fontSize:11,color:C.textMute}}>目前沒有跨組合重複持有同一檔股票。</div>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {overviewDuplicateHoldings.map(item => (
                  <div key={item.code} style={{paddingBottom:8,borderBottom:`1px solid ${C.borderSub}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div>
                        <span style={{fontSize:12,color:C.text,fontWeight:600}}>{item.name}</span>
                        <span style={{fontSize:10,color:C.textMute,marginLeft:6}}>{item.code}</span>
                      </div>
                      <span className="tn" style={{fontSize:10,color:C.textSec}}>合計市值 {Math.round(item.totalValue).toLocaleString()}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      {item.portfolios.map(portfolio => (
                        <span key={`${item.code}-${portfolio.id}`} style={{
                          fontSize:9,padding:"2px 8px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:C.textSec,
                        }}>
                          {portfolio.name} · {portfolio.qty}股 · {portfolio.pnl >= 0 ? "+" : ""}{Math.round(portfolio.pnl)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={lbl}>待處理事項</div>
            {overviewPendingItems.length === 0 ? (
              <div style={{fontSize:11,color:C.textMute}}>目前所有組合都沒有待處理事件。</div>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {overviewPendingItems.slice(0, 16).map(item => (
                  <div key={`${item.portfolioId}-${item.id}`} style={{
                    background:C.subtle,
                    border:`1px solid ${C.border}`,
                    borderRadius:8,
                    padding:"10px 12px",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:11,color:C.text,fontWeight:600}}>{item.title}</div>
                        <div style={{fontSize:10,color:C.textMute,marginTop:4}}>
                          {item.portfolioName} · {item.date || "未排日期"} · 預測{item.pred === "up" ? "看漲" : item.pred === "down" ? "看跌" : "中性"}
                        </div>
                        {item.predReason && (
                          <div style={{fontSize:10,color:C.textSec,marginTop:6,lineHeight:1.7}}>{item.predReason}</div>
                        )}
                      </div>
                      <button className="ui-btn" onClick={() => switchPortfolio(item.portfolioId)} style={{
                        background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                        ...ghostBtn,
                      }}>
                        去處理
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>}

        {/* ══════════ HOLDINGS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="holdings" && <>
          <HoldingsPanel
            holdings={holdings}
            totalVal={totalVal}
            totalCost={totalCost}
            winners={winners}
            losers={losers}
            top5={top5}
            holdingsIntegrityIssues={holdingsIntegrityIssues}
            showReversal={showReversal}
            setShowReversal={setShowReversal}
            reversalConditions={reversalConditions}
            reviewingEvent={reviewingEvent}
            setReviewingEvent={setReviewingEvent}
            updateReversal={updateReversal}
            attentionCount={attentionCount}
            pendingCount={pendingCount}
            targetUpdateCount={targetUpdateCount}
            scanQuery={scanQuery}
            setScanQuery={setScanQuery}
            scanFilter={scanFilter}
            setScanFilter={setScanFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            expandedStock={expandedStock}
            setExpandedStock={setExpandedStock}
          >
            <HoldingsTable
              holdings={holdings}
              expandedStock={expandedStock}
              setExpandedStock={setExpandedStock}
              onUpdateTarget={updateTargetPrice}
              onUpdateAlert={updateAlert}
            />
          </HoldingsPanel>
        </>}

        {/* ══════════ WATCHLIST ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="watchlist" && <>
          <WatchlistPanel
            watchlistFocus={watchlistFocus}
            watchlistRows={watchlistRows}
            expandedStock={expandedStock}
            setExpandedStock={setExpandedStock}
            openWatchlistAddModal={openWatchlistAddModal}
            openWatchlistEditModal={openWatchlistEditModal}
            handleWatchlistDelete={handleWatchlistDelete}
            formatEventStockOutcomeLine={formatEventStockOutcomeLine}
          />
        </>}

        {/* ══════════ EVENTS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="events" && <>
          <EventsPanel
            showRelayPlan={showRelayPlan}
            relayPlanExpanded={relayPlanExpanded}
            setRelayPlanExpanded={setRelayPlanExpanded}
            filterType={filterType}
            setFilterType={setFilterType}
            filteredEvents={filteredEvents}
          />
        </>}

        {/* ══════════ DAILY ANALYSIS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="daily" && <>
          <DailyReportPanel
            dailyReport={dailyReport}
            analyzing={analyzing}
            analyzeStep={analyzeStep}
            stressResult={stressResult}
            stressTesting={stressTesting}
            dailyExpanded={dailyExpanded}
            setDailyExpanded={setDailyExpanded}
            runDailyAnalysis={runDailyAnalysis}
            runStressTest={runStressTest}
            closeStressResult={() => setStressResult(null)}
            newsEvents={newsEvents}
            setTab={setTab}
            setExpandedNews={setExpandedNews}
            expandedStock={expandedStock}
            setExpandedStock={setExpandedStock}
            strategyBrain={strategyBrain}
          />
        </>}

        {/* ══════════ RESEARCH ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="research" && <>
          <ResearchPanel
            holdings={holdings}
            researching={researching}
            researchTarget={researchTarget}
            reportRefreshing={reportRefreshing}
            reportRefreshStatus={reportRefreshStatus}
            dataRefreshRows={dataRefreshRows}
            researchResults={researchResults}
            researchHistory={researchHistory}
            enrichingResearchCode={enrichingResearchCode}
            STOCK_META={STOCK_META}
            IND_COLOR={IND_COLOR}
            onEvolve={() => runResearch("evolve")}
            onRefresh={() => refreshAnalystReports({ force: true })}
            onResearch={runResearch}
            onEnrich={enrichResearchToDossier}
            onSelectHistory={setResearchResults}
          />
        </>}

        {/* ══════════ UPLOAD ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="trade" && <>
          {!parsed && (
            <>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0])}}
                onClick={()=>document.getElementById("fi").click()}
                className="ui-card"
                style={{border:`1px dashed ${dragOver?C.borderStrong:C.border}`,
                  borderRadius:12,padding:"28px 16px",textAlign:"center",cursor:"pointer",
                  background:dragOver?C.subtleElev:C.card,marginBottom:12,transition:"all 0.2s"}}>
                <input id="fi" type="file" accept="image/*"
                  onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
                {img ? (
                  <><img src={img} alt="" style={{maxHeight:200,maxWidth:"100%",
                    borderRadius:8,objectFit:"contain",marginBottom:8}}/>
                  <div style={{fontSize:11,color:C.textMute}}>點擊更換截圖</div></>
                ) : (
                  <><div style={{fontSize:32,marginBottom:10,opacity:0.5}}>↑</div>
                  <div style={{fontSize:13,fontWeight:500,color:C.textSec}}>上傳已成交截圖</div>
                  <div style={{fontSize:11,color:C.textMute,marginTop:4}}>買進 · 賣出回報皆可</div></>
                )}
              </div>
              {img && (
                <button className="ui-btn" onClick={parseShot} disabled={parsing} style={{
                  width:"100%",padding:"13px",borderRadius:10,
                  background: parsing ? C.subtle : C.cardHover,
                  color: parsing ? C.textMute : C.text,
                  border: `1px solid ${parsing ? C.border : alpha(C.amber, A.accent)}`,
                  fontSize:13, fontWeight:500, cursor:parsing?"not-allowed":"pointer",
                  letterSpacing:"0.02em"}}>
                  {parsing ? "解析中..." : "解析這筆交易"}
                </button>
              )}
              {parseErr && <div style={{marginTop:10, background:C.upBg,
                border:`1px solid ${alpha(C.up, A.line)}`, borderRadius:10,
                padding:12, fontSize:12, color:C.up}}>
                {parseErr}
              </div>}
            </>
          )}

          {parsed?.trades?.length>0 && (
            <div>
              <div style={{...card,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={lbl}>解析結果</div>
                  <span style={{fontSize:9,color:C.textMute}}>點擊可修正</span>
                </div>
                {parsed.trades.map((t,i)=>{
                  const toggleAction = () => setParsed(prev => {
                    const trades = [...prev.trades];
                    trades[i] = {...trades[i], action: trades[i].action==="買進"?"賣出":"買進"};
                    return {...prev, trades};
                  });
                  const editField = (field) => {
                    const label = {qty:"股數",price:"成交價",name:"名稱",code:"代碼"}[field];
                    const val = prompt(`修正${label}：`, t[field]);
                    if (val==null) return;
                    setParsed(prev => {
                      const trades = [...prev.trades];
                      const parsed = field==="qty"||field==="price" ? Number(val) : val;
                      if ((field==="qty"||field==="price") && isNaN(parsed)) return prev;
                      trades[i] = {...trades[i], [field]: parsed};
                      return {...prev, trades};
                    });
                  };
                  return (
                  <div key={i} style={{padding:"10px 0",
                    borderBottom:i<parsed.trades.length-1?`1px solid ${C.borderSub}`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span onClick={toggleAction} style={{
                        background: t.action==="買進" ? C.upBg : C.downBg,
                        color: t.action==="買進" ? C.up : C.down,
                        fontSize:10, fontWeight:600, padding:"2px 9px", borderRadius:4,
                        cursor:"pointer", border:`1px dashed ${t.action==="買進"?C.up:C.down}44`}}>
                        {t.action} ↔
                      </span>
                      <span onClick={()=>editField("name")} style={{fontSize:14,fontWeight:600,color:C.text,cursor:"pointer"}}>{t.name}</span>
                      <span onClick={()=>editField("code")} style={{fontSize:10,color:C.textMute,cursor:"pointer"}}>{t.code}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                      <span onClick={()=>editField("qty")} style={{fontSize:11,color:C.textMute,cursor:"pointer",
                        borderBottom:`1px dashed ${C.borderStrong}`}}>{t.qty}股</span>
                      <span style={{fontSize:11,color:C.textMute}}>@</span>
                      <span onClick={()=>editField("price")} style={{fontSize:11,color:C.textMute,cursor:"pointer",
                        borderBottom:`1px dashed ${C.borderStrong}`}}>{t.price?.toLocaleString()}元</span>
                    </div>
                  </div>
                  );
                })}
                {parsed.note && <div style={{fontSize:10,color:C.textMute,marginTop:8}}>{parsed.note}</div>}
                {parsed.targetPriceUpdates?.length>0 && (
                  <div style={{marginTop:10,background:C.tealBg,border:`1px solid ${alpha(C.teal, A.line)}`,
                    borderRadius:7,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:C.teal,fontWeight:600,marginBottom:4}}>
                      偵測到目標價更新
                    </div>
                    {parsed.targetPriceUpdates.map((u,i)=>(
                      <div key={i} style={{fontSize:11,color:C.textSec}}>
                        {u.code} · {u.firm} → {u.target?.toLocaleString()}元
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{...card,borderLeft:`2px solid ${alpha(C.blue, A.glow)}`}}>
                <div style={lbl}>交易備忘錄</div>
                {memoAns.map((a,i)=>(
                  <div key={i} style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:C.textMute,marginBottom:4}}>Q{i+1}. {qs[i]}</div>
                    <div style={{fontSize:12,color:C.textSec,background:C.subtle,
                      borderRadius:6,padding:"8px 10px",lineHeight:1.6}}>{a}</div>
                  </div>
                ))}
                <div style={{fontSize:12,fontWeight:500,color:C.blue,marginBottom:8}}>
                  Q{memoStep+1}/{qs.length}. {qs[memoStep]}
                </div>
                <textarea value={memoIn}
                  onChange={e=>setMemoIn(e.target.value)}
                  onKeyDown={e=>{
                    if (e.key==="Enter" && !e.shiftKey && !isImeComposing(e) && memoIn.trim()) {
                      e.preventDefault();
                      submitMemo();
                    }
                  }}
                  placeholder="輸入你的想法... (Enter送出)"
                  style={{width:"100%", background:C.subtle, border:`1px solid ${C.border}`,
                    borderRadius:8, padding:"10px", color:C.text, fontSize:12,
                    resize:"none", minHeight:70, outline:"none",
                    fontFamily:"inherit", marginBottom:10, lineHeight:1.7}}/>
                <button onClick={submitMemo} disabled={!memoIn.trim()} style={{
                  width:"100%", padding:"12px", border:"none", borderRadius:8,
                  background: memoIn.trim()
                    ? alpha(C.fillTeal, A.pressed)
                    : C.subtle,
                  color: memoIn.trim() ? C.onFill : C.textMute,
                  fontSize:13, fontWeight:500, cursor:memoIn.trim()?"pointer":"not-allowed",
                  letterSpacing:"0.02em"}}>
                  {memoStep===qs.length-1 ? "完成備忘 · 更新持倉" : `下一題 (${memoStep+1}/${qs.length})`}
                </button>
              </div>
            </div>
          )}

          {/* 手動更新目標價 */}
          {!parsed && !img && (()=>{
            const handleAddTarget = () => {
              const ok = upsertTargetReport({
                code: tpCode,
                firm: tpFirm,
                target: parseFloat(tpVal),
                date: toSlashDate(),
              });
              if (!ok) return;
              setTpCode(""); setTpFirm(""); setTpVal("");
            };
            const handleSaveFundamentals = () => {
              const code = fundamentalDraft.code.trim();
              if (!code) return;
              const ok = upsertFundamentalsEntry(code, {
                revenueMonth: fundamentalDraft.revenueMonth.trim() || null,
                revenueYoY: fundamentalDraft.revenueYoY === "" ? null : Number(fundamentalDraft.revenueYoY),
                revenueMoM: fundamentalDraft.revenueMoM === "" ? null : Number(fundamentalDraft.revenueMoM),
                quarter: fundamentalDraft.quarter.trim() || null,
                eps: fundamentalDraft.eps === "" ? null : Number(fundamentalDraft.eps),
                grossMargin: fundamentalDraft.grossMargin === "" ? null : Number(fundamentalDraft.grossMargin),
                roe: fundamentalDraft.roe === "" ? null : Number(fundamentalDraft.roe),
                source: fundamentalDraft.source.trim() || "手動整理",
                updatedAt: fundamentalDraft.updatedAt.trim() || toSlashDate(),
                note: fundamentalDraft.note.trim(),
              });
              if (!ok) return;
              setFundamentalDraft(createDefaultFundamentalDraft());
            };
            return (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
                <div style={{...card,borderLeft:`2px solid ${alpha(C.teal, A.accent)}`}}>
                  <div style={lbl}>手動更新目標價</div>
                  <div style={{fontSize:11,color:C.textMute,marginBottom:10,lineHeight:1.6}}>
                    收到新研究報告時，直接在這裡更新。系統會自動計算多家均值。
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>股票代碼</div>
                      <input value={tpCode} onChange={e=>setTpCode(e.target.value)}
                        placeholder="如 3006"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                          borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>目標價（元）</div>
                      <input value={tpVal} onChange={e=>setTpVal(e.target.value)}
                        placeholder="如 205"
                        type="number"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                          borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>券商 / 來源</div>
                    <input value={tpFirm} onChange={e=>setTpFirm(e.target.value)}
                      placeholder="如 元大投顧、FactSet共識"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                  <button onClick={handleAddTarget}
                    disabled={!tpCode.trim()||!tpVal}
                    style={{
                      width:"100%",padding:"10px",border:"none",borderRadius:8,
                      background: tpCode.trim()&&tpVal ? alpha(C.fillTeal, A.pressed) : C.subtle,
                      color: tpCode.trim()&&tpVal ? C.onFill : C.textMute,
                      fontSize:12,fontWeight:500,cursor:tpCode.trim()&&tpVal?"pointer":"not-allowed",
                    }}>
                    新增 / 更新目標價
                  </button>
                </div>

                <div style={{...card,borderLeft:`2px solid ${alpha(C.amber, A.accent)}`}}>
                  <div style={lbl}>手動更新財報 / 營收</div>
                  <div style={{fontSize:11,color:C.textMute,marginBottom:10,lineHeight:1.6}}>
                    法說、月營收或財報出來後，把關鍵數字補進來，dossier 就會跟著變新。
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>股票代碼</div>
                      <input value={fundamentalDraft.code} onChange={e=>setFundamentalDraft(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="如 6274"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>資料日期</div>
                      <input value={fundamentalDraft.updatedAt} onChange={e=>setFundamentalDraft(prev => ({ ...prev, updatedAt: e.target.value }))}
                        placeholder="如 2026/03/24"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>月營收月份</div>
                      <input value={fundamentalDraft.revenueMonth} onChange={e=>setFundamentalDraft(prev => ({ ...prev, revenueMonth: e.target.value }))}
                        placeholder="如 2026/03"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>季度</div>
                      <input value={fundamentalDraft.quarter} onChange={e=>setFundamentalDraft(prev => ({ ...prev, quarter: e.target.value }))}
                        placeholder="如 2026Q1"
                        style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:7,marginBottom:7}}>
                    {[
                      ["revenueYoY","月營收 YoY %"],
                      ["revenueMoM","月營收 MoM %"],
                      ["eps","EPS"],
                      ["grossMargin","毛利率 %"],
                      ["roe","ROE %"],
                    ].map(([key, label])=>(
                      <div key={key}>
                        <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>{label}</div>
                        <input value={fundamentalDraft[key]} onChange={e=>setFundamentalDraft(prev => ({ ...prev, [key]: e.target.value }))}
                          type="number"
                          placeholder="可留空"
                          style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:7}}>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>來源</div>
                    <input value={fundamentalDraft.source} onChange={e=>setFundamentalDraft(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="如 2026Q1 法說 / 月營收公告 / 手動整理"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>備註</div>
                    <textarea value={fundamentalDraft.note} onChange={e=>setFundamentalDraft(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="如：毛利率回升主要來自庫存損失回沖"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",minHeight:68,lineHeight:1.6}}/>
                  </div>
                  <button onClick={handleSaveFundamentals}
                    disabled={!fundamentalDraft.code.trim()}
                    style={{
                      width:"100%",padding:"10px",border:"none",borderRadius:8,
                      background: fundamentalDraft.code.trim() ? alpha(C.fillAmber, A.pressed) : C.subtle,
                      color: fundamentalDraft.code.trim() ? C.onFill : C.textMute,
                      fontSize:12,fontWeight:500,cursor:fundamentalDraft.code.trim()?"pointer":"not-allowed",
                    }}>
                    儲存財報 / 營收摘要
                  </button>
                </div>
              </div>
            );
          })()}
        </>}

        {/* ══════════ LOG ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="log" && <>
          {(!tradeLog||tradeLog.length===0) ? (
            <div style={{...card,textAlign:"center",padding:"24px 14px"}}>
              <div style={{fontSize:20,marginBottom:6,opacity:0.3}}>◌</div>
              <div style={{fontSize:12,color:C.textMute,fontWeight:400}}>
                還沒有交易記錄<br/>
                <span style={{fontSize:10}}>上傳成交截圖後自動記錄在這裡</span>
              </div>
            </div>
          ) : (
            [...(tradeLog||[])].sort((a,b)=>b.id-a.id).map(log=>(
              <div key={log.id} style={{...card,marginBottom:8,
                borderLeft:`2px solid ${alpha(log.action==="買進" ? C.up : C.down, A.glow)}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{
                      background: log.action==="買進" ? C.upBg : C.downBg,
                      color: log.action==="買進" ? C.up : C.down,
                      fontSize:9, fontWeight:600, padding:"2px 8px", borderRadius:4}}>
                      {log.action}
                    </span>
                    <span style={{fontSize:14,fontWeight:600,color:C.text}}>{log.name}</span>
                    <span style={{fontSize:10,color:C.textMute}}>{log.code}</span>
                  </div>
                  <div style={{fontSize:10,color:C.textMute}}>{log.date} {log.time}</div>
                </div>
                <div style={{fontSize:11,color:C.textMute,marginBottom:10}}>
                  {log.qty}股 @ {log.price?.toLocaleString()}元
                </div>
                {log.qa.map((item,i)=>(
                  <div key={i} style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:C.textMute,marginBottom:3}}>{item.q}</div>
                    <div style={{fontSize:11,color:C.textSec,background:C.subtle,
                      borderRadius:6,padding:"7px 10px",lineHeight:1.7}}>
                      {item.a||"（未填）"}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>}

        {/* ══════════ NEWS ANALYSIS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="news" && (()=>{
          const NE = newsEvents || NEWS_EVENTS;
          const past    = NE.filter(isClosedEvent).sort((a,b)=>b.id-a.id);
          const tracking = NE.filter(e=>e.status==="tracking").sort((a,b)=>a.id-b.id);
          const pending = NE.filter(e=>e.status==="pending").sort((a,b)=>a.id-b.id);
          const hits    = NE.filter(e=>e.correct===true).length;
          const misses  = NE.filter(e=>e.correct===false).length;

          const predIcon = (p) => p==="up"?"↑":p==="down"?"↓":"—";
          const predLabel= (p) => p==="up"?"看漲":p==="down"?"看跌":"中性";
          const predC    = (p) => p==="up"?C.up:p==="down"?C.down:C.textMute;

          // 每隔一個卡片用不同底色，保持莫蘭迪跳色感
          const tints = [C.card, C.cardBlue, C.cardAmber, C.cardOlive, C.cardRose];
          const tint  = (i) => tints[i % tints.length];

          const renderEvent = (e, idx) => {
            const open   = expandedNews.has(e.id);
            const isCorrect = e.correct;
            const trackingMetrics = e.status === "tracking" ? getEventTrackingMetrics(e) : null;
            const borderC = isClosedEvent(e)
              ? (isCorrect===true ? alpha(C.olive, A.solid) : isCorrect===false ? alpha(C.up, A.solid) : C.border)
              : e.status === "tracking"
                ? alpha(C.blue, A.strongLine)
                : alpha(predC(e.pred), A.strongLine);

            return (
              <div key={e.id}
                onClick={()=>toggleNews(e.id)}
                style={{
                  background: tint(idx),
                  border:`1px solid ${C.border}`,
                  borderLeft:`2px solid ${borderC}`,
                  borderRadius:10, marginBottom:6,
                  cursor:"pointer", overflow:"hidden",
                  transition:"all 0.15s",
                }}
              >
                {/* ── 縮列行 ── */}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px"}}>
                  {/* 預測/結果標籤 */}
                  <div style={{
                    minWidth:26, textAlign:"center",
                    fontSize:14, fontWeight:700,
                    color: predC(e.pred), opacity: 0.85,
                  }}>{predIcon(e.pred)}</div>

                  {/* 標題區 */}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{
                      fontSize:12, fontWeight:500, color:C.text,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    }}>{e.title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,color:C.textMute}}>{e.date}</span>
                      {e.stocks.slice(0,2).map(s=>(
                        <span key={s} style={{fontSize:9,padding:"1px 6px",borderRadius:3,
                          background:C.subtle,color:C.textSec}}>{s.split(" ")[0]}</span>
                      ))}
                      {e.stocks.length>2 && <span style={{fontSize:9,color:C.textMute}}>+{e.stocks.length-2}</span>}
                    </div>
                  </div>

                  {/* 右側狀態 */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                    {isClosedEvent(e) && isCorrect!==null && (
                      <span style={{
                        fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20,
                        background: isCorrect ? C.oliveBg : C.upBg,
                        color: isCorrect ? C.olive : C.up,
                      }}>{isCorrect ? "✓ 正確" : "✗ 有誤"}</span>
                    )}
                    {e.status==="tracking" && (() => {
                      const days = trackingMetrics?.trackingDays;
                      const isOverdue = days != null && days > 14;
                      const isWarning = days != null && days > 7 && !isOverdue;
                      return <>
                        <span style={{fontSize:9,color:isOverdue?C.up:isWarning?C.amber:C.blue,fontWeight:600}}>
                          追蹤中{days != null ? ` · ${days}天` : ""}
                        </span>
                        {isOverdue && <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.upBg,color:C.up,fontWeight:600}}>逾期未結案</span>}
                        {isWarning && <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.amberBg,color:C.amber,fontWeight:600}}>即將逾期</span>}
                      </>;
                    })()}
                    {e.status==="pending" && (
                      <span style={{fontSize:9,color:C.textMute,fontWeight:500}}>待驗證</span>
                    )}
                    <span style={{fontSize:10,color:C.textMute}}>{open?"▲":"▼"}</span>
                  </div>
                </div>

                {/* ── 展開內容 ── */}
                {open && (
                  <div style={{
                    padding:"0 12px 12px",
                    borderTop:`1px solid ${C.borderSub}`,
                    paddingTop:10,
                  }}>
                    {/* 全部個股 */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                      {e.stocks.map(s=>(
                        <span key={s} style={{fontSize:9,padding:"2px 8px",borderRadius:3,
                          background:C.blueBg,color:C.blue,fontWeight:500}}>{s}</span>
                      ))}
                    </div>

                    <div style={{fontSize:11,color:C.textSec,lineHeight:1.8,marginBottom:8}}>{e.detail}</div>

                    {/* 預測邏輯 */}
                    <div style={{background:C.subtle,borderRadius:7,padding:"9px 11px",marginBottom: e.actualNote?8:0}}>
                      <div style={{fontSize:9,color:predC(e.pred),fontWeight:600,marginBottom:3,letterSpacing:"0.05em"}}>
                        {predIcon(e.pred)} 預測{predLabel(e.pred)} — 邏輯
                      </div>
                      <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.predReason}</div>
                    </div>

                    {trackingMetrics && (
                      <div style={{
                        background:C.blueBg,
                        border:`1px solid ${alpha(C.blue, A.soft)}`,
                        borderRadius:7,
                        padding:"9px 11px",
                        marginTop:8,
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:9,color:C.blue,fontWeight:600,letterSpacing:"0.05em"}}>
                            追蹤中 · {trackingMetrics.trackingDays != null ? `${trackingMetrics.trackingDays} 天` : "天數計算中"}
                          </div>
                          {trackingMetrics.trackingDays != null && trackingMetrics.trackingDays >= 90 && (
                            <span style={{fontSize:9,color:C.up,fontWeight:600}}>超過 90 天，建議結案</span>
                          )}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                          <div>
                            <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件日價格</div>
                            <div style={{fontSize:11,color:C.textSec,lineHeight:1.6}}>
                              {formatEventPriceRecord(e.priceAtEvent)}
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>最新價格</div>
                            <div style={{fontSize:11,color:C.textSec,lineHeight:1.6}}>
                              {formatEventPriceRecord(trackingMetrics.currentPrices)}
                            </div>
                          </div>
                        </div>
                        {trackingMetrics.changePct != null && (
                          <div style={{marginTop:8,fontSize:11,color:trackingMetrics.changePct >= 0 ? C.up : C.down,fontWeight:600}}>
                            平均變化 {trackingMetrics.changePct >= 0 ? "+" : ""}{trackingMetrics.changePct.toFixed(2)}%
                            {trackingMetrics.latestDate ? ` · 更新到 ${trackingMetrics.latestDate}` : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 實際結果（已發生） */}
                    {e.actualNote && (
                      <div style={{
                        background: isCorrect ? alpha(C.oliveBg, A.glow) : alpha(C.upBg, A.glow),
                        border:`1px solid ${isCorrect ? alpha(C.olive, A.line):alpha(C.up, A.line)}`,
                        borderRadius:7, padding:"9px 11px", marginTop:8,
                      }}>
                        <div style={{fontSize:9,color: isCorrect?C.olive:C.up,fontWeight:600,marginBottom:3,letterSpacing:"0.05em"}}>
                          {predIcon(e.actual)} 實際{predLabel(e.actual)} — {isCorrect?"預測正確":"預測有誤"}
                        </div>
                        <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.actualNote}</div>
                        {Array.isArray(e.stockOutcomes) && e.stockOutcomes.length > 0 && (
                          <div style={{fontSize:10,color:C.textMute,lineHeight:1.7,marginTop:6}}>
                            逐檔結果：{e.stockOutcomes.map(formatEventStockOutcomeLine).join("；")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 復盤教訓（若有） */}
                    {e.lessons && (
                      <div style={{background:C.blueBg,border:`1px solid ${alpha(C.blue, A.soft)}`,
                        borderRadius:7,padding:"9px 11px",marginTop:8}}>
                        <div style={{fontSize:9,color:C.blue,fontWeight:600,marginBottom:3}}>策略覆盤教訓</div>
                        <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.lessons}</div>
                      </div>
                    )}

                    {/* 復盤按鈕（待觀察事件） */}
                    {(e.status==="pending" || e.status==="tracking") && (
                      <button onClick={(ev)=>openEventReview(e, ev)}
                        style={{marginTop:10,width:"100%",padding:"9px",
                          background:alpha(C.olive, A.faint),border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                          borderRadius:8,color:C.olive,fontSize:11,fontWeight:500,cursor:"pointer"}}>
                        {e.status==="tracking" ? "結案復盤" : "標記結果 · 撰寫復盤"}
                      </button>
                    )}

                    {/* 復盤表單 */}
                    {reviewingEvent===e.id && (
                      <div onClick={ev=>ev.stopPropagation()} onTouchStart={ev=>ev.stopPropagation()}
                        style={{marginTop:10,background:C.subtle,borderRadius:8,padding:12,
                          border:`1px solid ${alpha(C.blue, A.line)}`}}>
                        <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:10}}>撰寫完整復盤</div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>實際走勢</div>
                          <div style={{display:"flex",gap:6}}>
                            {["up","down","neutral"].map(v=>(
                              <button key={v} onClick={()=>setReviewForm(p=>({...p,actual:v}))}
                                style={{flex:1,padding:"6px",borderRadius:6,fontSize:10,fontWeight:500,cursor:"pointer",
                                  background:reviewForm.actual===v?(v==="up"?C.upBg:v==="down"?C.downBg:C.subtle):"transparent",
                                  color:reviewForm.actual===v?(v==="up"?C.up:v==="down"?C.down:C.textSec):C.textMute,
                                  border:`1px solid ${reviewForm.actual===v?(v==="up"?alpha(C.up, A.strongLine):v==="down"?alpha(C.down, A.strongLine):C.border):C.border}`}}>
                                {v==="up"?"↑ 漲":v==="down"?"↓ 跌":"— 中性"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>發生了什麼？（點選快填或自行輸入）</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                            {["如預期上漲，符合邏輯","超預期大漲，市場過熱","不如預期，漲幅有限",
                              "與預測相反，大跌","橫盤震盪，方向不明","利多出盡，衝高回落",
                              "跳空突破，量能放大","緩跌破支撐，止跌不明"].map(chip=>(
                              <button key={chip} onClick={()=>setReviewForm(p=>({...p,actualNote:p.actualNote?p.actualNote+"；"+chip:chip}))}
                                style={{fontSize:9,padding:"3px 8px",borderRadius:12,cursor:"pointer",
                                  background:C.card,border:`1px solid ${C.border}`,color:C.textSec,
                                  whiteSpace:"nowrap"}}>
                                {chip}
                              </button>
                            ))}
                          </div>
                          <textarea value={reviewForm.actualNote}
                            onChange={ev=>setReviewForm(p=>({...p,actualNote:ev.target.value}))}
                            placeholder="描述事件結果和股價反應..."
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                              minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                        </div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>策略覆盤（點選快填或自行輸入）</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                            {["進場時機正確","出場太慢，錯過高點","倉位太重，應該減碼",
                              "該停損沒停","預測邏輯正確但時間點偏差","受市場情緒影響判斷",
                              "資訊不足就進場","完美執行策略","下次應等回檔再進",
                              "應加碼但猶豫錯過"].map(chip=>(
                              <button key={chip} onClick={()=>setReviewForm(p=>({...p,lessons:p.lessons?p.lessons+"；"+chip:chip}))}
                                style={{fontSize:9,padding:"3px 8px",borderRadius:12,cursor:"pointer",
                                  background:C.card,border:`1px solid ${C.border}`,color:C.textSec,
                                  whiteSpace:"nowrap"}}>
                                {chip}
                              </button>
                            ))}
                          </div>
                          <textarea value={reviewForm.lessons}
                            onChange={ev=>setReviewForm(p=>({...p,lessons:ev.target.value}))}
                            placeholder="進場理由回顧、策略偏差、改進方向..."
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                              minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                        </div>

                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setReviewingEvent(null);setReviewForm(createDefaultReviewForm());}}
                            style={{flex:1,padding:"9px",background:"transparent",border:`1px solid ${C.border}`,
                              borderRadius:7,color:C.textMute,fontSize:11,cursor:"pointer"}}>取消</button>
                          <button onClick={()=>submitReview(e.id)}
                            disabled={!reviewForm.actualNote.trim()}
                            style={{flex:2,padding:"9px",borderRadius:7,border:"none",fontSize:11,fontWeight:500,cursor:"pointer",
                              background:reviewForm.actualNote.trim()?alpha(C.fillTeal, A.pressed):C.subtle,
                              color:reviewForm.actualNote.trim()?C.onFill:C.textMute}}>
                            確認送出復盤
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return <>
            {/* 準確率摘要 */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, marginBottom:10,
            }}>
              {[
                ["待追蹤", `${pending.length}`, C.textSec, C.card],
                ["追蹤中", `${tracking.length}`, C.blue, C.cardBlue],
                ["預測正確", `${hits}`, C.up, C.cardRose],
                ["命中率", hits+misses>0?`${Math.round(hits/(hits+misses)*100)}%`:"—", C.amber, C.cardAmber],
              ].map(([l,v,c,bg])=>(
                <div key={l} style={{background:bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px"}}>
                  <div style={{fontSize:9,color:C.textMute,letterSpacing:"0.06em"}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:600,color:c,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>

            {/* 行事曆視圖 */}
            <button onClick={()=>setShowCalendar(p=>!p)} style={{
              width:"100%",padding:"8px",marginBottom:8,borderRadius:8,
              background:showCalendar?C.subtle:C.card,
              border:`1px solid ${C.border}`,
              color:showCalendar?C.textMute:C.textSec,fontSize:10,fontWeight:500,cursor:"pointer"}}>
              {showCalendar?"收合行事曆":"展開行事曆"}
            </button>

            {showCalendar && (() => {
              const { year: cYear, month: cMonth } = calendarMonth;
              const firstDay = new Date(cYear, cMonth, 1).getDay(); // 0=Sun
              const daysInMonth = new Date(cYear, cMonth + 1, 0).getDate();
              const monthLabel = `${cYear} 年 ${cMonth + 1} 月`;
              const allEvents = [...pending, ...tracking, ...past];
              // 建立日期→事件映射
              const dateEventMap = {};
              allEvents.forEach(e => {
                if (!e.date) return;
                const parts = e.date.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
                if (!parts) return;
                const [, ey, em, ed] = parts;
                if (parseInt(ey) === cYear && parseInt(em) - 1 === cMonth) {
                  const day = parseInt(ed);
                  if (!dateEventMap[day]) dateEventMap[day] = [];
                  dateEventMap[day].push(e);
                }
              });
              const todayD = new Date();
              const isToday = (d) => todayD.getFullYear() === cYear && todayD.getMonth() === cMonth && todayD.getDate() === d;
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);

              return (
                <div style={{...card, marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <button onClick={()=>setCalendarMonth(p => {
                      const m = p.month - 1;
                      return m < 0 ? { year: p.year - 1, month: 11 } : { ...p, month: m };
                    })} style={{background:"transparent",border:"none",color:C.textSec,fontSize:14,cursor:"pointer",padding:"4px 8px"}}>◀</button>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{monthLabel}</span>
                    <button onClick={()=>setCalendarMonth(p => {
                      const m = p.month + 1;
                      return m > 11 ? { year: p.year + 1, month: 0 } : { ...p, month: m };
                    })} style={{background:"transparent",border:"none",color:C.textSec,fontSize:14,cursor:"pointer",padding:"4px 8px"}}>▶</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,textAlign:"center"}}>
                    {["日","一","二","三","四","五","六"].map(d=>(
                      <div key={d} style={{fontSize:9,color:C.textMute,padding:"4px 0",fontWeight:600}}>{d}</div>
                    ))}
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e${i}`}/>;
                      const evts = dateEventMap[d] || [];
                      const hasTracking = evts.some(e => e.status === "tracking");
                      const hasPending = evts.some(e => e.status === "pending");
                      const hasClosed = evts.some(e => isClosedEvent(e));
                      const hasCorrect = evts.some(e => e.correct === true);
                      const hasWrong = evts.some(e => e.correct === false);
                      return (
                        <div key={d}
                          onClick={()=>{ if (evts.length > 0) setExpandedNews(new Set(evts.map(e=>e.id))); }}
                          style={{
                            padding:"4px 2px", borderRadius:6, cursor: evts.length > 0 ? "pointer" : "default",
                            background: isToday(d) ? alpha(C.blue, A.faint) : evts.length > 0 ? C.subtle : "transparent",
                            border: isToday(d) ? `1px solid ${alpha(C.blue, A.strongLine)}` : "1px solid transparent",
                            minHeight: 32,
                          }}>
                          <div style={{fontSize:10,color: isToday(d)?C.blue:C.text,fontWeight: isToday(d)?700:400}}>{d}</div>
                          {evts.length > 0 && (
                            <div style={{display:"flex",justifyContent:"center",gap:2,marginTop:2,flexWrap:"wrap"}}>
                              {hasPending && <div style={{width:5,height:5,borderRadius:"50%",background:C.textMute}}/>}
                              {hasTracking && <div style={{width:5,height:5,borderRadius:"50%",background:C.blue}}/>}
                              {hasCorrect && <div style={{width:5,height:5,borderRadius:"50%",background:C.olive}}/>}
                              {hasWrong && <div style={{width:5,height:5,borderRadius:"50%",background:C.up}}/>}
                              {hasClosed && !hasCorrect && !hasWrong && <div style={{width:5,height:5,borderRadius:"50%",background:C.textSec}}/>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:8,justifyContent:"center"}}>
                    {[["待追蹤",C.textMute],["追蹤中",C.blue],["正確",C.olive],["有誤",C.up]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:3}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:c}}/>
                        <span style={{fontSize:8,color:C.textMute}}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 新增事件按鈕 */}
            <button onClick={()=>setShowAddEvent(!showAddEvent)} style={{
              width:"100%",padding:"10px",marginBottom:10,borderRadius:8,
              background:showAddEvent?C.subtle:alpha(C.blue, A.faint),
              border:`1px solid ${showAddEvent?C.border:alpha(C.blue, A.strongLine)}`,
              color:showAddEvent?C.textMute:C.blue,fontSize:11,fontWeight:500,cursor:"pointer"}}>
              {showAddEvent?"取消":"＋ 新增事件（法說會、財報、營收、催化劑）"}
            </button>

            {showAddEvent && (
              <div style={{...card,marginBottom:12,borderLeft:`2px solid ${alpha(C.blue, A.glow)}`}}>
                <div style={{...lbl,color:C.blue}}>新增事件</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>日期</div>
                    <input value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))}
                      placeholder="如 2026/04/01"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>相關個股（逗號分隔）</div>
                    <input value={newEvent.stocks} onChange={e=>setNewEvent(p=>({...p,stocks:e.target.value}))}
                      placeholder="如 台燿 6274, 晶豪科 3006"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件標題</div>
                  <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))}
                    placeholder="如：台燿 Q1 財報法說會"
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件細節</div>
                  <textarea value={newEvent.detail}
                    onChange={e=>setNewEvent(p=>({...p,detail:e.target.value}))}
                    placeholder="關鍵觀察重點..."
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                      minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>預測方向</div>
                  <div style={{display:"flex",gap:6}}>
                    {["up","down","neutral"].map(v=>(
                      <button key={v} onClick={()=>setNewEvent(p=>({...p,pred:v}))}
                        style={{flex:1,padding:"6px",borderRadius:6,fontSize:10,fontWeight:500,cursor:"pointer",
                          background:newEvent.pred===v?(v==="up"?C.upBg:v==="down"?C.downBg:C.subtle):"transparent",
                          color:newEvent.pred===v?(v==="up"?C.up:v==="down"?C.down:C.textSec):C.textMute,
                          border:`1px solid ${newEvent.pred===v?(v==="up"?alpha(C.up, A.strongLine):v==="down"?alpha(C.down, A.strongLine):C.border):C.border}`}}>
                        {v==="up"?"↑ 看漲":v==="down"?"↓ 看跌":"— 中性"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>預測邏輯</div>
                  <textarea value={newEvent.predReason}
                    onChange={e=>setNewEvent(p=>({...p,predReason:e.target.value}))}
                    placeholder="為什麼這樣預測？依據是什麼？"
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                      minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                </div>
                <button onClick={addEvent}
                  disabled={!newEvent.title.trim()||!newEvent.date.trim()}
                  style={{width:"100%",padding:"10px",borderRadius:8,border:"none",fontSize:12,
                    fontWeight:500,cursor:newEvent.title.trim()&&newEvent.date.trim()?"pointer":"not-allowed",
                    background:newEvent.title.trim()&&newEvent.date.trim()?alpha(C.fillTeal, A.pressed):C.subtle,
                    color:newEvent.title.trim()&&newEvent.date.trim()?C.onFill:C.textMute}}>
                  新增事件
                </button>
              </div>
            )}

            {/* 待觀察 */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:8,
            }}>
              <div style={{...lbl, marginBottom:0}}>待觀察 · {pending.length} 件</div>
              <span style={{fontSize:9,color:C.textMute}}>點擊展開詳情</span>
            </div>
            {pending.map((e,i)=> renderEvent(e, i))}

            {/* 復盤超時提醒 banner */}
            {(() => {
              const overdueEvents = tracking.filter(e => {
                const m = getEventTrackingMetrics(e);
                return m?.trackingDays != null && m.trackingDays > 14;
              });
              return overdueEvents.length > 0 ? (
                <div style={{background:C.upBg,border:`1px solid ${alpha(C.up, A.strongLine)}`,borderRadius:8,padding:"10px 12px",marginBottom:8,marginTop:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.up,marginBottom:4}}>
                    {overdueEvents.length} 件追蹤事件已超過 14 天未結案
                  </div>
                  {overdueEvents.map(e => {
                    const m = getEventTrackingMetrics(e);
                    return (
                      <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                        <div>
                          <span style={{fontSize:10,color:C.text}}>{e.title}</span>
                          <span style={{fontSize:9,color:C.textMute,marginLeft:6}}>已追蹤 {m?.trackingDays} 天</span>
                        </div>
                        <button onClick={(ev)=>{ev.stopPropagation();openEventReview(e, ev)}}
                          style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                            background:"transparent",color:C.olive,fontSize:9,cursor:"pointer",fontWeight:600}}>
                          快速結案
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null;
            })()}

            <div style={{...lbl, marginBottom:8, marginTop:tracking.length > 0 ? 8 : 16}}>追蹤中 · {tracking.length} 件</div>
            {tracking.map((e,i)=> renderEvent(e, pending.length + i))}

            {/* 已發生 */}
            <div style={{...lbl, marginBottom:8, marginTop:16}}>已發生 · 驗證 {hits+misses}/{past.length} 件</div>
            {past.map((e,i)=> renderEvent(e, i))}
          </>;
        })()}

      </div>
      {/* Watchlist Modal */}
      {watchlistModalOpen && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setWatchlistModalOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{background:C.card,borderRadius:12,padding:20,width:"90%",maxWidth:400,boxShadow:"0 10px 40px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:16}}>
              {watchlistEditing ? "編輯觀察股" : "新增觀察股"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>代號 *</div>
                <input value={watchlistForm.code} onChange={(e)=>setWatchlistForm({...watchlistForm,code:e.target.value})}
                  placeholder="如：2330"
                  style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>名稱 *</div>
                <input value={watchlistForm.name} onChange={(e)=>setWatchlistForm({...watchlistForm,name:e.target.value})}
                  placeholder="如：台積電"
                  style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>現價</div>
                <input type="number" value={watchlistForm.price} onChange={(e)=>setWatchlistForm({...watchlistForm,price:e.target.value})}
                  placeholder="如：500"
                  style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>目標價</div>
                <input type="number" value={watchlistForm.target} onChange={(e)=>setWatchlistForm({...watchlistForm,target:e.target.value})}
                  placeholder="如：700"
                  style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>狀態</div>
              <input value={watchlistForm.status} onChange={(e)=>setWatchlistForm({...watchlistForm,status:e.target.value})}
                placeholder="如：觀察中、等財報"
                style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>催化劑</div>
              <input value={watchlistForm.catalyst} onChange={(e)=>setWatchlistForm({...watchlistForm,catalyst:e.target.value})}
                placeholder="如：Q2 財報、法說會"
                style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>顏色標籤</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["blue","藍"],["amber","琥珀"],["olive","橄欖"],["up","紅"],["teal","青"],["cyan","藍綠"],["lavender","紫"]].map(([key,label])=>(
                  <button key={key} onClick={()=>setWatchlistForm({...watchlistForm,scKey:key})} style={{
                    padding:"4px 10px",borderRadius:12,fontSize:9,fontWeight:500,cursor:"pointer",
                    background:watchlistForm.scKey===key?C[key]+"33":"transparent",
                    border:`1px solid ${watchlistForm.scKey===key?C[key]:C.border}`,
                    color:watchlistForm.scKey===key?C[key]:C.textMute,
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>備註</div>
              <textarea value={watchlistForm.note} onChange={(e)=>setWatchlistForm({...watchlistForm,note:e.target.value})}
                placeholder="觀察重點、操作策略..."
                style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:8,color:C.text,fontSize:11,resize:"none",minHeight:60,outline:"none",lineHeight:1.6}}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setWatchlistModalOpen(false)} style={{
                padding:"8px 16px",background:"transparent",border:`1px solid ${C.border}`,
                borderRadius:20,fontSize:11,color:C.textMute,cursor:"pointer",
              }}>取消</button>
              <button onClick={handleWatchlistSubmit} style={{
                padding:"8px 16px",background:C.teal,color:"white",border:"none",
                borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
              }}>{watchlistEditing ? "儲存" : "新增"}</button>
            </div>
          </div>
        </div>
      )}
      <div style={{textAlign:"center",padding:"8px 0",fontSize:9,color:C.textMute,opacity:0.5}}>v2024.03.21b · bg:{C.bg}</div>
    </div>
  );
}
