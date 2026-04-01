#!/usr/bin/env node
/**
 * 匯入 Gemini 產業新聞到事件系統
 *
 * 支援格式：
 * {
 *   "facts": [
 *     {
 *       "title": "新聞標題",
 *       "date": "2026-04-01",
 *       "stocks": ["2330", "2382"],
 *       "impact": "positive",  // 或 "negative" / "neutral"
 *       "summary": "新聞摘要",
 *       "source": "新聞來源連結",
 *       "category": "產業趨勢"  // 可選：產業趨勢 / 個別公司 / 總體經濟
 *     }
 *   ],
 *   "freshness": "2026-04-01 蒐集"
 * }
 *
 * 使用方式：
 * node scripts/import-gemini-news.js docs/gemini-research/industry-news-2026-04-02.json
 */

import fs from 'fs'
import path from 'path'

const EVENT_FILE = 'src/data/events.json'

function main() {
  const inputFile = process.argv[2]

  if (!inputFile) {
    console.error('請提供輸入檔案路徑')
    console.error('使用方式：node scripts/import-gemini-news.js <industry-news-*.json>')
    process.exit(1)
  }

  // 讀取 Gemini 新聞檔案
  let geminiData
  try {
    geminiData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } catch (err) {
    console.error(`讀取檔案失敗：${err.message}`)
    process.exit(1)
  }

  const facts = geminiData.facts || []
  console.log(`讀取到 ${facts.length} 則新聞`)

  // 過濾有 impact 的新聞
  const validNews = facts.filter(f =>
    f.impact === 'positive' || f.impact === 'negative' || f.impact === 'neutral'
  )
  console.log(`有效新聞（有 impact）：${validNews.length} 個`)

  if (validNews.length === 0) {
    console.log('沒有需要匯入的新聞')
    return
  }

  // 轉換為系統格式（作為事件）
  const events = validNews.map((fact, index) => {
    // 判斷事件類型
    let type = 'news'
    let catalystType = 'news'

    if (fact.category) {
      if (fact.category.includes('產業')) {
        type = 'industry-news'
        catalystType = 'industry'
      } else if (fact.category.includes('總體')) {
        type = 'macro-news'
        catalystType = 'macro'
      }
    }

    // 從標題判斷是否有特定事件類型
    const title = fact.title || ''
    if (title.includes('法說') || title.includes('財報')) {
      type = 'earnings'
      catalystType = 'earnings'
    } else if (title.includes('股東會')) {
      type = 'shareholder'
      catalystType = 'shareholder'
    } else if (title.includes('除權') || title.includes('除息')) {
      type = 'dividend'
      catalystType = 'dividend'
    }

    return {
      id: `gemini-news-${Date.now()}-${index}`,
      code: fact.stocks?.[0] || 'NEWS',
      name: fact.stocks?.join(',') || '產業新聞',
      date: fact.date || new Date().toISOString().slice(0, 10),
      title: title,
      detail: fact.summary || fact.snippet || fact.description || '',
      type: type,
      source: 'gemini-research',
      status: 'pending',
      pred: fact.impact === 'positive' ? 'up' : fact.impact === 'negative' ? 'down' : 'neutral',
      predReason: fact.reason || fact.summary || '',
      stocks: fact.stocks || [],
      category: fact.category || '產業新聞',
      citation: fact.source,
      impact: fact.impact === 'positive' ? 'high' : fact.impact === 'negative' ? 'medium' : 'low',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  console.log(`轉換完成：${events.length} 個新聞事件`)

  // 讀取現有事件
  let existingEvents = []
  try {
    const eventPath = path.join(process.cwd(), EVENT_FILE)
    if (fs.existsSync(eventPath)) {
      existingEvents = JSON.parse(fs.readFileSync(eventPath, 'utf-8'))
      console.log(`現有事件：${existingEvents.length} 個`)
    }
  } catch (err) {
    console.warn(`讀取現有事件失敗：${err.message}`)
  }

  // 合併事件（去重）
  const existingIds = new Set(existingEvents.map(e => e.id))
  const newEvents = events.filter(e => !existingIds.has(e.id))
  const mergedEvents = [...existingEvents, ...newEvents]

  console.log(`新增新聞事件：${newEvents.length} 個`)
  console.log(`合併後總數：${mergedEvents.length} 個`)

  // 寫入檔案
  try {
    const eventPath = path.join(process.cwd(), EVENT_FILE)
    fs.writeFileSync(eventPath, JSON.stringify(mergedEvents, null, 2), 'utf-8')
    console.log(`✅ 已寫入 ${EVENT_FILE}`)
  } catch (err) {
    console.error(`寫入檔案失敗：${err.message}`)
    process.exit(1)
  }

  // 顯示匯入摘要
  console.log('\n匯入摘要：')
  console.log('========')

  const byImpact = {}
  events.forEach(e => {
    byImpact[e.impact] = (byImpact[e.impact] || 0) + 1
  })
  Object.entries(byImpact).forEach(([impact, count]) => {
    console.log(`  ${impact}: ${count}`)
  })

  const byType = {}
  events.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1
  })
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  if (newEvents.length > 0) {
    console.log('\n新增的新聞事件：')
    newEvents.slice(0, 10).forEach(e => {
      console.log(`  - [${e.impact}] ${e.title.slice(0, 50)}... (${e.stocks.join(',')})`)
    })
    if (newEvents.length > 10) {
      console.log(`  ... 還有 ${newEvents.length - 10} 個`)
    }
  }
}

main()
