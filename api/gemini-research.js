// Vercel Serverless Function — Gemini Research Browser API
// 提供 docs/gemini-research/ 目錄的檔案列表和內容讀取

import fs from 'fs'
import path from 'path'

const GEMINI_DIR = path.join(process.cwd(), 'docs/gemini-research')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { file } = req.query

  try {
    if (file) {
      // 讀取單一檔案內容
      const filePath = path.join(GEMINI_DIR, file)
      
      // 安全性檢查：確保路徑在 GEMINI_DIR 內
      const resolvedPath = path.resolve(filePath)
      if (!resolvedPath.startsWith(GEMINI_DIR)) {
        return res.status(403).json({ error: 'Access denied' })
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      return res.status(200).json(content)
    } else {
      // 列出所有檔案
      const files = listGeminiResearchFiles()
      return res.status(200).json({ files })
    }
  } catch (error) {
    console.error('Gemini research API error:', error)
    return res.status(500).json({ error: error.message })
  }
}

/**
 * List all Gemini research files with metadata
 */
function listGeminiResearchFiles() {
  if (!fs.existsSync(GEMINI_DIR)) {
    return []
  }

  const files = fs.readdirSync(GEMINI_DIR)
    .filter(f => f.endsWith('.json'))
    .map(filename => {
      const filePath = path.join(GEMINI_DIR, filename)
      const stat = fs.statSync(filePath)
      
      let content = null
      try {
        content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      } catch {
        return null
      }

      const metadata = extractMetadata(filename, content, stat.mtime)
      return metadata
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending

  return files
}

/**
 * Extract metadata from filename and content
 */
function extractMetadata(filename, content, mtime) {
  const date = content.freshness?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 
               mtime.toISOString().slice(0, 10)

  // Determine type from filename
  let type = '未知'
  let displayName = filename.replace('.json', '')
  let itemCount = null

  if (filename.startsWith('event-calendar')) {
    type = '事件行事曆'
    displayName = 'Gemini 事件行事曆'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('target-price')) {
    type = '目標價'
    displayName = 'Gemini 目標價蒐集'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('supply-chain')) {
    type = '供應鏈'
    displayName = 'Gemini 供應鏈分析'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('competitive-landscape')) {
    type = '競爭態勢'
    displayName = 'Gemini 競爭格局分析'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('fact-check')) {
    type = '事實查核'
    displayName = 'Gemini 事實查核報告'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('finmind-validation')) {
    type = 'FinMind 驗證'
    displayName = 'FinMind 數據品質驗證'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('prompt-optimization')) {
    type = 'Prompt 優化'
    displayName = 'Prompt 優化研究'
    itemCount = content.facts?.length || 0
  } else if (filename.startsWith('news')) {
    type = '產業新聞'
    displayName = 'Gemini 產業新聞蒐集'
    itemCount = content.facts?.length || 0
  }

  return {
    name: filename,
    type,
    displayName,
    date,
    itemCount,
    mtime: mtime.toISOString(),
  }
}
