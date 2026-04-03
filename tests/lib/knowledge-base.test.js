import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  buildKnowledgeContext,
  buildKnowledgeQueryProfile,
  collectInjectedKnowledgeIdsFromDossiers,
  getRelevantCases,
  getRelevantKnowledge,
} from '../../src/lib/knowledgeBase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KB_DIR = join(__dirname, '../../src/lib/knowledge-base')

// 排除 templates 目錄和 index.json
const getCategoryFiles = () => {
  const excludedFiles = new Set([
    'index.json',
    'quality-report-2026-04-01.json',
    'quality-validation.json',
  ])
  return readdirSync(KB_DIR)
    .filter((file) => file.endsWith('.json') && !excludedFiles.has(file))
    .map((file) => join(KB_DIR, file))
}

// 載入所有知識庫分類
const loadAllCategories = () => {
  return getCategoryFiles().map((file) => {
    const content = readFileSync(file, 'utf-8')
    return JSON.parse(content)
  })
}

// 載入所有 items
const loadAllItems = () => {
  const categories = loadAllCategories()
  return categories.flatMap((cat) => cat.items || [])
}

describe('知識庫基礎驗證', () => {
  // 標準知識分類（有 category 和 metadata）
  const getStandardCategories = () => {
    return loadAllCategories().filter((cat) => cat.category && cat.metadata)
  }

  const getStandardItems = () => {
    return getStandardCategories().flatMap((cat) => cat.items || [])
  }

  describe('Schema 驗證', () => {
    const requiredFields = ['id', 'title', 'fact', 'interpretation', 'action', 'tags']
    const optionalFields = ['confidence', 'source'] // strategy-cases 目前沒有這些欄位

    it('每個 entry 都包含所有必要欄位', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        return !requiredFields.every((field) => field in item)
      })

      if (invalidItems.length > 0) {
        console.log(
          'Invalid items:',
          invalidItems.map((i) => ({
            id: i.id,
            missingFields: requiredFields.filter((f) => !(f in i)),
          }))
        )
      }

      expect(invalidItems).toHaveLength(0)
    })

    it('id 欄位必須是唯一', () => {
      const items = getStandardItems()
      const ids = items.map((item) => item.id)
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)

      expect(duplicateIds).toHaveLength(0)
    })

    it('id 格式必須符合分類前綴（如 fa-001, rm-001）', () => {
      const items = getStandardItems()
      const invalidIds = items.filter((item) => {
        const prefix = item.id.split('-')[0]
        const number = item.id.split('-')[1]
        return !prefix || !number || isNaN(parseInt(number))
      })

      expect(invalidIds).toHaveLength(0)
    })
  })

  describe('Confidence 值域驗證', () => {
    it('有 confidence 欄位的 entry 必須在 0-1 之間', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        return (
          item.confidence !== undefined &&
          (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1)
        )
      })

      if (invalidItems.length > 0) {
        console.log(
          'Invalid confidence values:',
          invalidItems.map((i) => ({ id: i.id, confidence: i.confidence }))
        )
      }

      expect(invalidItems).toHaveLength(0)
    })

    it('confidence < 0.5 的 entry 應該被標記為低信心', () => {
      const items = getStandardItems().filter((item) => item.confidence !== undefined)
      const lowConfidenceItems = items.filter((item) => item.confidence < 0.5)

      // 只警告，不失敗
      if (lowConfidenceItems.length > 0) {
        console.log(
          'Low confidence items (< 0.5):',
          lowConfidenceItems.map((i) => ({ id: i.id, confidence: i.confidence, title: i.title }))
        )
      }

      // 低信心項目不應超過總數的 10%
      const ratio = lowConfidenceItems.length / items.length
      if (items.length > 0) {
        expect(ratio).toBeLessThan(0.1)
      }
    })
  })

  describe('Action 欄位品質驗證', () => {
    const vagueActions = ['適時進出', '視情況而定', '自行判斷', '酌情處理']

    it('action 欄位不能是空話或模糊建議', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        const action = item.action || ''
        return vagueActions.some((vague) => action.includes(vague))
      })

      if (invalidItems.length > 0) {
        console.log(
          'Items with vague actions:',
          invalidItems.map((i) => ({
            id: i.id,
            title: i.title,
            action: i.action,
          }))
        )
      }

      expect(invalidItems).toHaveLength(0)
    })

    it('action 欄位應該包含具體操作或量化條件', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        const action = item.action || ''
        // 檢查是否有量化條件（數字、百分比、比較符號）或具體操作（買進、賣出、減碼、停損等）
        const hasQuantifiable =
          /\d+%|\d+倍|\d+元|\d+成|\d+日|\d+天|\d+週|\d+季|\d+年|\d+次|\d+筆|\d+檔|\d+張|>=|<=|>|<|買進|賣出|減碼|加碼|停損|停利|續抱|觀望|警戒|布局|進場|出場|清空/.test(
            action
          )
        return !hasQuantifiable
      })

      if (invalidItems.length > 0) {
        console.log(
          'Items without quantifiable actions:',
          invalidItems
            .map((i) => ({
              id: i.id,
              title: i.title,
              action: i.action,
            }))
            .slice(0, 20)
        ) // 只印前 20 筆
      }

      // 已優化至 1.3%，門檻設為 5% 防止退化
      const ratio = invalidItems.length / items.length
      expect(ratio).toBeLessThan(0.05)
    })
  })

  describe('Tags 欄位驗證', () => {
    it('tags 必須是非空陣列', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        return !Array.isArray(item.tags) || item.tags.length === 0
      })

      expect(invalidItems).toHaveLength(0)
    })

    it('tags 不應該包含空字串', () => {
      const items = getStandardItems()
      const invalidItems = items.filter((item) => {
        return item.tags.some((tag) => !tag || tag.trim() === '')
      })

      expect(invalidItems).toHaveLength(0)
    })
  })

  describe('分類檔案結構驗證', () => {
    it('每個標準分類檔案都應該有 metadata', () => {
      const categories = getStandardCategories()
      const invalidCategories = categories.filter((cat) => {
        return !cat.metadata || !cat.metadata.itemCount
      })

      expect(invalidCategories).toHaveLength(0)
    })

    it('metadata.itemCount 應該與實際 items 數量一致', () => {
      const categories = getStandardCategories()
      const inconsistentCategories = categories.filter((cat) => {
        return cat.metadata.itemCount !== cat.items.length
      })

      if (inconsistentCategories.length > 0) {
        console.log(
          'Inconsistent categories:',
          inconsistentCategories.map((c) => ({
            category: c.category,
            metadata: c.metadata.itemCount,
            actual: c.items.length,
          }))
        )
      }

      expect(inconsistentCategories).toHaveLength(0)
    })
  })

  describe('簡體中文檢查', () => {
    const SIMPLIFIED_PATTERNS = [
      /余额/,
      /个股/,
      /开倉/,
      /杠杆/,
      /季节性/,
      /并且/,
      /关于/,
      /对于/,
      /进行/,
      /这个/,
    ]

    it('所有 entry 不應包含常見簡體字', () => {
      const items = getStandardItems()
      const issues = []
      for (const item of items) {
        for (const field of ['title', 'fact', 'interpretation', 'action']) {
          const val = item[field] || ''
          for (const pat of SIMPLIFIED_PATTERNS) {
            if (pat.test(val)) {
              issues.push({ id: item.id, field, matched: pat.source, text: val.substring(0, 40) })
            }
          }
        }
      }

      if (issues.length > 0) {
        console.log('Simplified Chinese found:', issues)
      }

      expect(issues).toHaveLength(0)
    })
  })

  describe('知識庫統計', () => {
    it('總項目數應該達到目標', () => {
      const items = getStandardItems()
      const categories = getStandardCategories()
      const totalTarget = categories.reduce((sum, cat) => sum + (cat.metadata.targetCount || 0), 0)
      const totalActual = items.length

      console.log(
        `知識庫進度：${totalActual}/${totalTarget} (${Math.round((totalActual / totalTarget) * 100)}%)`
      )

      // 目前應該達到 60% 以上
      expect(totalActual / totalTarget).toBeGreaterThan(0.6)
    })

    it('每個分類的進度應該合理', () => {
      const categories = getStandardCategories()

      categories.forEach((cat) => {
        const progress = cat.items.length / (cat.metadata.targetCount || cat.items.length)
        console.log(
          `${cat.category}: ${cat.items.length}/${cat.metadata.targetCount} (${Math.round(progress * 100)}%)`
        )

        // 允許某些分類還在建設中，但至少要達到 40%
        if (cat.metadata.targetCount > 0) {
          expect(progress).toBeGreaterThan(0.4)
        }
      })
    })
  })
})

