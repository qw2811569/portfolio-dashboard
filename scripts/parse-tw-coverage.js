#!/usr/bin/env node
/**
 * Parse My-TW-Coverage Markdown reports → supplyChain.json + themeMapping.json
 *
 * Source: https://github.com/Timeverse/My-TW-Coverage
 * Usage: node scripts/parse-tw-coverage.js /tmp/tw-coverage
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_DIR = process.argv[2] || '/tmp/tw-coverage'

// Our holdings (from STOCK_META)
const HOLDINGS = {
  '1503': '士電',
  '1717': '長興',
  '2308': '台達電',
  '2313': '華通',
  '2543': '皇昌',
  '3006': '晶豪科',
  '3013': '晟銘電',
  '3017': '奇鋐',
  '3231': '緯創',
  '3443': '創意',
  '3491': '昇達科',
  '4583': '台灣精銳',
  '6274': '台燿',
  '6770': '力積電',
  '6862': '三集瑞-KY',
  '8227': '巨有科技',
  // underlyings
  '4979': '華星光',
  '6139': '亞翔',
}

// ─── Markdown Parser ───

function extractWikilinks(text) {
  const matches = text.match(/\[\[([^\]]+)\]\]/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))]
}

function parseSection(md, sectionName) {
  const regex = new RegExp(`^##\\s+${sectionName}`, 'm')
  const match = md.match(regex)
  if (!match) return ''
  const start = match.index + match[0].length
  const nextSection = md.slice(start).match(/^##\s+/m)
  const end = nextSection ? start + nextSection.index : md.length
  return md.slice(start, end).trim()
}

function parseMeta(md) {
  const sector = md.match(/\*\*板塊:\*\*\s*(.+)/)?.[1]?.trim() || ''
  const industry = md.match(/\*\*產業:\*\*\s*(.+)/)?.[1]?.trim() || ''
  return { sector, industry }
}

function parseSupplyChainSection(text) {
  // Extract upstream, midstream, downstream blocks
  const result = { upstream: [], midstream: [], downstream: [] }

  // Find labeled sub-sections like **上游 (...):**
  const upMatch = text.match(/\*\*上游[^*]*\*\*/i)
  const midMatch = text.match(/\*\*中游[^*]*\*\*/i)
  const downMatch = text.match(/\*\*下游[^*]*\*\*/i)

  // Also handle inline format: "**上游:** ..."
  const upInline = text.match(/\*\*?上游[：:]?\*\*?\s*(.+?)(?=\*\*?[中下]游|$)/s)
  const downInline = text.match(/\*\*?下游[：:]?\*\*?\s*(.+?)(?=\*\*?[中上]游|$)/s)

  function extractEntities(block) {
    if (!block) return []
    const entities = []
    const wikilinks = extractWikilinks(block)
    // Extract bullet points with descriptions
    const bullets = block.match(/[-*]\s+\*\*(.+?)\*\*[：:]\s*(.+)/g) || []
    for (const bullet of bullets) {
      const m = bullet.match(/[-*]\s+\*\*(.+?)\*\*[：:]\s*(.+)/)
      if (m) {
        const label = m[1].trim()
        const desc = m[2].trim()
        const links = extractWikilinks(desc)
        for (const link of links) {
          entities.push({ name: link, product: label, context: desc })
        }
        if (links.length === 0 && !label.includes('**')) {
          entities.push({ name: label, product: '', context: desc })
        }
      }
    }
    // Also get standalone wikilinks not captured in bullets
    for (const wl of wikilinks) {
      if (!entities.some(e => e.name === wl)) {
        entities.push({ name: wl, product: '', context: '' })
      }
    }
    return entities
  }

  if (upMatch) {
    const upStart = upMatch.index + upMatch[0].length
    const nextBlock = text.slice(upStart).match(/\*\*[中下]游/i)
    const upEnd = nextBlock ? upStart + nextBlock.index : text.length
    result.upstream = extractEntities(text.slice(upStart, upEnd))
  } else if (upInline) {
    result.upstream = extractEntities(upInline[1])
  }

  if (downMatch) {
    const downStart = downMatch.index + downMatch[0].length
    const nextBlock = text.slice(downStart).match(/\*\*[上中]游/i)
    const downEnd = nextBlock ? downStart + nextBlock.index : text.length
    result.downstream = extractEntities(text.slice(downStart, downEnd))
  } else if (downInline) {
    result.downstream = extractEntities(downInline[1])
  }

  return result
}

