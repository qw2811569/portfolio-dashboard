#!/usr/bin/env node
/**
 * 匯入 Gemini 蒐集的結構化資料到系統
 * 
 * 支援的類型：
 * - event-calendar-*.json → 匯入事件系統
 * - target-price-*.json → 更新 src/seedData.js 的 INIT_TARGETS
 * - news-*.json → 匯入為新聞事件（如果有 impact: positive/negative）
 * 
 * 使用方式：
 * node scripts/import-gemini-research.js <type> <file.json>
 * 
 * 範例：
 * node scripts/import-gemini-research.js events docs/gemini-research/event-calendar-2026-04-01.json
 * node scripts/import-gemini-research.js targets docs/gemini-research/target-price-2026-04-01.json
 */

import fs from 'fs'
import path from 'path'

const EVENT_FILE = 'src/data/events.json'
const SEED_FILE = 'src/seedData.js'

function main() {
  const [type, inputFile] = process.argv.slice(2)
  
  if (!type || !inputFile) {
    console.error('請提供類型和檔案路徑')
    console.error('使用方式：node scripts/import-gemini-research.js <type> <file.json>')
    console.error('類型：events, targets, news')
    process.exit(1)
  }

  // 讀取 Gemini 檔案
  let geminiData
  try {
    geminiData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } catch (err) {
    console.error(`讀取檔案失敗：${err.message}`)
    process.exit(1)
  }

  console.log(`匯入類型：${type}`)
  console.log(`檔案：${inputFile}`)

  switch (type) {
    case 'events':
      importEvents(geminiData)
      break
    case 'targets':
      importTargets(geminiData)
      break
    case 'news':
      importNews(geminiData)
      break
    default:
      console.error(`未知類型：${type}`)
      console.error('支援的類型：events, targets, news')
      process.exit(1)
  }
}

function importEvents(geminiData) {
  const facts = geminiData.facts || []
  console.log(`讀取到 ${facts.length} 個事件`)

  // 過濾掉沒有日期或 eventType 的事件
  const validEvents = facts.filter(f => f.date && f.eventType && f.confidence === 'confirmed')
  console.log(`有效事件：${validEvents.length} 個`)

  // 轉換為系統格式
  const events = validEvents.map((fact, index) => ({
    id: `gemini-${fact.code}-${fact.date}-${index}`,
    code: fact.code,
    name: fact.name,
    date: fact.date,
    title: `${fact.name} ${fact.eventType}`,
    detail: `來源：${fact.source || 'Gemini 蒐集'}`,
    type: mapEventType(fact.eventType),
    source: 'gemini-research',
    status: 'pending',
    pred: 'neutral',
    predReason: '',
    actual: null,
    actualNote: '',
    lessons: '',
    exitDate: null,
    priceAtEvent: null,
    priceAtExit: null,
    priceHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  console.log(`轉換完成：${events.length} 個事件`)

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

  console.log(`新增事件：${newEvents.length} 個`)
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
  const byType = {}
  events.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1
  })
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  if (newEvents.length > 0) {
    console.log('\n新增的事件：')
    newEvents.slice(0, 10).forEach(e => {
      console.log(`  - ${e.code} ${e.name}: ${e.date} ${e.title}`)
    })
    if (newEvents.length > 10) {
      console.log(`  ... 還有 ${newEvents.length - 10} 個`)
    }
  }
}

function importTargets(geminiData) {
  const facts = geminiData.facts || []
  console.log(`讀取到 ${facts.length} 個目標價`)

  // 讀取 seedData.js
  let seedData = fs.readFileSync(path.join(process.cwd(), SEED_FILE), 'utf-8')

  let updatedCount = 0
  facts.forEach(fact => {
    if (!fact.code || !fact.target || fact.confidence !== 'confirmed') return

    // 找到該股票的區塊
    const stockRegex = new RegExp(`(${fact.code}:\\s*\\{[^}]*reports:\\s*\\[)([^\\]]*)(\\][^}]*updatedAt:\\s*')[^']*('[^}]*\\})`, 's')
    const match = seedData.match(stockRegex)

    if (match) {
      const before = match[1]
      const reports = match[2]
      const after = match[3] + match[4]

      // 新增 Gemini 的目標價報告
      const newReport = `{ firm: '${fact.firm}', target: ${fact.target}, date: '${fact.date.replace(/-/g, '/')}' }`
      const updatedReports = reports.trim() + ',\n      ' + newReport

      // 更新 updatedAt 為今天
      const today = new Date()
      const todayStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`

      const updatedStock = before + updatedReports + after.replace(/updatedAt:\s*'[^']*'/, `updatedAt: '${todayStr}'`)

      seedData = seedData.replace(stockRegex, updatedStock)
      updatedCount++
      console.log(`✓ ${fact.code} ${fact.name}: 新增 ${fact.firm} 目標價 ${fact.target}`)
    } else {
      console.log(`? ${fact.code} ${fact.name}: 找不到區塊，跳過`)
    }
  })

  // 寫入更新後的檔案
  fs.writeFileSync(path.join(process.cwd(), SEED_FILE), seedData)
  console.log(`\n✅ 已更新 ${updatedCount} 檔持股的目標價`)
}

function importNews(geminiData) {
  const facts = geminiData.facts || []
  console.log(`讀取到 ${facts.length} 則新聞`)

  // 過濾有 impact 的新聞
  const validNews = facts.filter(f => f.impact === 'positive' || f.impact === 'negative')
  console.log(`有效新聞（有 impact）：${validNews.length} 個`)

  if (validNews.length === 0) {
    console.log('沒有需要匯入的新聞')
    return
  }

  // 轉換為系統格式（作為事件）
  const events = validNews.map((fact, index) => ({
    id: `gemini-news-${index}`,
    code: fact.code || 'NEWS',
    name: fact.title?.slice(0, 20) || '新聞',
    date: fact.date || new Date().toISOString().slice(0, 10),
    title: fact.title,
    detail: fact.summary || fact.snippet || '',
    type: 'news',
    source: 'gemini-research',
    status: 'pending',
    pred: fact.impact === 'positive' ? 'up' : 'down',
    predReason: fact.reason || '',
    stocks: fact.stocks || [],
    citation: fact.source,
  }))

  console.log(`轉換完成：${events.length} 個新聞事件`)

  // 讀取現有事件
  let existingEvents = []
  try {
    const eventPath = path.join(process.cwd(), EVENT_FILE)
    if (fs.existsSync(eventPath)) {
      existingEvents = JSON.parse(fs.readFileSync(eventPath, 'utf-8'))
    }
  } catch (err) {
    console.warn(`讀取現有事件失敗：${err.message}`)
  }

  // 合併事件
  const existingIds = new Set(existingEvents.map(e => e.id))
  const newEvents = events.filter(e => !existingIds.has(e.id))
  const mergedEvents = [...existingEvents, ...newEvents]

  console.log(`新增新聞事件：${newEvents.length} 個`)

  // 寫入檔案
  try {
    const eventPath = path.join(process.cwd(), EVENT_FILE)
    fs.writeFileSync(eventPath, JSON.stringify(mergedEvents, null, 2), 'utf-8')
    console.log(`✅ 已寫入 ${EVENT_FILE}`)
  } catch (err) {
    console.error(`寫入檔案失敗：${err.message}`)
    process.exit(1)
  }
}

function mapEventType(geminiType) {
  const map = {
    '法說會': '法說會',
    '股東常會': '股東會',
    '股東會': '股東會',
    '股東會 (董事會代行)': '股東會',
    '財報發布': '財報',
    '除權息': '除權息',
  }
  return map[geminiType] || '其他'
}

main()
