#!/usr/bin/env node
/**
 * 知識庫品質驗證腳本
 *
 * 對每個知識條目進行五維評分：
 * - actionability (0.30): 是否有具體可執行動作
 * - specificity (0.25): 是否有量化條件或具體門檻
 * - verifiability (0.20): 是否可驗證/可證偽
 * - reusability (0.15): 是否可重複使用（非單一事件）
 * - sourceQuality (0.10): 來源是否可靠
 *
 * 輸出：
 * - 總分 < 60 的條目清單（需優先改進）
 * - 各分類平均分數
 * - 低分原因分析
 */

import fs from 'fs'
import path from 'path'

const KNOWLEDGE_DIR = './src/lib/knowledge-base'
const EXCLUDE_FILES = ['index.json', 'quality-validation.json']

// 評分權重
const WEIGHTS = {
  actionability: 0.3,
  specificity: 0.25,
  verifiability: 0.2,
  reusability: 0.15,
  sourceQuality: 0.1,
}

// 模糊行動詞（應避免）
const VAGUE_ACTION_WORDS = [
  '觀察',
  '注意',
  '留意',
  '檢視',
  '等待',
  '適時',
  '酌情',
  '可能',
  '或許',
  '也許',
  '建議',
  '可以',
  '考慮',
  '視情況',
  '看狀況',
  '再說',
  '後續',
  '持續關注',
]

// 具體行動詞（應鼓勵）
const CONCRETE_ACTION_WORDS = [
  '買進',
  '賣出',
  '減碼',
  '加碼',
  '停損',
  '停利',
  '進場',
  '出場',
  '持有',
  '退出',
  '布局',
  '避險',
  '=',
  '>',
  '<',
  '≥',
  '≤',
  '%',
  '倍',
  '張',
  '元',
]

// 量化指標（應鼓勵）
const QUANTIFIABLE_PATTERNS = [
  /\d+%/, // 百分比
  /\d+ 倍/, // 倍數
  /\d+ 張/, // 張數
  /\d+ 元/, // 金額
  /\d+ 日/, // 天數
  /\d+ 週/, // 週數
  /\d+ 月/, // 月數
  /\d+ 季/, // 季數
  /\d+ 年/, // 年數
  /<\s*\d+/, // 小於
  />\s*\d+/, // 大於
  /超過\d+/, // 超過
  /低於\d+/, // 低於
]

/**
 * 評分：actionability (可執行性)
 * 標準：
 * - 有明確買賣訊號：100
 * - 有方向但無具體門檻：70
 * - 只有模糊建議：40
 * - 無行動建議：0
 */
function scoreActionability(item) {
  const action = item.action || ''
  if (!action || action.trim() === '') return 0

  // 檢查是否有具體行動詞
  const hasConcreteAction = CONCRETE_ACTION_WORDS.some((word) => action.includes(word))
  const hasVagueAction = VAGUE_ACTION_WORDS.some((word) => action.includes(word))

  if (hasConcreteAction && !hasVagueAction) {
    return 90 + Math.random() * 10 // 90-100
  }
  if (hasConcreteAction && hasVagueAction) {
    return 70 + Math.random() * 10 // 70-80
  }
  if (hasVagueAction && !hasConcreteAction) {
    return 30 + Math.random() * 20 // 30-50
  }
  return 50 + Math.random() * 10 // 50-60 (中性)
}

/**
 * 評分：specificity (具體性)
 * 標準：
 * - 有 3 個以上量化指標：100
 * - 有 2 個量化指標：80
 * - 有 1 個量化指標：60
 * - 無量化指標：30
 */
function scoreSpecificity(item) {
  const text = JSON.stringify(item)
  const matches = QUANTIFIABLE_PATTERNS.reduce((count, pattern) => {
    return count + (text.match(pattern) || []).length
  }, 0)

  if (matches >= 3) return 90 + Math.random() * 10
  if (matches === 2) return 75 + Math.random() * 10
  if (matches === 1) return 55 + Math.random() * 10
  return 20 + Math.random() * 20
}

/**
 * 評分：verifiability (可驗證性)
 * 標準：
 * - 有明確驗證條件和時間框架：100
 * - 有驗證條件但無時間框架：70
 * - 難以驗證：40
 */
function scoreVerifiability(item) {
  const text = JSON.stringify(item)
  let score = 50

  // 有明確數字門檻
  if (QUANTIFIABLE_PATTERNS.some((p) => p.test(text))) {
    score += 20
  }

  // 有時間框架
  if (/(日 | 週 | 月 | 季 | 年| 天 | 小時| 分鐘)/.test(text)) {
    score += 15
  }

  // 有條件判斷（如果...則...）
  if (/(=|若 | 則 | 時 | 才| 就)/.test(text)) {
    score += 15
  }

  return Math.min(100, score + Math.random() * 5)
}

/**
 * 評分：reusability (可重複使用性)
 * 標準：
 * - 通用規則（非單一事件）：100
 * - 適用於特定情境：70
 * - 單一事件/特定時點：30
 */
function scoreReusability(item) {
  const text = JSON.stringify(item)
  const title = item.title || ''

  // 單一事件特徵
  const singleEventPatterns = [
    /20\d{2} 年/, // 特定年份
    /第 [一二三四五六七八九十]+ 季/, // 特定季度
    /特定事件/,
    /個案/,
  ]

  const isSingleEvent = singleEventPatterns.some((p) => p.test(text))

  // 策略案例通常可重複使用性較低（但仍有參考價值）
  if (title.includes('成功案例') || title.includes('失敗案例')) {
    return 60 + Math.random() * 20 // 60-80
  }

  if (isSingleEvent) {
    return 30 + Math.random() * 20 // 30-50
  }

  return 80 + Math.random() * 15 // 80-95
}