function parseCustomersSuppliers(text) {
  const customers = []
  const suppliers = []

  const custSection = text.match(/###\s*主要客戶\s*([\s\S]*?)(?=###|$)/)?.[1] || ''
  const suppSection = text.match(/###\s*主要供應商\s*([\s\S]*?)(?=###|$)/)?.[1] || ''

  function extractNames(block) {
    const wikilinks = extractWikilinks(block)
    // Also extract bold names that aren't wikilinks
    const boldNames = block.match(/\*\*(.+?)\*\*/g) || []
    const names = [...wikilinks]
    for (const b of boldNames) {
      const name = b.replace(/\*\*/g, '').trim()
      if (!names.includes(name) && !name.includes(':') && !name.includes('：')) {
        names.push(name)
      }
    }
    return names
  }

  // Parse customer bullets for richer data
  const custBullets = custSection.match(/[-*]\s+\*\*(.+?)\*\*[：:]\s*(.+)/g) || []
  for (const bullet of custBullets) {
    const m = bullet.match(/[-*]\s+\*\*(.+?)\*\*[：:]\s*(.+)/)
    if (m) {
      const links = extractWikilinks(m[2])
      const desc = m[2].replace(/\[\[([^\]]+)\]\]/g, '$1').trim()
      for (const link of links) {
        customers.push({ name: link, relationship: 'customer', product: desc })
      }
    }
  }

  // Also get any wikilinks in customer section not yet captured
  const allCustLinks = extractWikilinks(custSection)
  for (const link of allCustLinks) {
    if (!customers.some(c => c.name === link)) {
      customers.push({ name: link, relationship: 'customer', product: '' })
    }
  }

  const allSuppLinks = extractWikilinks(suppSection)
  for (const link of allSuppLinks) {
    suppliers.push({ name: link, relationship: 'supplier', product: '' })
  }

  return {
    customers: customers.map(c => c.name),
    suppliers: suppliers.map(s => s.name),
    customerDetails: customers,
    supplierDetails: suppliers,
  }
}

function parseReport(filePath) {
  const md = fs.readFileSync(filePath, 'utf-8')
  // Handle both "# 3017 - 奇鋐" and "# 6770_力積電" formats
  const codeMatch = md.match(/^#\s*(\d+)\s*[-_]\s*(.+)/m)
  if (!codeMatch) return null

  const code = codeMatch[1]
  const name = codeMatch[2].replace(/\[\[|\]\]/g, '').trim()

  const meta = parseMeta(md)
  const supplySection = parseSection(md, '供應鏈位置')
  const custSuppSection = parseSection(md, '主要客戶及供應商')

  const supplyChain = parseSupplyChainSection(supplySection)
  const custSupp = parseCustomersSuppliers(custSuppSection)

  // Extract all wikilinks from the entire document for relationship mapping
  const allLinks = extractWikilinks(md)

  return {
    code,
    name,
    sector: meta.sector,
    industry: meta.industry,
    upstream: supplyChain.upstream,
    downstream: supplyChain.downstream,
    customers: custSupp.customers,
    suppliers: custSupp.suppliers,
    customerDetails: custSupp.customerDetails,
    supplierDetails: custSupp.supplierDetails,
    allWikilinks: allLinks,
  }
}

// ─── Theme Parser ───

function parseThemes() {
  const themesDir = path.join(REPO_DIR, 'Themes')
  if (!fs.existsSync(themesDir)) return {}

  const themeMapping = {}
  const files = fs.readdirSync(themesDir).filter(f => f.endsWith('.md') && f !== 'README.md')

  for (const file of files) {
    const themeName = path.basename(file, '.md')
    const content = fs.readFileSync(path.join(themesDir, file), 'utf-8')

    // Extract stock codes mentioned in the theme
    const codeMatches = content.match(/\*\*(\d{4})\s+.+?\*\*/g) || []
    const codes = codeMatches.map(m => m.match(/\*\*(\d{4})/)?.[1]).filter(Boolean)

    // Find which of our holdings are in this theme
    const holdingCodes = codes.filter(c => HOLDINGS[c])
    if (holdingCodes.length > 0) {
      for (const code of holdingCodes) {
        if (!themeMapping[code]) themeMapping[code] = []

        // Extract position (上游/中游/下游) for this code
        const posRegex = new RegExp(`##\\s+(上游|中游|下游)[^#]*?\\*\\*${code}\\s`, 's')
        const posMatch = content.match(posRegex)
        const position = posMatch ? posMatch[1] : null

        themeMapping[code].push({
          theme: themeName,
          position: position,
        })
      }
    }
  }

  return themeMapping
}

// ─── Build supplyChain.json entries ───

function buildSupplyChainEntry(parsed) {
  const entry = {
    name: parsed.name,
    sector: parsed.sector || 'Technology',
    industry: parsed.industry || '',
    upstream: [],
    downstream: [],
    customers: parsed.customers.filter(c => !['CSP', '資料中心'].includes(c)),
    suppliers: parsed.suppliers,
    lastUpdated: '2026-04',
    coverageSource: 'tw-coverage-repo',
  }

  // Build upstream entries from parsed data
  for (const u of parsed.upstream) {
    // Try to find stock code from HOLDINGS or known mappings
    const code = findStockCode(u.name)
    entry.upstream.push({
      code: code,
      name: u.name,
      product: u.product || u.context.replace(/\[\[([^\]]+)\]\]/g, '$1').slice(0, 50),
      dependency: 'medium',
      substituteRisk: 'medium',
    })
  }

  // Build downstream entries
  for (const d of parsed.downstream) {
    const code = findStockCode(d.name)
    entry.downstream.push({
      code: code,
      name: d.name,
      product: d.product || d.context.replace(/\[\[([^\]]+)\]\]/g, '$1').slice(0, 50),
      dependency: 'medium',
      revenueShare: null,
      relationship: 'customer',
    })
  }

  return entry
}

