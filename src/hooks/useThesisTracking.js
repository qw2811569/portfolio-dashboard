// Thesis 追蹤系統 Hook
// 用於記錄和追蹤投資 thesis

import { useState, useEffect, useCallback, useMemo } from 'react'
import { OWNER_PORTFOLIO_ID, DEFAULT_THESIS, STORAGE_KEYS } from '../constants.js'

/**
 * Read thesis from localStorage
 */
function readThesisFromStorage(portfolioId = OWNER_PORTFOLIO_ID) {
  try {
    const key = `${STORAGE_KEYS.THESIS}-${portfolioId}`
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save thesis to localStorage
 */
function saveThesisToStorage(theses, portfolioId = OWNER_PORTFOLIO_ID) {
  try {
    const key = `${STORAGE_KEYS.THESIS}-${portfolioId}`
    localStorage.setItem(key, JSON.stringify(theses))
    return true
  } catch (err) {
    console.error('Failed to save thesis:', err)
    return false
  }
}

/**
 * Thesis Tracking Hook
 *
 * @param {string} portfolioId - Portfolio ID
 * @returns {Object} Thesis tracking methods and state
 */
export function useThesisTracking(portfolioId = OWNER_PORTFOLIO_ID) {
  const [theses, setTheses] = useState([])
  const [loading, setLoading] = useState(true)

  // Load thesis on mount
  useEffect(() => {
    const loadData = async () => {
      const loaded = readThesisFromStorage(portfolioId)
      setTheses(loaded)
      setLoading(false)
    }

    loadData()
  }, [portfolioId])

  /**
   * Add a new thesis
   */
  const addThesis = useCallback(
    async (thesis) => {
      const newThesis = {
        ...DEFAULT_THESIS,
        id: `thesis-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...thesis,
      }

      const updated = [newThesis, ...theses]
      setTheses(updated)

      const saved = saveThesisToStorage(updated, portfolioId)
      return { success: saved, thesis: newThesis }
    },
    [theses, portfolioId]
  )

  /**
   * Update an existing thesis
   */
  const updateThesis = useCallback(
    async (thesisId, updates) => {
      const updated = theses.map((t) => {
        if (t.id === thesisId) {
          return { ...t, ...updates }
        }
        return t
      })

      setTheses(updated)
      const saved = saveThesisToStorage(updated, portfolioId)
      return { success: saved }
    },
    [theses, portfolioId]
  )

  /**
   * Remove a thesis
   */
  const removeThesis = useCallback(
    async (thesisId) => {
      const updated = theses.filter((t) => t.id !== thesisId)
      setTheses(updated)
      const saved = saveThesisToStorage(updated, portfolioId)
      return { success: saved }
    },
    [theses, portfolioId]
  )

  /**
   * Add review to thesis
   */
  const addReview = useCallback(
    async (thesisId, review) => {
      const updated = theses.map((t) => {
        if (t.id === thesisId) {
          return {
            ...t,
            reviewHistory: [
              ...(t.reviewHistory || []),
              {
                ...review,
                timestamp: new Date().toISOString(),
              },
            ],
          }
        }
        return t
      })

      setTheses(updated)
      const saved = saveThesisToStorage(updated, portfolioId)
      return { success: saved }
    },
    [theses, portfolioId]
  )

  /**
   * Get thesis for a specific stock
   */
  const getThesisByStock = useCallback(
    (stockId) => {
      return theses.find((t) => t.stockId === stockId && t.status === 'active')
    },
    [theses]
  )

  /**
   * Get all active theses
   */
  const activeTheses = useMemo(() => {
    return theses.filter((t) => t.status === 'active')
  }, [theses])

  /**
   * Get theses that need review (no review in 30 days)
   * @param {number} reviewThreshold - Days threshold for review (default: 30)
   */
  const getThesesNeedingReview = useCallback(
    (reviewThreshold = 30) => {
      const now = Date.now()
      const thresholdMs = reviewThreshold * 24 * 60 * 60 * 1000

      return activeTheses.filter((t) => {
        if (!t.reviewHistory || t.reviewHistory.length === 0) {
          return true
        }

        const lastReview = t.reviewHistory[t.reviewHistory.length - 1]
        const lastReviewTime = new Date(lastReview.timestamp).getTime()
        return lastReviewTime < now - thresholdMs
      })
    },
    [activeTheses]
  )

  /**
   * Check thesis invalidation signals
   */
  const checkInvalidationSignals = useCallback((thesis, marketData) => {
    const signals = []

    // Check price-based invalidation
    if (thesis.stopLossPercent && marketData.price) {
      const priceDrop = ((marketData.entryPrice - marketData.price) / marketData.entryPrice) * 100
      if (priceDrop >= thesis.stopLossPercent) {
        signals.push({
          type: 'price',
          message: `股價下跌 ${priceDrop.toFixed(1)}%，達到停損 ${thesis.stopLossPercent}%`,
          severity: 'high',
        })
      }
    }

    // Check target price
    if (thesis.targetPrice && marketData.price) {
      const upside = ((thesis.targetPrice - marketData.price) / marketData.price) * 100
      if (upside <= 5 && upside >= 0) {
        signals.push({
          type: 'target',
          message: `股價 ${marketData.price} 接近目標價 ${thesis.targetPrice}（上漲空間 ${upside.toFixed(1)}%）`,
          severity: 'medium',
        })
      }
    }

    return signals
  }, [])

  return {
    // State
    theses,
    loading,
    activeTheses,

    // Methods
    addThesis,
    updateThesis,
    removeThesis,
    addReview,
    getThesisByStock,
    getThesesNeedingReview,
    checkInvalidationSignals,
  }
}

/**
 * Thesis Form Component Helper
 */
export const THESIS_FORM_FIELDS = {
  reason: {
    label: '我買進這檔是因為...',
    type: 'textarea',
    required: true,
    placeholder: '核心投資邏輯，例如：月營收連續成長、新產品放量...',
  },
  expectation: {
    label: '我預期...會發生',
    type: 'textarea',
    required: false,
    placeholder: '預期催化劑，例如：Q3 財報 EPS 成長 20%、新廠投產...',
  },
  invalidation: {
    label: '如果...發生，代表我錯了',
    type: 'textarea',
    required: true,
    placeholder: '破壞條件，例如：月營收轉負、毛利率下滑超過 5%...',
  },
  targetPrice: {
    label: '目標價',
    type: 'number',
    required: false,
    placeholder: '預設出場價位',
  },
  stopLossPercent: {
    label: '停損 (%)',
    type: 'number',
    required: false,
    placeholder: '願意承擔的最大虧損百分比',
  },
}

/**
 * Validate thesis form
 */
export function validateThesisForm(values) {
  const errors = {}

  if (!values.reason || values.reason.trim() === '') {
    errors.reason = '請填寫進場理由'
  }

  if (!values.invalidation || values.invalidation.trim() === '') {
    errors.invalidation = '請填寫破壞條件'
  }

  if (values.targetPrice && values.targetPrice <= 0) {
    errors.targetPrice = '目標價必須大於 0'
  }

  if (values.stopLossPercent && (values.stopLossPercent <= 0 || values.stopLossPercent > 50)) {
    errors.stopLossPercent = '停損必須在 0-50% 之間'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
