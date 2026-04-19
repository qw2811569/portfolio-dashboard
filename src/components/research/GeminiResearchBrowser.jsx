import { createElement as h, useState, useEffect } from 'react'
import { C } from '../../theme.js'
import { Card, Button } from '../common'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

/**
 * Gemini Research Browser Component
 * Displays all Gemini research outputs in a browsable format
 */
export function GeminiResearchBrowser() {
  const [researchFiles, setResearchFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch list of Gemini research files
    fetch('/api/gemini-research')
      .then((res) => res.json())
      .then((data) => {
        setResearchFiles(data.files || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleFileSelect = (file) => {
    setSelectedFile(file)
  }

  const handleBack = () => {
    setSelectedFile(null)
  }

  if (loading) {
    return h(
      Card,
      { style: { padding: 20 } },
      h('div', { style: { textAlign: 'center', color: C.textSec } }, '載入中...')
    )
  }

  if (error) {
    return h(
      Card,
      { style: { padding: 20 } },
      h('div', { style: { ...lbl, color: C.down } }, '錯誤'),
      h('div', { style: { fontSize: 11, color: C.textSec } }, error)
    )
  }

  if (selectedFile) {
    return h(ResearchFileDetail, { file: selectedFile, onBack: handleBack })
  }

  return h(
    Card,
    { style: { padding: '12px 14px' } },
    h('div', { style: { ...lbl, color: C.textSec, marginBottom: 10 } }, 'Gemini 研究報告'),
    researchFiles.length === 0
      ? h('div', { style: { fontSize: 11, color: C.textSec } }, '暫無研究報告')
      : h(
          'div',
          { style: { display: 'grid', gap: 8 } },
          researchFiles.map((file) =>
            h(ResearchFileItem, {
              key: file.name,
              file,
              onClick: () => handleFileSelect(file),
            })
          )
        )
  )
}

/**
 * Research File Item (in list view)
 */
function ResearchFileItem({ file, onClick }) {
  const daysAgo = getDaysAgo(file.date)
  const freshness = daysAgo <= 1 ? '今天' : daysAgo <= 2 ? '昨天' : `${daysAgo}天前`
  const freshnessColor = daysAgo <= 2 ? C.olive : daysAgo <= 7 ? C.amber : C.textMute

  return h(
    'div',
    {
      onClick,
      style: {
        padding: '10px 12px',
        background: C.subtle,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        ':hover': { background: C.fillPrimary },
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { fontSize: 11, fontWeight: 600, color: C.text } }, file.displayName),
      h('span', { style: { fontSize: 9, color: freshnessColor } }, freshness)
    ),
    h('div', { style: { fontSize: 9, color: C.textMute, marginTop: 4 } }, file.type),
    file.itemCount &&
      h(
        'div',
        { style: { fontSize: 9, color: C.textSec, marginTop: 2 } },
        `${file.itemCount} 筆資料`
      )
  )
}

/**
 * Research File Detail View
 */
function ResearchFileDetail({ file, onBack }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/gemini-research/${file.name}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data)
        setLoading(false)
      })
      .catch((err) => {
        setContent({ error: err.message })
        setLoading(false)
      })
  }, [file.name])

  if (loading) {
    return h(
      Card,
      { style: { padding: 20 } },
      h('div', { style: { textAlign: 'center', color: C.textSec } }, '載入中...')
    )
  }

  if (content?.error) {
    return h(
      Card,
      { style: { padding: 20 } },
      h(Button, { onClick: onBack, children: '← 返回' }),
      h('div', { style: { ...lbl, color: C.down, marginTop: 10 } }, '載入失敗'),
      h('div', { style: { fontSize: 11, color: C.textSec } }, content.error)
    )
  }

  return h(
    Card,
    { style: { padding: '12px 14px' } },
    h(Button, { onClick: onBack, children: '← 返回' }),
    h(
      'div',
      { style: { ...lbl, color: C.textSec, marginTop: 10, marginBottom: 8 } },
      file.displayName
    ),
    h(
      'div',
      { style: { fontSize: 9, color: C.textMute, marginBottom: 12 } },
      `蒐集日期：${file.date}`
    ),

    // Render content based on type
    content?.facts &&
      h(
        'div',
        { style: { display: 'grid', gap: 8 } },
        content.facts.map((fact, idx) => h(FactItem, { key: idx, fact, type: file.type }))
      ),

    // Citations
    content?.citations &&
      h(
        'div',
        { style: { marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` } },
        h('div', { style: { ...lbl, marginBottom: 6 } }, '來源連結'),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          content.citations.map((citation, idx) =>
            h(
              'a',
              {
                key: idx,
                href: citation,
                target: '_blank',
                rel: 'noopener noreferrer',
                style: {
                  fontSize: 9,
                  color: C.info,
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                },
              },
              citation
            )
          )
        )
      ),

    // Freshness
    content?.freshness &&
      h(
        'div',
        { style: { marginTop: 12, fontSize: 9, color: C.textMute } },
        `新鮮度：${content.freshness}`
      )
  )
}

/**
 * Fact Item Renderer
 */
function FactItem({ fact, type: _type }) {
  const impactColors = {
    positive: C.olive,
    negative: C.down,
    neutral: C.textMute,
    confirmed: C.teal,
  }

  const impactColor = impactColors[fact.confidence] || impactColors[fact.impact] || C.text

  return h(
    'div',
    {
      style: {
        padding: '10px 12px',
        background: C.subtle,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
      },
    },
    // Title/Name
    h(
      'div',
      { style: { fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 4 } },
      fact.title || fact.name
    ),

    // Code/Date
    (fact.code || fact.date) &&
      h(
        'div',
        { style: { fontSize: 9, color: C.textSec, marginBottom: 4 } },
        [fact.code, fact.date].filter(Boolean).join(' | ')
      ),

    // Summary/Description
    (fact.summary || fact.description) &&
      h(
        'div',
        { style: { fontSize: 10, color: C.textSec, lineHeight: 1.6 } },
        fact.summary || fact.description
      ),

    // Impact/Confidence badge
    (fact.impact || fact.confidence) &&
      h(
        'span',
        {
          style: {
            fontSize: 9,
            padding: '2px 6px',
            background: impactColor + '20',
            color: impactColor,
            borderRadius: 4,
            display: 'inline-block',
            marginTop: 4,
          },
        },
        fact.impact || fact.confidence
      ),

    // Target price (for target-price type)
    fact.target &&
      h('div', { style: { fontSize: 10, color: C.info, marginTop: 4 } }, `目標價：${fact.target}`),

    // Stocks (for news type)
    fact.stocks &&
      h(
        'div',
        { style: { marginTop: 4 } },
        fact.stocks.map((code) =>
          h(
            'span',
            {
              key: code,
              style: {
                fontSize: 9,
                padding: '2px 4px',
                background: C.fillPrimary,
                borderRadius: 4,
                marginRight: 4,
              },
            },
            code
          )
        )
      )
  )
}

/**
 * Helper: Calculate days ago from ISO date string
 */
function getDaysAgo(isoDate) {
  if (!isoDate) return 0
  const fileDate = new Date(isoDate)
  const now = new Date()
  const diffTime = Math.abs(now - fileDate)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export default GeminiResearchBrowser