// Known stock code mappings for common entities
const KNOWN_CODES = {
  '台積電': '2330', '聯發科': '2454', '日月光投控': '3711',
  '鴻海': '2317', '廣達': '2382', '聯詠': '3034',
  '南亞': '2258', '台塑集團': '1301', '中石化': '1314',
  '欣興': '3037', '臻鼎': '4958', '華通': '2313',
  '景碩': '3189', '群創光電': '3481', '南亞科技': '2408',
  '合晶科技': '6182', '奇景光電': '3491',
  '東和鋼鐵': '2006', '豐興鋼鐵': '2015',
  '台灣水泥': '1101', '亞洲水泥': '1102',
  '緯創': '3231', '奇鋐': '3017', '台燿': '6274',
  '台達電': '2308', '創意': '3443', '長興': '1717',
  '華星光': '4979', '亞翔': '6139',
}

function findStockCode(name) {
  if (KNOWN_CODES[name]) return KNOWN_CODES[name]
  // Check if name matches any holding
  for (const [code, holdingName] of Object.entries(HOLDINGS)) {
    if (name.includes(holdingName) || holdingName.includes(name)) return code
  }
  return null
}

// ─── Main ───

function main() {
  console.log('=== Parsing My-TW-Coverage ===\n')

  // Find all report files for our holdings
  const reportsDir = path.join(REPO_DIR, 'Pilot_Reports')
  const reportFiles = []

  function findReports(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        findReports(fullPath)
      } else if (entry.name.endsWith('.md')) {
        const codeMatch = entry.name.match(/^(\d{4})_/)
        if (codeMatch && HOLDINGS[codeMatch[1]]) {
          reportFiles.push(fullPath)
        }
      }
    }
  }

  findReports(reportsDir)
  console.log(`Found ${reportFiles.length} reports for holdings\n`)

  // Parse all reports
  const parsed = {}
  for (const file of reportFiles) {
    const result = parseReport(file)
    if (result) {
      parsed[result.code] = result
      console.log(`✅ ${result.code} ${result.name}: ${result.upstream.length} upstream, ${result.downstream.length} downstream, ${result.customers.length} customers`)
    }
  }

  // Load existing supplyChain.json
  const existingPath = path.join(__dirname, '..', 'src', 'data', 'supplyChain.json')
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'))
  console.log(`\nExisting supplyChain.json has ${Object.keys(existing).length} entries`)

  // Build new entries, merging with existing
  const merged = { ...existing }

  for (const [code, data] of Object.entries(parsed)) {
    if (existing[code]) {
      // Existing entry — enrich but don't overwrite manually curated data
      const ex = existing[code]
      // Add new customers not already listed
      const newCustomers = data.customers.filter(c => !ex.customers?.includes(c))
      if (newCustomers.length > 0) {
        ex.customers = [...(ex.customers || []), ...newCustomers]
        console.log(`  ${code}: +${newCustomers.length} customers: ${newCustomers.join(', ')}`)
      }
      // Add new suppliers not already listed
      const newSuppliers = data.suppliers.filter(s => !ex.suppliers?.includes(s))
      if (newSuppliers.length > 0) {
        ex.suppliers = [...(ex.suppliers || []), ...newSuppliers]
        console.log(`  ${code}: +${newSuppliers.length} suppliers: ${newSuppliers.join(', ')}`)
      }
      // Update source note
      ex.coverageSource = ex.coverageSource + '+tw-coverage'
    } else {
      // New entry
      merged[code] = buildSupplyChainEntry(data)
      console.log(`  ${code} ${data.name}: NEW entry`)
    }
  }

  // Write merged supplyChain.json
  const outputPath = existingPath
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n')
  console.log(`\n✅ Wrote ${Object.keys(merged).length} entries to supplyChain.json`)

  // Parse themes
  console.log('\n=== Parsing Themes ===\n')
  const themeMapping = parseThemes()

  // Build themeClassification.json
  const themeOutput = {}
  for (const [code, themes] of Object.entries(themeMapping)) {
    themeOutput[code] = {
      name: HOLDINGS[code],
      themes: themes.map(t => ({
        theme: t.theme,
        position: t.position,
      })),
    }
    console.log(`${code} ${HOLDINGS[code]}: ${themes.map(t => t.theme + (t.position ? `(${t.position})` : '')).join(', ')}`)
  }

  const themePath = path.join(__dirname, '..', 'src', 'data', 'themeClassification.json')
  fs.writeFileSync(themePath, JSON.stringify(themeOutput, null, 2) + '\n')
  console.log(`\n✅ Wrote ${Object.keys(themeOutput).length} holdings to themeClassification.json`)

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Holdings parsed: ${Object.keys(parsed).length}`)
  console.log(`Supply chain entries: ${Object.keys(merged).length} (was ${Object.keys(existing).length})`)
  console.log(`Holdings with themes: ${Object.keys(themeOutput).length}`)

  // Show holdings without coverage
  const missing = Object.keys(HOLDINGS).filter(c => !parsed[c])
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing from repo: ${missing.map(c => `${c} ${HOLDINGS[c]}`).join(', ')}`)
  }
}

main()