describe('knowledgeBase.js 檢索模組', () => {
  describe('buildKnowledgeQueryProfile', () => {
    it('builds short/mid/long horizon profiles from holding period', () => {
      expect(buildKnowledgeQueryProfile({ holdingPeriod: '短' })).toMatchObject({
        technical: 0.4,
        news: 0.3,
      })
      expect(buildKnowledgeQueryProfile({ holdingPeriod: '中長' })).toMatchObject({
        fundamentals: 0.4,
        strategyCases: 0.2,
      })
      expect(buildKnowledgeQueryProfile({ holdingPeriod: '中' })).toMatchObject({
        chip: 0.25,
        fundamentals: 0.3,
      })
    })
  })

  describe('getRelevantKnowledge', () => {
    it('每個策略類型都能回傳結果', () => {
      const strategies = [
        '成長股',
        '景氣循環',
        '事件驅動',
        '權證',
        'ETF指數',
        'ETF/指數',
        '價值投資',
        '價值股',
        '股息成長',
        '轉機股',
        '轉型股',
      ]
      for (const strategy of strategies) {
        const results = getRelevantKnowledge({ strategy })
        expect(results.length).toBeGreaterThan(0)
      }
    })

    it('未知策略也能 fallback 回傳結果', () => {
      const results = getRelevantKnowledge({ strategy: '不存在的策略' })
      expect(results.length).toBeGreaterThan(0)
    })

    it('空 stockMeta 也能正常運作', () => {
      const results = getRelevantKnowledge()
      expect(results.length).toBeGreaterThan(0)
    })

    it('回傳結果都符合最低信心度', () => {
      const results = getRelevantKnowledge({ strategy: '成長股' }, { minConfidence: 0.8 })
      for (const item of results) {
        expect(item.confidence).toBeGreaterThanOrEqual(0.8)
      }
    })

    it('會依 query profile 權重調整選出的知識類型', () => {
      const results = getRelevantKnowledge(
        { strategy: '成長股', holdingPeriod: '短' },
        {
          maxItems: 10,
          minConfidence: 0.6,
          queryProfile: buildKnowledgeQueryProfile({ holdingPeriod: '短' }),
        }
      )
      const hasTechnicalOrNews = results.some(
        (item) => item.id.startsWith('ta-') || item.id.startsWith('nc-')
      )
      expect(hasTechnicalOrNews).toBe(true)
    })

    it('策略知識區段內按信心度降序排列', () => {
      const results = getRelevantKnowledge(
        { strategy: '成長股' },
        { maxItems: 10, minConfidence: 0.6 }
      )
      // 策略知識（非 rm）區段內應降序；rm 區段獨立附加在最後
      const strategyItems = results.filter((r) => !r.id.startsWith('rm-'))
      for (let i = 1; i < strategyItems.length; i++) {
        expect(strategyItems[i].confidence).toBeLessThanOrEqual(strategyItems[i - 1].confidence)
      }
    })

    it('不會有重複 id', () => {
      const results = getRelevantKnowledge(
        { strategy: '事件驅動' },
        { maxItems: 20, minConfidence: 0.6 }
      )
      const ids = results.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('getRelevantCases', () => {
    it('事件驅動策略能取得相關案例', () => {
      const results = getRelevantCases({ strategy: '事件驅動' })
      expect(results.length).toBeGreaterThan(0)
    })

    it('包含失敗案例作為教訓', () => {
      const results = getRelevantCases({ strategy: '成長股' }, { maxItems: 5 })
      const hasFailure = results.some((item) => item.outcome === 'failure')
      // 只要有匹配的失敗案例就應該回傳
      if (results.length >= 2) {
        expect(hasFailure).toBe(true)
      }
    })
  })

  describe('buildKnowledgeContext', () => {
    it('有策略的 stockMeta 能產生非空 context', () => {
      const context = buildKnowledgeContext({ strategy: '事件驅動' })
      expect(context).not.toBe('')
      expect(context).toContain('知識庫參考')
    })

    it('空 stockMeta 能正常運作（不 crash）', () => {
      const context = buildKnowledgeContext()
      expect(typeof context).toBe('string')
    })
  })

  describe('collectInjectedKnowledgeIdsFromDossiers', () => {
    it('collects unique knowledge ids from dossier stock meta selections', () => {
      const itemIds = collectInjectedKnowledgeIdsFromDossiers([
        { stockMeta: { strategy: '事件驅動' } },
        { stockMeta: { strategy: '成長股' } },
        { stockMeta: { strategy: '事件驅動' } },
      ])

      expect(itemIds.length).toBeGreaterThan(0)
      expect(new Set(itemIds).size).toBe(itemIds.length)
    })
  })
})
