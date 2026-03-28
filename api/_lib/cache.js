// API 快取工具函式庫
// 用於 Vercel Serverless Functions 的記憶體快取

const cache = new Map()

/**
 * Get cached response
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null
 */
export function getCachedResponse(key) {
  const item = cache.get(key)
  if (!item) return null

  if (Date.now() > item.expiresAt) {
    cache.delete(key)
    return null
  }

  return item.data
}

/**
 * Set cached response
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
export function setCachedResponse(key, data, ttlSeconds = 3600) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Delete cached response
 * @param {string} key - Cache key
 */
export function deleteCachedResponse(key) {
  cache.delete(key)
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now()
  let valid = 0
  let expired = 0

  for (const item of cache.values()) {
    if (now > item.expiresAt) {
      expired++
    } else {
      valid++
    }
  }

  return {
    total: cache.size,
    valid,
    expired,
  }
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache() {
  const now = Date.now()
  for (const [key, item] of cache.entries()) {
    if (now > item.expiresAt) {
      cache.delete(key)
    }
  }
}

// 定期清理過期快取（每 10 分鐘）
if (typeof global !== 'undefined') {
  if (!global.cacheCleanInterval) {
    global.cacheCleanInterval = setInterval(cleanExpiredCache, 10 * 60 * 1000)
  }
}
