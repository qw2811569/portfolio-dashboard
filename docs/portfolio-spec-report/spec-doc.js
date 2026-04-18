const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()+={}[\]|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')

const inline = (text) =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const toc = []
  const html = []
  let i = 0

  const flushParagraph = (buffer) => {
    if (buffer.length) html.push(`<p>${inline(buffer.join(' '))}</p>`)
    buffer.length = 0
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim().toLowerCase()
      const buffer = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i])) buffer.push(lines[i++])
      const code = escapeHtml(buffer.join('\n'))
      if (language === 'mermaid') {
        html.push(`<pre class="mermaid-block"><code class="language-mermaid">${code}</code></pre>`)
      } else {
        const languageClass = language ? ` class="language-${language}"` : ''
        html.push(`<pre><code${languageClass}>${code}</code></pre>`)
      }
      i += 1
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const text = heading[2].trim()
      const id = slugify(text)
      if (level >= 2 && level <= 3) toc.push({ level, text, id })
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`)
      i += 1
      continue
    }
    if (/^> /.test(line)) {
      const buffer = []
      while (i < lines.length && /^> /.test(lines[i])) buffer.push(lines[i++].slice(2))
      html.push(`<blockquote>${buffer.map((item) => inline(item)).join('<br />')}</blockquote>`)
      continue
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|\s*[-:]/.test(lines[i + 1])) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++])
      const cells = rows.map((row) =>
        row
          .split('|')
          .slice(1, -1)
          .map((cell) => inline(cell.trim()))
      )
      const [head, , ...body] = cells
      html.push(
        `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, index) =>
                    `<td data-label="${escapeHtml(head[index]?.replace(/<[^>]+>/g, '') || '')}">${cell}</td>`
                )
                .join('')}</tr>`
          )
          .join('')}</tbody></table>`
      )
      continue
    }
    const listMatch = line.match(/^([-*]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1])
      const tag = ordered ? 'ol' : 'ul'
      const items = []
      while (i < lines.length) {
        const match = lines[i].match(/^([-*]|\d+\.)\s+(.+)$/)
        if (!match) break
        items.push(`<li>${inline(match[2].trim())}</li>`)
        i += 1
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }
    if (/^---+$/.test(line.trim())) {
      html.push('<hr />')
      i += 1
      continue
    }
    const paragraph = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^> /.test(lines[i]) &&
      !/^\|/.test(lines[i]) &&
      !/^([-*]|\d+\.)\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    flushParagraph(paragraph)
  }

  return { html: html.join('\n'), toc }
}

async function renderMermaid(root) {
  if (!root || !window.mermaid) return

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: {
      background: '#E7E0D6',
      primaryColor: '#EC662D',
      primaryTextColor: '#0B120E',
      primaryBorderColor: '#2F3232',
      lineColor: '#838585',
      secondaryColor: '#D9D3D1',
      tertiaryColor: '#F0A145',
      fontFamily: '"Source Serif 4", "Noto Serif TC", serif',
      fontSize: '14px',
      edgeLabelBackground: '#E7E0D6',
      clusterBkg: '#D9D3D1',
      clusterBorder: '#838585',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'linear',
    },
    sequence: {
      useMaxWidth: true,
      wrap: true,
    },
  })

  window.mermaid.run({ querySelector: '.mermaid' })

  const blocks = Array.from(root.querySelectorAll('code.language-mermaid'))
  if (!blocks.length) return

  let index = 0
  for (const codeNode of blocks) {
    const source = codeNode.textContent || ''
    const host = codeNode.closest('.mermaid-block') || codeNode.parentElement
    if (!host) continue
    const graphId = `mermaid-${index++}`
    const { svg } = await window.mermaid.render(graphId, source)
    const wrapper = document.createElement('div')
    wrapper.className = 'mermaid'
    wrapper.innerHTML = svg
    host.replaceWith(wrapper)
  }
}

function buildTocHtml(toc) {
  if (!toc.length) return '<h2>Contents</h2><p>No headings.</p>'
  return `<h2>Contents</h2><ul>${toc
    .map((item) => `<li><a href="#${item.id}" data-level="${item.level}">${item.text}</a></li>`)
    .join('')}</ul>`
}

function wrapSectionAsDetails(heading, { open = false, className = 'doc-fold' } = {}) {
  if (!heading?.parentNode) return null

  const details = document.createElement('details')
  details.className = className
  details.id = heading.id
  details.open = open

  const summary = document.createElement('summary')
  summary.innerHTML = heading.innerHTML
  details.appendChild(summary)

  let sectionNode = heading.nextElementSibling
  while (sectionNode && !/^H[23]$/.test(sectionNode.tagName)) {
    const following = sectionNode.nextElementSibling
    details.appendChild(sectionNode)
    sectionNode = following
  }

  heading.replaceWith(details)
  return sectionNode
}

function collapseDeferredSections(root) {
  if (!root) return

  const isMobile = window.matchMedia('(max-width: 768px)').matches

  const headings = Array.from(root.querySelectorAll('h2'))
  const blockerHeading = headings.find((heading) =>
    heading.textContent.includes('Task 2 完整 TODO')
  )
  if (blockerHeading) {
    let node = blockerHeading.nextElementSibling
    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'H3') {
        const open = !isMobile && node.textContent.includes('Ship-Before')
        node = wrapSectionAsDetails(node, {
          open,
          className: 'doc-fold doc-fold--mobile',
        })
        continue
      }
      node = node.nextElementSibling
    }
  }

  const deferredHeading = headings.find((heading) =>
    heading.textContent.includes('Phase 2 Top Debt')
  )
  if (!deferredHeading) return

  let node = deferredHeading.nextElementSibling
  while (node && node.tagName !== 'H2') {
    if (node.tagName === 'H3') {
      node = wrapSectionAsDetails(node, { open: false })
      continue
    }
    node = node.nextElementSibling
  }
}

async function boot() {
  const main = document.querySelector('[data-doc]') || document.querySelector('main[data-md]')
  const tocNode = document.querySelector('[data-toc]')
  const mdUrl = document.body.dataset.md || main?.dataset.md
  if (!main || !mdUrl) return
  try {
    const response = await fetch(mdUrl)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    const markdown = await response.text()
    const { html, toc } = renderMarkdown(markdown)
    main.innerHTML = html
    collapseDeferredSections(main)
    if (tocNode) tocNode.innerHTML = buildTocHtml(toc)
    await renderMermaid(main)
  } catch (error) {
    main.innerHTML = `<div class="load-error">無法載入 spec markdown：${escapeHtml(String(error))}</div>`
    if (tocNode) tocNode.innerHTML = '<h2>Contents</h2><p>Load failed.</p>'
  }
}

boot()
