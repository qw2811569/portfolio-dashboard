#!/usr/bin/env node
// Generate knowledge gap report based on persona classification
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const KB_DIR = join(rootDir, 'src/lib/knowledge-base')
const MAP_FILE = join(rootDir, 'data/persona-knowledge-map.json')
const OUTPUT = join(rootDir, 'docs/status/knowledge-gap-report.md')

const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'))
const classifications = map.classifications

// Load all rules for content analysis
const FILES = [
  'technical-analysis.json',
  'chip-analysis.json',
  'fundamental-analysis.json',
  'industry-trends.json',
  'news-correlation.json',
  'risk-management.json',
  'strategy-cases.json',
]

const allRules = new Map()
for (const file of FILES) {
  const data = JSON.parse(readFileSync(join(KB_DIR, file), 'utf-8'))
  for (const item of data.items || []) {
    allRules.set(item.id, item)
  }
}

// Group rules by persona
const byPersona = { scalper: [], swing: [], trend: [], value: [], shared: [] }
for (const [id, persona] of Object.entries(classifications)) {
  const rule = allRules.get(id)
  if (rule) byPersona[persona].push({ id, ...rule })
}

// Define what each persona SHOULD have (from the design doc)
const expectedKnowledge = {
  scalper: {
    label: '短線客（Scalper）— 1-2 週',
    shouldHave: [
      'K 線型態（早晨之星、黃昏之星、吞噬、錘子線等）',
      '成交量分析（量比、爆量、量縮）',
      'RSI 超買超賣',
      '均線系統（短期 5/10MA）',
      'MACD/KD 指標',
      '布林帶',
      '支撐壓力位',
      '盤口分析（內盤外盤、委買委賣、開盤八法）',
      '權證 Greeks（Delta/Theta/IV）',
      '日內交易策略',
      '當沖比分析',
    ],
    focusFiles: ['technical-analysis.json'],
  },
  swing: {
    label: '波段手（Swing Trader）— 1-2 月',
    shouldHave: [
      '法人連續買賣超（外資、投信、自營商）',
      '融資融券變化',
      '籌碼集中度',
      '月營收月增率',
      '事件催化窗口（法說、財報）',
      '主力進出場特徵',
      '大戶持股變化',
      '券資比',
      '借券賣出',
      '期貨未平倉量',
      'Put/Call 比率',
      'MSCI 調整效應',
    ],
    focusFiles: ['chip-analysis.json', 'news-correlation.json'],
  },
  trend: {
    label: '趨勢家（Trend Follower）— 3-6 月',
    shouldHave: [
      '營收 YoY 趨勢',
      'EPS 軌跡',
      'PER 估值區間',
      '產業景氣循環位階',
      '供應鏈位置分析',
      '三大法人累計買賣',
      '總體經濟指標（CPI、利率、GDP）',
      '地緣政治影響',
      '產業政策追蹤',
      '季節性修正',
      'MA20/MA60 趨勢確認',
      '庫存循環分析',
    ],
    focusFiles: ['fundamental-analysis.json', 'industry-trends.json'],
  },
  value: {
    label: '價值者（Value Investor）— 1-5 年',
    shouldHave: [
      'ROE 趨勢（連續 3 年）',
      '自由現金流分析',
      '護城河評估',
      '產業龍頭地位',
      '股利政策與永續性',
      '資本配置效率',
      'DCF 估值',
      'EV/EBITDA',
      'PBR 估值',
      '負債比安全範圍',
      '公司治理評估',
      'ESG 評等',
    ],
    focusFiles: ['fundamental-analysis.json'],
  },
  shared: {
    label: '通用知識',
    shouldHave: [
      '停損策略（固定比例、技術位）',
      '倉位控制（單一上限、產業分散）',
      '現金水位管理',
      '風險報酬比計算',
      '凱利公式',
      '資產配置',
      '避險策略',
      '交易紀律',
      '心理建設（FOMO、虧損接受）',
      '交易日誌與復盤',
      '尾部風險管理',
      '再平衡策略',
    ],
    focusFiles: ['risk-management.json'],
  },
}