/**
 * 評分：sourceQuality (來源品質)
 * 標準：
 * - 有明確來源且為權威：100
 * - 有來源但不明確：70
 * - 無來源：40
 */
function scoreSourceQuality(item) {
  if (!item.source) return 40

  const authoritativeSources = [
    '財報分析',
    '技術分析',
    '產業分析',
    '風險管理',
    '行為金融',
    '資金管理',
    '總體經濟',
  ]

  const hasAuthoritativeSource = authoritativeSources.some((s) => item.source.includes(s))

  if (hasAuthoritativeSource) {
    return 85 + Math.random() * 10
  }

  return 60 + Math.random() * 15
}

/**
 * 計算總分
 */
function calculateTotalScore(item) {
  const scores = {
    actionability: scoreActionability(item),
    specificity: scoreSpecificity(item),
    verifiability: scoreVerifiability(item),
    reusability: scoreReusability(item),
    sourceQuality: scoreSourceQuality(item),
  }

  const total =
    scores.actionability * WEIGHTS.actionability +
    scores.specificity * WEIGHTS.specificity +
    scores.verifiability * WEIGHTS.verifiability +
    scores.reusability * WEIGHTS.reusability +
    scores.sourceQuality * WEIGHTS.sourceQuality

  return { scores, total }
}

/**
 * 主程式
 */
function main() {
  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith('.json') && !EXCLUDE_FILES.includes(f))

  const allResults = []
  const categoryStats = {}

  files.forEach((file) => {
    const filePath = path.join(KNOWLEDGE_DIR, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const categoryName = file.replace('.json', '')

    categoryStats[categoryName] = {
      total: 0,
      count: 0,
      lowScoreItems: [],
    }
    ;(data.items || []).forEach((item) => {
      const { scores, total } = calculateTotalScore(item)
      const result = {
        id: item.id,
        title: item.title,
        category: categoryName,
        confidence: item.confidence,
        scores,
        total: Math.round(total),
      }

      allResults.push(result)
      categoryStats[categoryName].total += total
      categoryStats[categoryName].count += 1

      if (total < 60) {
        categoryStats[categoryName].lowScoreItems.push(result)
      }
    })
  })

  // 輸出結果
  console.log('=== 知識庫品質驗證報告 ===\n')

  // 1. 總覽
  const avgScore = allResults.reduce((sum, r) => sum + r.total, 0) / allResults.length
  const lowScoreItems = allResults.filter((r) => r.total < 60)
  const criticalItems = allResults.filter((r) => r.total < 50)

  console.log(`總條目數：${allResults.length}`)
  console.log(`平均分數：${Math.round(avgScore)}`)
  console.log(
    `低分條目 (<60): ${lowScoreItems.length} (${((lowScoreItems.length / allResults.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `危急條目 (<50): ${criticalItems.length} (${((criticalItems.length / allResults.length) * 100).toFixed(1)}%)\n`
  )

  // 2. 各分類統計
  console.log('=== 各分類統計 ===\n')
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const avg = stats.count > 0 ? stats.total / stats.count : 0
    console.log(`${category}:`)
    console.log(
      `  平均：${Math.round(avg)} | 條目：${stats.count} | 低分：${stats.lowScoreItems.length}`
    )
  })

  // 3. 低分條目清單
  console.log('\n=== 低分條目清單 (<60 分) ===\n')
  if (lowScoreItems.length === 0) {
    console.log('恭喜！沒有低分條目。')
  } else {
    lowScoreItems
      .sort((a, b) => a.total - b.total)
      .slice(0, 20)
      .forEach((item) => {
        console.log(`[${item.id}] ${item.title}`)
        console.log(`  分類：${item.category} | 總分：${item.total}`)
        console.log(
          `  細項：actionability=${Math.round(item.scores.actionability)}, specificity=${Math.round(item.scores.specificity)}, verifiability=${Math.round(item.scores.verifiability)}, reusability=${Math.round(item.scores.reusability)}, sourceQuality=${Math.round(item.scores.sourceQuality)}`
        )
        console.log('')
      })

    if (lowScoreItems.length > 20) {
      console.log(`... 還有 ${lowScoreItems.length - 20} 個低分條目`)
    }
  }

  // 4. 輸出 JSON 報告
  const reportPath = './src/lib/knowledge-base/quality-validation.json'
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalItems: allResults.length,
      avgScore: Math.round(avgScore),
      lowScoreCount: lowScoreItems.length,
      criticalCount: criticalItems.length,
    },
    categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      avgScore: Math.round((stats.total / stats.count) * 10) / 10,
      itemCount: stats.count,
      lowScoreCount: stats.lowScoreItems.length,
    })),
    lowScoreItems: lowScoreItems.map((item) => ({
      ...item,
      scores: Object.fromEntries(Object.entries(item.scores).map(([k, v]) => [k, Math.round(v)])),
    })),
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n完整報告已寫入：${reportPath}`)

  // 返回退出碼（有危急條目時返回 1）
  if (criticalItems.length > 0) {
    process.exit(1)
  }
}

main()
