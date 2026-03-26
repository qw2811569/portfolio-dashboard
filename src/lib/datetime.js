/**
 * Date and time utilities
 * 
 * Handles all date parsing, formatting, and market clock operations.
 */

import { MARKET_TIMEZONE, POST_CLOSE_SYNC_MINUTES } from "../constants.js";

// ── Date parsing ─────────────────────────────────────────────────────

/**
 * Parse a stored date string into a Date object
 */
export function parseStoredDate(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse a flexible date string (supports multiple formats)
 */
export function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Try ISO format first
  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) return iso;
  
  // Try YYYY/MM/DD or YYYY-MM-DD
  const parts = str.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (parts) {
    const [, year, month, day] = parts;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  
  return null;
}

/**
 * Get current date as ISO string (YYYY-MM-DD)
 */
export function todayStorageDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculate days between two dates
 */
export function daysSince(dateValue, now = new Date()) {
  const date = parseFlexibleDate(dateValue);
  if (!date) return null;
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Compute staleness based on age
 */
export function computeStaleness(dateValue, freshDays = 30, { now = new Date() } = {}) {
  const age = daysSince(dateValue, now);
  if (age == null) return "missing";
  if (age <= freshDays) return "fresh";
  if (age <= freshDays * 3) return "aging";
  return "stale";
}

// ── Market clock ──────────────────────────────────────────────────────

/**
 * Get Taipei market clock for a given date
 */
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

/**
 * Check if post-close price sync can run
 */
export function canRunPostClosePriceSync(date = new Date(), syncMeta = null) {
  const clock = getTaipeiClock(date);
  
  if (clock.isWeekend) {
    return { allowed: false, reason: "market-closed", clock };
  }
  
  if (clock.minutes < POST_CLOSE_SYNC_MINUTES) {
    return { allowed: false, reason: "before-close", clock };
  }
  
  if (syncMeta?.marketDate === clock.marketDate && syncMeta?.status && syncMeta.status !== "idle") {
    return { allowed: false, reason: "already-synced", clock };
  }
  
  return { allowed: true, reason: "ready", clock };
}

// ── Date formatting ───────────────────────────────────────────────────

/**
 * Format date as YYYY/MM/DD
 */
export function formatDateTW(date) {
  if (!date) return "";
  const d = parseFlexibleDate(date) || date;
  if (!(d instanceof Date)) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${year}/${month}/${day}`;
}

/**
 * Format date as MM/DD
 */
export function formatDateMD(date) {
  if (!date) return "";
  const d = parseFlexibleDate(date) || date;
  if (!(d instanceof Date)) return "";
  
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${month}/${day}`;
}

/**
 * Format time as HH:MM
 */
export function formatTime(date) {
  if (!date) return "";
  const d = parseFlexibleDate(date) || date;
  if (!(d instanceof Date)) return "";
  
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  
  return `${hour}:${minute}`;
}

/**
 * Format datetime as YYYY/MM/DD HH:MM
 */
export function formatDateTime(date) {
  if (!date) return "";
  const d = parseFlexibleDate(date) || date;
  if (!(d instanceof Date)) return "";
  
  return `${formatDateTW(d)} ${formatTime(d)}`;
}

/**
 * Get relative time description
 */
export function getRelativeTime(date, now = new Date()) {
  const d = parseFlexibleDate(date);
  if (!d) return "";
  
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}個月前`;
  
  return `${Math.floor(diffDays / 365)}年前`;
}
