import { INIT_HOLDINGS, INIT_TARGETS, INIT_WATCHLIST, NEWS_EVENTS } from "./seedData.js";

export const OWNER_PORTFOLIO_ID = "me";
export const PORTFOLIO_VIEW_MODE = "portfolio";
export const OVERVIEW_VIEW_MODE = "overview";
export const MARKET_PRICE_CACHE_KEY = "pf-market-price-cache-v1";
export const MARKET_PRICE_SYNC_KEY = "pf-market-price-sync-v1";
export const MARKET_TIMEZONE = "Asia/Taipei";
export const POST_CLOSE_SYNC_MINUTES = 13 * 60 + 35;
export const CURRENT_SCHEMA_VERSION = 3;
export const PORTFOLIOS_KEY = "pf-portfolios-v1";
export const ACTIVE_PORTFOLIO_KEY = "pf-active-portfolio-v1";
export const VIEW_MODE_KEY = "pf-view-mode-v1";
export const SCHEMA_VERSION_KEY = "pf-schema-version";

export const CLOUD_SYNC_TTL = 1000 * 60 * 30;
export const CLOUD_SAVE_DEBOUNCE = 1000 * 20;

export const GLOBAL_SYNC_KEYS = [
  "pf-cloud-sync-at",
  "pf-analysis-cloud-sync-at",
  "pf-research-cloud-sync-at",
];
export const GLOBAL_SYNC_KEY_SET = new Set(GLOBAL_SYNC_KEYS);

export const BACKUP_GLOBAL_KEYS = [
  PORTFOLIOS_KEY,
  ACTIVE_PORTFOLIO_KEY,
  VIEW_MODE_KEY,
  SCHEMA_VERSION_KEY,
];
export const BACKUP_GLOBAL_KEY_SET = new Set(BACKUP_GLOBAL_KEYS);

export const APPLIED_TRADE_PATCHES_KEY = "pf-applied-trade-patches-v1";

export const DEFAULT_PORTFOLIO_NOTES = {
  riskProfile: "",
  preferences: "",
  customNotes: "",
};

export const EVENT_HISTORY_LIMIT = 90;
export const REPORT_REFRESH_DAILY_LIMIT = 5;
export const REPORT_EXTRACT_MAX_ITEMS = 2;
export const BRAIN_VALIDATION_CASE_LIMIT = 240;

export const DEFAULT_REVIEW_FORM = {
  actual: "up",
  actualNote: "",
  lessons: "",
  exitDate: null,
  priceAtExit: null,
};

export const DEFAULT_NEW_EVENT = {
  date: "",
  title: "",
  detail: "",
  stocks: "",
  pred: "up",
  predReason: "",
};

export const DEFAULT_FUNDAMENTAL_DRAFT = {
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

export const PORTFOLIO_STORAGE_FIELDS = [
  { suffix: "holdings-v2", alias: "holdings", ownerFallback: () => INIT_HOLDINGS, emptyFallback: () => [] },
  { suffix: "log-v2", alias: "tradeLog", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "targets-v1", alias: "targets", ownerFallback: () => INIT_TARGETS, emptyFallback: () => ({}) },
  { suffix: "fundamentals-v1", alias: "fundamentals", ownerFallback: () => ({}), emptyFallback: () => ({}), hasLegacy: false },
  { suffix: "watchlist-v1", alias: "watchlist", ownerFallback: () => INIT_WATCHLIST, emptyFallback: () => [], hasLegacy: false },
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

export const LEGACY_STORAGE_KEYS = PORTFOLIO_STORAGE_FIELDS
  .filter(item => item.hasLegacy !== false)
  .map(item => `pf-${item.suffix}`);

export const CLOSED_EVENT_STATUSES = new Set(["past", "closed"]);
export 
export 
export 
export 

export const GLOBAL_STORAGE_KEYS = [
  ...BACKUP_GLOBAL_KEYS,
  ...GLOBAL_SYNC_KEYS,
];

