// Vercel Serverless Function — 知識庫讀寫
// 本地檔案優先，提供知識查詢與相似度比對
// 知識庫位置：src/lib/knowledge-base/

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'src/lib/knowledge-base')

// ── 本地檔案讀寫 ──
function knowledgePath(filename) {
  return join(DATA_DIR, filename)
}

function readKnowledge(filename) {
  try {
    const p = knowledgePath(filename)
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function writeKnowledge(filename, data) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(knowledgePath(filename), JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error('Failed to write knowledge:', error)
    return false
  }
}

// ── 知識查詢 ──
function searchKnowledge(query, category = null) {
  const results = []
  const queryLower = query.toLowerCase()

  // 讀取所有分類
  const files = existsSync(DATA_DIR)
    ? readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
    : []

  for (const file of files) {
    const data = readKnowledge(file)
    if (!data || !data.items) continue

    // 如果指定 category，只搜尋該分類
    if (category && data.category !== category) continue

    // 搜尋 items
    for (const item of data.items) {
      const titleMatch = item.title?.toLowerCase().includes(queryLower) ?? false
      const factMatch = item.fact?.toLowerCase().includes(queryLower) ?? false
      const interpretationMatch = item.interpretation?.toLowerCase().includes(queryLower) ?? false
      const actionMatch = item.action?.toLowerCase().includes(queryLower) ?? false
      const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(queryLower)) ?? false

      if (titleMatch || factMatch || interpretationMatch || actionMatch || tagMatch) {
        results.push({
          ...item,
          category: data.category,
          categoryName: data.name,
          matchScore:
            (titleMatch ? 3 : 0) +
            (factMatch ? 2 : 0) +
            (interpretationMatch ? 2 : 0) +
            (actionMatch ? 1 : 0) +
            (tagMatch ? 1 : 0),
        })
      }
    }
  }

  // 按匹配分數排序
  return results.sort((a, b) => b.matchScore - a.matchScore)
}

// ── 獲取相似案例 ──
function getSimilarCases(stockId, limit = 5) {
  const casesData = readKnowledge('strategy-cases.json')
  if (!casesData || !casesData.items) return []

  // 先嘗試 tag 匹配（包含股票代碼或名稱）
  const stockIdLower = String(stockId).toLowerCase()
  const byTag = casesData.items.filter((item) =>
    item.tags?.some((t) => t.toLowerCase().includes(stockIdLower))
  )

  // 若無 tag 命中，回傳高信心度 + 成功案例（通用 fallback）
  const fallback = casesData.items
    .filter((item) => item.outcome === 'success' && (item.confidence ?? 0.7) >= 0.7)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))

  return (byTag.length > 0 ? byTag : fallback).slice(0, limit)
}

// ── 添加知識項目 ──
function addKnowledgeItem(category, item) {
  const filename = `${category}.json`
  const data = readKnowledge(filename)

  if (!data) {
    console.error(`Category ${category} not found`)
    return false
  }

  // 生成 ID
  const prefix = category
    .split('-')
    .map((w) => w[0])
    .join('')
  const num = String(data.items.length + 1).padStart(3, '0')
  item.id = `${prefix}-${num}`
  item.createdAt = new Date().toISOString().split('T')[0]

  data.items.push(item)
  data.metadata.itemCount = data.items.length
  data.metadata.lastUpdated = new Date().toISOString()

  return writeKnowledge(filename, data)
}

// ── 獲取知識庫索引 ──
function getKnowledgeIndex() {
  return readKnowledge('index.json')
}

// ── 獲取所有分類統計 ──
function getCategoryStats() {
  const files = existsSync(DATA_DIR)
    ? readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
    : []

  const stats = []
  for (const file of files) {
    const data = readKnowledge(file)
    if (data) {
      stats.push({
        category: data.category,
        name: data.name,
        itemCount: data.metadata?.itemCount || 0,
        lastUpdated: data.metadata?.lastUpdated,
      })
    }
  }

  return stats
}

// ── Export handler ──
export default async function handler(request, response) {
  const { method, query, body } = request

  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    return response.status(200).end()
  }

  try {
    switch (method) {
      case 'GET': {
        const { action, q, category, stockId } = query

        if (action === 'search') {
          // 搜尋知識
          const results = searchKnowledge(q || '', category)
          return response.status(200).json({ success: true, results })
        }

        if (action === 'similar' && stockId) {
          // 獲取相似案例
          const cases = getSimilarCases(stockId)
          return response.status(200).json({ success: true, cases })
        }

        if (action === 'stats') {
          // 獲取分類統計
          const stats = getCategoryStats()
          return response.status(200).json({ success: true, stats })
        }

        // 預設返回索引
        const index = getKnowledgeIndex()
        return response.status(200).json({ success: true, index })
      }

      case 'POST': {
        const { action, category, item } = body

        if (action === 'add') {
          // 添加知識項目
          const success = addKnowledgeItem(category, item)
          if (success) {
            return response.status(200).json({ success: true, message: 'Knowledge added' })
          } else {
            return response.status(500).json({ success: false, error: 'Failed to add knowledge' })
          }
        }

        return response.status(400).json({ success: false, error: 'Unknown action' })
      }

      default:
        return response.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Knowledge API error:', error)
    return response.status(500).json({ success: false, error: error.message })
  }
}
