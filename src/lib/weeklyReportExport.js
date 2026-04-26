function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTable(headers = [], rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`
}

function renderEmptyState(label = '目前沒有可顯示內容') {
  return `<p class="empty">${escapeHtml(label)}</p>`
}

function renderMultilineText(value) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function parseSummaryRows(lines = []) {
  return lines.flatMap((line) =>
    String(line || '')
      .split(' | ')
      .map((segment) => {
        const divider = segment.indexOf('：')
        if (divider < 0) return null
        return [segment.slice(0, divider), segment.slice(divider + 1)]
      })
      .filter(Boolean)
  )
}

function renderSummaryTable(rows = []) {
  return renderTable(
    ['欄位', '內容'],
    rows.map(([label, value]) => [String(label || '').trim(), String(value || '').trim()])
  )
}

function renderNarrativeSection(body = '') {
  const items = String(body || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())

  if (items.length === 0) return renderEmptyState()
  return `<ol class="narrative-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')}</ol>`
}

function renderPipedTableSection(body = '', headers = []) {
  const rows = String(body || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (rows.length === 0 || (rows.length === 1 && rows[0] === '無')) {
    return renderEmptyState('無')
  }

  return renderTable(
    headers,
    rows.map((row) => row.split(/\s*\|\s*/))
  )
}

function parseEventGroups(body = '') {
  const groups = []
  let activeGroup = null

  String(body || '')
    .split('\n')
    .forEach((rawLine) => {
      const line = rawLine.trimEnd()
      const trimmed = line.trim()
      if (!trimmed) return

      if (trimmed.startsWith('已驗證（') || trimmed.startsWith('待處理（')) {
        activeGroup = {
          title: trimmed.replace(/：$/, ''),
          rows: [],
          empty: false,
        }
        groups.push(activeGroup)
        return
      }

      if (!activeGroup) return

      if (trimmed === '無') {
        activeGroup.empty = true
        return
      }

      if (trimmed.startsWith('[')) {
        const match = trimmed.match(/^\[(.+?)\]\s+(\S+)\s+(.+)$/)
        activeGroup.rows.push({
          badge: match?.[1] || '',
          date: match?.[2] || '',
          title: match?.[3] || trimmed,
          detail: '',
        })
        return
      }

      if (activeGroup.rows.length > 0) {
        activeGroup.rows[activeGroup.rows.length - 1].detail = trimmed
      }
    })

  return groups
}

function renderEventSection(body = '') {
  const groups = parseEventGroups(body)
  if (groups.length === 0) return renderEmptyState()

  return groups
    .map((group) => {
      const table =
        group.empty || group.rows.length === 0
          ? renderEmptyState('無')
          : renderTable(
              ['狀態', '日期', '事件', '說明'],
              group.rows.map((row) => [row.badge, row.date, row.title, row.detail])
            )

      return `<section class="subsection"><h3>${escapeHtml(group.title)}</h3>${table}</section>`
    })
    .join('')
}

function parseBrainSection(body = '') {
  const data = {
    coreRules: [],
    candidateRules: [],
    checklist: [],
    lessons: [],
    commonMistakes: '無',
    hitRate: '計算中',
    totalAnalyses: '0',
  }
  const sectionLabels = new Map([
    ['核心規則：', 'coreRules'],
    ['候選規則：', 'candidateRules'],
    ['決策檢查表：', 'checklist'],
    ['最近教訓：', 'lessons'],
  ])
  let activeKey = null

  String(body || '')
    .split('\n')
    .forEach((rawLine) => {
      const trimmed = rawLine.trim()
      if (!trimmed) return

      if (sectionLabels.has(trimmed)) {
        activeKey = sectionLabels.get(trimmed)
        return
      }

      if (trimmed.startsWith('常犯錯誤：')) {
        data.commonMistakes = trimmed.slice('常犯錯誤：'.length).trim() || '無'
        activeKey = null
        return
      }

      if (trimmed.startsWith('命中率：')) {
        data.hitRate = trimmed.slice('命中率：'.length).trim() || '計算中'
        activeKey = null
        return
      }

      if (trimmed.startsWith('累計分析次數：')) {
        data.totalAnalyses = trimmed.slice('累計分析次數：'.length).trim() || '0'
        activeKey = null
        return
      }

      if (activeKey) {
        data[activeKey].push(trimmed)
      }
    })

  return data
}

function renderTextList(items = []) {
  const safeItems = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (safeItems.length === 0 || (safeItems.length === 1 && safeItems[0] === '無')) {
    return renderEmptyState('無')
  }

  return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function renderBrainSection(body = '') {
  const data = parseBrainSection(body)
  return `<div class="brain-grid">
    <section class="card card-soft">
      <h3>核心規則</h3>
      ${renderTextList(data.coreRules)}
    </section>
    <section class="card card-soft">
      <h3>候選規則</h3>
      ${renderTextList(data.candidateRules)}
    </section>
    <section class="card card-soft">
      <h3>決策檢查表</h3>
      ${renderTextList(data.checklist)}
    </section>
    <section class="card card-soft">
      <h3>最近教訓</h3>
      ${renderTextList(data.lessons)}
    </section>
  </div>
  ${renderTable(
    ['指標', '內容'],
    [
      ['常犯錯誤', data.commonMistakes],
      ['命中率', data.hitRate],
      ['累計分析次數', data.totalAnalyses],
    ]
  )}`
}

function renderBulletSection(body = '') {
  const items = String(body || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-+\s*/, '').trim())

  return renderTextList(items)
}

function renderAnalysisSection(body = '') {
  const entries = String(body || '')
    .split(/\n{2,}---\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (entries.length === 0 || (entries.length === 1 && entries[0] === '尚無分析紀錄')) {
    return renderEmptyState('尚無分析紀錄')
  }

  return `<div class="analysis-grid">${entries
    .map((entry) => {
      const [headline = '', ...rest] = entry.split('\n')
      return `<article class="analysis-card">
        <h3>${escapeHtml(headline)}</h3>
        <blockquote>${renderMultilineText(rest.join('\n').trim())}</blockquote>
      </article>`
    })
    .join('')}</div>`
}

function renderDefaultSection(body = '') {
  const text = String(body || '').trim()
  if (!text) return renderEmptyState()
  return `<p>${renderMultilineText(text)}</p>`
}

function renderSection(heading = '', body = '') {
  if (heading === 'Weekly Narrative') return renderNarrativeSection(body)
  if (heading === '持倉明細') {
    return renderPipedTableSection(body, ['持股', '現價', '成本', '損益', '類型'])
  }
  if (heading === '觀察股') {
    return renderPipedTableSection(body, ['標的', '現價', '目標', '狀態'])
  }
  if (heading === '事件預測紀錄') return renderEventSection(body)
  if (heading === '策略大腦') return renderBrainSection(body)
  if (heading === 'Insider Compliance Notes') return renderBulletSection(body)
  if (heading === '近 7 日收盤分析') return renderAnalysisSection(body)
  return renderDefaultSection(body)
}

function parseWeeklyMarkdown(markdown = '') {
  const normalized = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .trim()
  const footerDivider = normalized.lastIndexOf('\n---\n')
  const content = footerDivider >= 0 ? normalized.slice(0, footerDivider) : normalized
  const footer = footerDivider >= 0 ? normalized.slice(footerDivider + 5).trim() : ''
  const lines = content.split('\n')
  const title = lines.shift()?.replace(/^#\s*/, '').trim() || '持倉看板週報素材'
  const summaryLines = []
  while (lines.length > 0 && !lines[0].startsWith('## ')) {
    const line = lines.shift()
    if (String(line || '').trim()) summaryLines.push(line)
  }

  const sections = []
  while (lines.length > 0) {
    const line = lines.shift()
    if (!String(line || '').startsWith('## ')) continue
    const heading = line.replace(/^##\s*/, '').trim()
    const bodyLines = []
    while (lines.length > 0 && !lines[0].startsWith('## ')) {
      bodyLines.push(lines.shift())
    }
    sections.push({ heading, body: bodyLines.join('\n').trim() })
  }

  return {
    title,
    summaryLines,
    summaryRows: parseSummaryRows(summaryLines),
    sections,
    footer,
  }
}

export function formatWeeklyIsoStamp(date = new Date()) {
  const safeDate = date instanceof Date ? new Date(date.getTime()) : new Date(date)
  const utcDate = new Date(
    Date.UTC(safeDate.getFullYear(), safeDate.getMonth(), safeDate.getDate())
  )
  const isoDay = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay)
  const isoYear = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const weekNumber = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7)
  return `${isoYear}-${String(weekNumber).padStart(2, '0')}`
}

export function buildWeeklyReportFilename(extension = 'md', date = new Date()) {
  const safeExtension =
    String(extension || 'md')
      .replace(/^\./, '')
      .trim() || 'md'
  return `jiucaivoice-weekly-${formatWeeklyIsoStamp(date)}.${safeExtension}`
}

export function buildWeeklyReportHtmlDocument(markdown = '') {
  const parsed = parseWeeklyMarkdown(markdown)
  const portfolioName =
    parsed.summaryRows.find(([label]) => String(label || '').trim() === '組合')?.[1] || '持倉看板'
  const generatedDate =
    parsed.summaryRows.find(([label]) => String(label || '').trim() === '生成日期')?.[1] || ''

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(parsed.title)} · ${escapeHtml(portfolioName)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f1e8;
        --surface: rgba(255, 249, 239, 0.95);
        --surface-strong: #fffdf7;
        --line: rgba(49, 35, 24, 0.16);
        --line-strong: rgba(49, 35, 24, 0.28);
        --ink: #23160e;
        --muted: rgba(35, 22, 14, 0.72);
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.12);
        --warm: #c26b2d;
        --warm-soft: rgba(194, 107, 45, 0.12);
        --shadow: 0 18px 48px rgba(49, 35, 24, 0.12);
      }
      @font-face {
        font-family: 'Source Han Sans TC';
        src: url('/fonts/SourceHanSansTC-Regular.woff2') format('woff2');
        font-weight: 400;
        font-display: swap;
      }
      @font-face {
        font-family: 'Source Han Sans TC';
        src: url('/fonts/SourceHanSansTC-Bold.woff2') format('woff2');
        font-weight: 700;
        font-display: swap;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Source Han Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 40px 20px 80px;
      }
      .hero {
        padding: 32px;
        border-radius: 28px;
        background: var(--surface-strong);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
        margin-bottom: 24px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 8px;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        font-size: clamp(36px, 6vw, 54px);
        line-height: 1.04;
      }
      .hero-meta {
        margin: 0;
        color: var(--muted);
        font-size: 15px;
      }
      .layout {
        display: grid;
        gap: 20px;
      }
      .card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        box-shadow: var(--shadow);
      }
      .card-soft {
        background: rgba(255, 253, 247, 0.95);
        box-shadow: none;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 22px;
        line-height: 1.2;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 16px;
        line-height: 1.3;
      }
      p, li, td, th, blockquote {
        font-size: 15px;
        line-height: 1.6;
      }
      ol, ul {
        margin: 0;
        padding-left: 20px;
      }
      .narrative-list li + li,
      ul li + li {
        margin-top: 10px;
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
      }
      th, td {
        padding: 12px 14px;
        text-align: left;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }
      tr:last-child td {
        border-bottom: none;
      }
      .subsection + .subsection {
        margin-top: 20px;
      }
      .brain-grid,
      .analysis-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .analysis-card {
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 252, 246, 0.98);
        border: 1px solid var(--line);
      }
      blockquote {
        margin: 0;
        padding-left: 16px;
        border-left: 3px solid var(--warm);
        color: var(--muted);
      }
      .empty {
        margin: 0;
        padding: 16px;
        border-radius: 16px;
        background: var(--warm-soft);
        color: var(--muted);
      }
      footer {
        margin-top: 24px;
        padding: 20px 24px;
        border-radius: 20px;
        background: rgba(255, 249, 239, 0.88);
        border: 1px solid var(--line);
        color: var(--muted);
      }
      @media (max-width: 860px) {
        main {
          padding: 24px 14px 48px;
        }
        .hero, .card, footer {
          padding: 20px;
          border-radius: 20px;
        }
        .brain-grid,
        .analysis-grid {
          grid-template-columns: 1fr;
        }
        th, td {
          padding: 10px 12px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="eyebrow">Weekly Export</span>
        <h1>${escapeHtml(parsed.title)}</h1>
        <p class="hero-meta">${escapeHtml(portfolioName)}${
          generatedDate ? ` · 生成日期 ${escapeHtml(generatedDate)}` : ''
        }</p>
      </section>
      <div class="layout">
        <section class="card">
          <h2>摘要</h2>
          ${renderSummaryTable(parsed.summaryRows)}
        </section>
        ${parsed.sections
          .map(
            (section) =>
              `<section class="card"><h2>${escapeHtml(section.heading)}</h2>${renderSection(
                section.heading,
                section.body
              )}</section>`
          )
          .join('')}
      </div>
      ${parsed.footer ? `<footer><p>${renderMultilineText(parsed.footer)}</p></footer>` : ''}
    </main>
  </body>
</html>`
}