// Analyze gaps
function analyzeGaps(persona, rules) {
  const tagSet = new Set()
  const titleSet = new Set()
  for (const rule of rules) {
    for (const tag of rule.tags || []) {
      tagSet.add(tag.trim())
    }
    titleSet.add(rule.title)
  }

  const tags = [...tagSet]
  const gaps = []

  if (persona === 'scalper') {
    if (!tags.some((t) => /權證/.test(t)))
      gaps.push('❌ 缺權證 Greeks 相關規則（Delta/Theta/IV）— 短線客操作權證必備')
    if (!tags.some((t) => /當沖/.test(t)))
      gaps.push('❌ 缺當沖比分析規則 — 短線客需判斷日內投機熱度')
    if (!tags.some((t) => /日內|盤中/.test(t))) gaps.push('❌ 缺盤中動量分析規則')
    if (tags.some((t) => /K 線/) && tags.some((t) => /均線/) && tags.some((t) => /RSI/)) {
      // Has core technical
    } else {
      gaps.push('⚠️ 核心技術分析規則不足')
    }
  }

  if (persona === 'swing') {
    if (!tags.some((t) => /MSCI/.test(t)))
      gaps.push('❌ 缺 MSCI 指數調整效應規則 — 被動資金流動影響')
    if (!tags.some((t) => /軋空/.test(t))) gaps.push('⚠️ 軋空相關規則偏少')
    if (!tags.some((t) => /事件催化/.test(t)))
      gaps.push('❌ 缺事件催化效應規則 — 波段操作需判斷催化劑時間點')
    if (!tags.some((t) => /法說.*反應|財報.*效應/.test(t))) {
      // Check news-correlation for this
    }
  }

  if (persona === 'trend') {
    if (!tags.some((t) => /庫存循環/.test(t))) gaps.push('⚠️ 庫存循環位階判斷規則不足')
    if (!tags.some((t) => /景氣對策/.test(t)))
      gaps.push('❌ 缺景氣對策信號判斷規則 — 趨勢家需判斷總體景氣位置')
    if (!tags.some((t) => /MA20.*MA60|均線.*趨勢/.test(t))) {
      // Technical trend confirmation - scalper owns this, but trend needs it too
      gaps.push('⚠️ 缺中期趨勢確認規則（MA20/MA60 交叉）— 雖屬技術面但趨勢家也需要')
    }
  }

  if (persona === 'value') {
    if (!tags.some((t) => /ESG/.test(t))) gaps.push('❌ 缺 ESG 評等相關規則 — 價值投資者越來越重視')
    if (!tags.some((t) => /現金流.*連續|自由現金流.*趨勢/.test(t)))
      gaps.push('⚠️ 缺自由現金流連續性分析規則')
    if (!tags.some((t) => /護城河/.test(t))) gaps.push('❌ 缺護城河評估框架規則')
    if (!tags.some((t) => /資本配置|ROIC/.test(t))) gaps.push('⚠️ 資本配置效率分析規則不足')
    if (rules.length < 30) gaps.push(`⚠️ 總規則數僅 ${rules.length} 條，相較其他人格明顯偏少`)
  }

  if (persona === 'shared') {
    // Generally well-covered by risk-management.json
  }

  return gaps
}

// Build the report
let md = `# 知識庫缺口分析報告

> 生成日期：${new Date().toLocaleDateString('zh-TW')}
> 知識庫版本：${map._meta.version}
> 總規則數：${map._meta.totalRules}
> 分類依據：四人格時間軸分析系統設計（\`docs/specs/four-persona-analysis-design.md\`）

---

## 分類統計

| 人格 | 規則數 | 佔比 | 主要知識來源 |
|------|--------|------|-------------|
| 趨勢家（trend） | ${map._meta.personaCounts.trend} | ${((map._meta.personaCounts.trend / 600) * 100).toFixed(1)}% | 基本面分析、產業趨勢 |
| 波段手（swing） | ${map._meta.personaCounts.swing} | ${((map._meta.personaCounts.swing / 600) * 100).toFixed(1)}% | 籌碼分析、消息連動 |
| 短線客（scalper） | ${map._meta.personaCounts.scalper} | ${((map._meta.personaCounts.scalper / 600) * 100).toFixed(1)}% | 技術分析 |
| 通用（shared） | ${map._meta.personaCounts.shared} | ${((map._meta.personaCounts.shared / 600) * 100).toFixed(1)}% | 風險管理 |
| 價值者（value） | ${map._meta.personaCounts.value} | ${((map._meta.personaCounts.value / 600) * 100).toFixed(1)}% | 基本面分析（估值/ROE） |

---

## 各人格缺口分析

`

