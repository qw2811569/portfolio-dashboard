#!/usr/bin/env node
/**
 * 匯入 Gemini 蒐集的事件行事曆到系統
 * 
 * 使用方式：
 * node scripts/import-gemini-events.js docs/gemini-research/event-calendar-2026-04-01.json
 */

import fs from 'fs'
import path from 'path'

const EVENT_FILE = 'src/data/events.json'

function main() {
  const inputFile = process.argv[2]
  if (!inputFile) {
    console.error('請提供輸入檔案路徑')
    console.error('使用方式：node scripts/import-gemini-events.js <event-calendar-*.json>')
    process.exit(1)
  }

  // 讀取 Gemini 事件檔案
  let geminiData
  try {
    geminiData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } catch (err) {
    console.error(`讀取檔案失敗：${err.message}`)
    process.exit(1)
  }

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
