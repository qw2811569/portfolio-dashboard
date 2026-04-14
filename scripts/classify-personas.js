// Script to classify all knowledge base rules into 4 personas + shared
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const KB_DIR = join(rootDir, 'src/lib/knowledge-base')
const OUTPUT = join(rootDir, 'data/persona-knowledge-map.json')

// Classification rules per the four-persona design doc
function classifyRule(id, title, tags, category) {
  const tagStr = tags.join(',')
  const titleStr = title

  // === SHARED (universal risk management, psychology, position sizing) ===
  if (category === 'risk-management') return 'shared'

  // Shared keywords in news-correlation
  if (category === 'news-correlation') {
    if (/風險管理|紀律|倉位|避險|原則|心理|情緒管理/.test(tagStr)) return 'shared'
    if (/社群|短線|日內|網路流言|假訊息/.test(tagStr)) return 'scalper'
    if (
      /總經|CPI|GDP|聯準會|地緣政治|貿易戰|大選|兩岸|供應鏈重組|人口|數位轉型|全球景氣|油價|匯率|原物料|國際股市|ESG|氣候|法規|國際標準|專利|訴訟/.test(
        tagStr
      )
    )
      return 'trend'
    if (/估值|本益比|殖利率/.test(tagStr)) return 'value'
    // Most news/event-driven are swing (法人 reaction, earnings, revenue announcements)
    return 'swing'
  }

  // Strategy cases - classify by case content
  if (category === 'strategy-cases') {
    if (/停損|風險管理|資金管理|心理|紀律|情緒|復盤|交易系統|偏誤|行為財務/.test(tagStr))
      return 'shared'
    if (
      /長期持有|價值投資|護城河|高股息|配息|ROE|資本配置|永續|ESG|公司治理|價值陷阱|退休|遺產|教育基金|保險規劃|緊急預備|債務管理|信用管理|稅務|綠色金融|社會責任/.test(
        tagStr
      )
    )
      return 'value'
    if (
      /短線|權證|期貨|選擇權|量化|程式|AI輔助|機器學習|NLP|大數據|區塊鏈|元宇宙|momentum|均值回歸/.test(
        tagStr
      )
    )
      return 'scalper'
    if (
      /投信|外資|主力|作帳|籌碼|事件驅動|營收|財報|利多出盡|產業趨勢|半導體循環|景氣循環|轉機/.test(
        tagStr
      )
    )
      return 'swing'
    // Industry trend cases, AI trend, EV, semiconductor cycle, sector rotation
    if (
      /產業趨勢|AI趨勢|電動車|半導體|被動元件|面板|航運|金融|產業輪動|供應鏈|升息|降息|疫情復甦|資產配置|景氣|循環|成長|趨勢/.test(
        tagStr
      )
    )
      return 'trend'
    // Default: check for long-term value themes
    if (/定期定額|ETF|配置|分散投資|集中投資|停利|等待時機|錯失行情/.test(tagStr)) return 'value'
    return 'trend'
  }

  // Technical analysis -> scalper
  if (category === 'technical-analysis') return 'scalper'

  // Chip analysis -> swing
  if (category === 'chip-analysis') return 'swing'

  // Industry trends -> trend
  if (category === 'industry-trends') return 'trend'

  // Fundamental analysis -> split between trend and value
  if (category === 'fundamental-analysis') {
    // Value-oriented: ROE, ROIC, ROA, DCF, EV/EBITDA, PB, PEG, moat, dividend, free cash flow, long-term valuation
    if (
      /ROE|ROIC|ROA|EVA|杜邦|護城河|股利|配息|殖利率|自由現金流|DCF|折現|EV\/EBITDA|股價淨值比|PB|PEG|價值投資|每股淨值|安全邊際|本業獲利|營業利益率|現金轉換|應計比率|非經常性|股利永續|累積盈虧|股息|PS Ratio|股價營收比|估值/.test(
        tagStr + titleStr
      )
    ) {
      return 'value'
    }
    // Trend-oriented: revenue growth, industry analysis, business cycles, industry KPIs, economic indicators
    return 'trend'
  }

  return 'shared' // fallback
}

const FILES = [
  { file: 'technical-analysis.json', category: 'technical-analysis' },
  { file: 'chip-analysis.json', category: 'chip-analysis' },
  { file: 'fundamental-analysis.json', category: 'fundamental-analysis' },
  { file: 'industry-trends.json', category: 'industry-trends' },
  { file: 'news-correlation.json', category: 'news-correlation' },
  { file: 'risk-management.json', category: 'risk-management' },
  { file: 'strategy-cases.json', category: 'strategy-cases' },
]

const classifications = {}
const stats = { scalper: 0, swing: 0, trend: 0, value: 0, shared: 0 }

for (const { file, category } of FILES) {
  const path = join(KB_DIR, file)
  const data = JSON.parse(readFileSync(path, 'utf-8'))
  const items = data.items || []

  for (const item of items) {
    const persona = classifyRule(item.id, item.title, item.tags || [], category)
    classifications[item.id] = persona
    stats[persona]++
  }
}

const output = {
  _meta: {
    description: '知識庫四人格分類對照表',
    version: '1.0.0',
    createdAt: '2026-04-03',
    totalRules: Object.keys(classifications).length,
    personaCounts: stats,
    personas: {
      scalper: '短線客（1-2週）— 技術面：K線、RSI、均線、成交量、盤口',
      swing: '波段手（1-2月）— 籌碼面：法人買賣超、融資融券、事件催化',
      trend: '趨勢家（3-6月）— 基本面：營收、EPS、PER、產業趨勢、景氣循環',
      value: '價值者（1-5年）— 長期：ROE、現金流、護城河、配息、估值',
      shared: '通用 — 停損、部位管理、風險控制、心理建設',
    },
  },
  classifications,
}

if (!existsSync(join(rootDir, 'data'))) {
  mkdirSync(join(rootDir, 'data'), { recursive: true })
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2))

console.log('Classification complete:')
console.log(`  Total rules: ${Object.keys(classifications).length}`)
for (const [persona, count] of Object.entries(stats)) {
  console.log(`  ${persona}: ${count}`)
}