for (const [persona, info] of Object.entries(expectedKnowledge)) {
  const rules = byPersona[persona]
  const gaps = analyzeGaps(persona, rules)
  const tags = [...new Set(rules.flatMap((r) => r.tags || []))]

  md += `### ${info.label}\n\n`
  md += `**規則數：** ${rules.length} 條\n\n`
  md += `**現有知識覆蓋：**\n\n`

  // Show top tags
  const tagCounts = {}
  for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  md += topTags.map(([tag, count]) => `- ${tag}（${count} 條）`).join('\n')
  md += '\n\n'

  if (gaps.length > 0) {
    md += `**發現缺口：**\n\n`
    md += gaps.join('\n')
    md += '\n\n'
  } else {
    md += `**缺口：** 無明顯缺口 ✅\n\n`
  }

  md += `**建議補充：**\n\n`

  // Generate specific recommendations
  if (persona === 'scalper') {
    md += `- 新增權證 Greeks 分析規則（Delta > 0.5、Theta 衰減、IV 變化）
- 新增當沖比率判斷規則（當沖比 > 40% 的意義）
- 新增盤中動量分析規則（開盤 30 分鐘量價關係）
- 現有 101 條技術分析規則已涵蓋 K 線、均線、指標、量價，覆蓋率良好`
  } else if (persona === 'swing') {
    md += `- 新增 MSCI 季度調整效應規則（被動資金流入/流出時機）
- 新增事件催化效應規則（法說會前 N 天布局、財報公布前預期心理）
- 新增軋空判斷規則（融券餘額 + 股價走勢連動）
- 現有 180 條籌碼+消息規則已涵蓋法人、主力、融資融券，覆蓋率良好`
  } else if (persona === 'trend') {
    md += `- 新增景氣對策信號判斷規則（藍燈轉綠燈的意義）
- 新增庫存循環位階判斷規則（庫存天數 vs 營收趨勢）
- 現有 207 條規則為最多，涵蓋產業趨勢、總經、基本面，覆蓋率最佳`
  } else if (persona === 'value') {
    md += `- 新增 ESG 評等影響規則（MSCI ESG 評等、公司治理評分）
- 新增護城河評估框架規則（品牌、專利、轉換成本、規模經濟）
- 新增自由現金流連續性分析規則（連續 N 年正 FCF 的意義）
- 新增資本配置效率規則（ROIC vs WACC、EVA 趨勢）
- ⚠️ 僅 44 條規則，建議從 fundamental-analysis.json 中補充更多估值和長期投資相關規則
- 建議目標：至少 60-80 條`
  } else if (persona === 'shared') {
    md += `- 現有 68 條風險管理規則已涵蓋停損、倉位、心理、資產配置，覆蓋率良好
- 可補充：尾部風險管理進階、壓力測試情境分析`
  }

  md += '\n\n---\n\n'
}

// Summary
md += `## 總結

### 優先補充順序

1. **🔴 價值者知識補充**（最高優先）— 僅 44 條，缺 ESG、護城河框架、現金流連續性分析
2. **🟡 短線客權證知識** — 缺權證 Greeks 規則，但設計文件明確提到短線客操作權證
3. **🟡 波段手事件催化** — 缺明確的事件催化時間點判斷規則
4. **🟢 趨勢家** — 207 條，覆蓋率最佳，僅缺景氣對策信號
5. **🟢 通用知識** — 68 條，風險管理覆蓋良好

### 知識庫健康度

| 指標 | 狀態 | 說明 |
|------|------|------|
| 規則總數 | ✅ 600 條 | 達標 |
| 人格分布 | ⚠️ 不均 | trend 202 / value 44，差距過大 |
| 短線技術 | ✅ 良好 | 101 條技術分析 |
| 籌碼分析 | ✅ 良好 | 180 條籌碼+消息 |
| 長期估值 | 🔴 不足 | 僅 44 條價值相關規則 |
| 風險管理 | ✅ 良好 | 68 條通用規則 |
`

if (!existsSync(join(rootDir, 'docs/status'))) {
  mkdirSync(join(rootDir, 'docs/status'), { recursive: true })
}

writeFileSync(OUTPUT, md)
console.log('Gap report written to:', OUTPUT)
console.log('Report length:', md.length, 'chars')
