import { createElement as h } from 'react'
import { C } from '../theme.js'

// ── 輕量 Markdown → React 渲染器 ────────────────────────────────
export default function Md({ text, color }) {
  if (!text) return null
  const lines = text.split('\n')
  const els = []
  let listItems = []
  const textColor = color || C.textSec
  const flushList = () => {
    if (listItems.length > 0) {
      els.push(
        h(
          'ul',
          {
            key: `ul-${els.length}`,
            style: { margin: '4px 0 8px 4px', padding: 0, listStyle: 'none' },
          },
          listItems.map((li, j) =>
            h(
              'li',
              {
                key: j,
                style: {
                  fontSize: 11,
                  color: textColor,
                  lineHeight: 1.8,
                  paddingLeft: 12,
                  position: 'relative',
                },
              },
              h('span', { style: { position: 'absolute', left: 0, color: C.textMute } }, '·'),
              renderInline(li)
            )
          )
        )
      )
      listItems = []
    }
  }
  const renderInline = (s) => {
    // **bold** and *italic*
    const parts = []
    const rest = s
    let k = 0
    const rx = /\*\*(.+?)\*\*|\*(.+?)\*/g
    let m,
      last = 0
    while ((m = rx.exec(rest)) !== null) {
      if (m.index > last) parts.push(h('span', { key: k++ }, rest.slice(last, m.index)))
      if (m[1])
        parts.push(h('strong', { key: k++, style: { color: C.text, fontWeight: 600 } }, m[1]))
      else if (m[2]) parts.push(h('em', { key: k++, style: { fontStyle: 'italic' } }, m[2]))
      last = m.index + m[0].length
    }
    if (last < rest.length) parts.push(h('span', { key: k++ }, rest.slice(last)))
    return parts.length > 0 ? parts : rest
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,3}\s/.test(line)) {
      flushList()
      const lvlMatch = line.match(/^(#+)/)
      const lvl = lvlMatch ? lvlMatch[1].length : 1
      const txt = line.replace(/^#+\s*/, '')
      const sz = lvl === 1 ? 14 : lvl === 2 ? 12 : 11
      const headingMarginTop = lvl === 1 ? 12 : 8
      els.push(
        h(
          'div',
          {
            key: `h-${i}`,
            style: {
              fontSize: sz,
              fontWeight: 600,
              color: C.text,
              marginTop: headingMarginTop,
              marginBottom: 4,
            },
          },
          renderInline(txt)
        )
      )
    } else if (/^[-*]\s/.test(line.trim())) {
      listItems.push(line.trim().replace(/^[-*]\s*/, ''))
    } else if (/^\d+\.\s/.test(line.trim())) {
      flushList()
      const txt = line.trim().replace(/^\d+\.\s*/, '')
      const numMatch = line.trim().match(/^(\d+)\./)
      const num = numMatch ? numMatch[1] : '1'
      els.push(
        h(
          'div',
          {
            key: `ol-${i}`,
            style: {
              fontSize: 11,
              color: textColor,
              lineHeight: 1.8,
              paddingLeft: 12,
              position: 'relative',
              marginBottom: 4,
            },
          },
          h(
            'span',
            { style: { position: 'absolute', left: 0, color: C.textMute, fontSize: 12 } },
            `${num}.`
          ),
          renderInline(txt)
        )
      )
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList()
      // Markdown table: collect consecutive | rows
      const tableRows = []
      let ti = i
      while (
        ti < lines.length &&
        lines[ti].trim().startsWith('|') &&
        lines[ti].trim().endsWith('|')
      ) {
        tableRows.push(lines[ti].trim())
        ti++
      }
      i = ti - 1 // advance outer loop

      // Parse: skip separator rows (|---|---|)
      const dataRows = tableRows.filter((r) => !/^\|[\s\-:|]+\|$/.test(r))
      if (dataRows.length > 0) {
        const parseRow = (row) =>
          row
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        const headerCells = parseRow(dataRows[0])
        const bodyRows = dataRows.slice(1).map(parseRow)
        const cellStyle = {
          fontSize: 11,
          color: textColor,
          padding: '4px 8px',
          borderBottom: `1px solid ${C.border || '#333'}`,
          whiteSpace: 'nowrap',
        }
        els.push(
          h(
            'table',
            {
              key: `tbl-${i}`,
              style: {
                width: '100%',
                borderCollapse: 'collapse',
                margin: '4px 0',
                fontSize: 11,
              },
            },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                headerCells.map((c, ci) =>
                  h(
                    'th',
                    {
                      key: ci,
                      style: {
                        ...cellStyle,
                        fontWeight: 600,
                        color: C.text,
                        textAlign: 'left',
                      },
                    },
                    renderInline(c)
                  )
                )
              )
            ),
            h(
              'tbody',
              null,
              bodyRows.map((row, ri) =>
                h(
                  'tr',
                  { key: ri },
                  row.map((c, ci) => h('td', { key: ci, style: cellStyle }, renderInline(c)))
                )
              )
            )
          )
        )
      }
    } else if (line.trim() === '') {
      flushList()
      els.push(h('div', { key: `br-${i}`, style: { height: 4 } }))
    } else {
      flushList()
      els.push(
        h(
          'div',
          {
            key: `p-${i}`,
            style: { fontSize: 11, color: textColor, lineHeight: 1.8, marginBottom: 4 },
          },
          renderInline(line)
        )
      )
    }
  }
  flushList()
  return h('div', null, els)
}
