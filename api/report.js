import { withApiAuth } from './_lib/auth-middleware.js'
// Vercel Serverless Function — 週報素材 API
// 回傳 HTML 頁面，讓 Claude.ai 的 web fetch 能正確解析
import { list } from '@vercel/blob'
import { fetchSignedBlobJson, resolveSignedBlobOrigin } from './_lib/signed-url.js'

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN

async function readBlob(blob, { origin } = {}) {
  return fetchSignedBlobJson(blob?.pathname || blob?.url, { origin })
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const opts = { token: TOKEN }
  const origin = resolveSignedBlobOrigin(req)

  try {
    const [brainRes, histRes, evtRes, holdRes] = await Promise.all([
      list({ prefix: 'strategy-brain.json', ...opts }),
      list({ prefix: 'analysis-history/', ...opts }),
      list({ prefix: 'events.json', ...opts }),
      list({ prefix: 'holdings.json', ...opts }),
    ])

    let brain = null
    if (brainRes.blobs.length > 0) {
      brain = await readBlob(brainRes.blobs[0], { origin })
    }

    const history = []
    for (const blob of histRes.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 7)) {
      history.push(await readBlob(blob, { origin }))
    }

    let events = null
    if (evtRes.blobs.length > 0) {
      events = await readBlob(evtRes.blobs[0], { origin })
    }

    let holdings = null
    if (holdRes.blobs.length > 0) {
      holdings = await readBlob(holdRes.blobs[0], { origin })
    }

    const today = new Date().toLocaleDateString('zh-TW')
    let html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>持倉看板週報素材</title></head><body>'
    html += `<h1>持倉看板週報素材</h1><p>生成日期：${today}</p>`

    if (holdings && Array.isArray(holdings) && holdings.length > 0) {
      const totalCost = holdings.reduce((sum, item) => sum + item.cost * item.qty, 0)
      const totalVal = holdings.reduce((sum, item) => sum + item.value, 0)
      const totalPnl = holdings.reduce((sum, item) => sum + item.pnl, 0)
      const retPct = totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : '0'

      html += '<h2>投資組合總覽</h2>'
      html += `<p>總成本：${Math.round(totalCost).toLocaleString()} | 總市值：${totalVal.toLocaleString()} | 損益：${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}（${retPct}%）</p>`
      html += `<p>持股數：${holdings.length} 檔</p>`

      html +=
        '<h2>持倉明細</h2><table><tr><th>名稱</th><th>類型</th><th>數量</th><th>成本</th><th>現價</th><th>市值</th><th>損益</th><th>報酬率</th></tr>'
      holdings.forEach((holding) => {
        html += `<tr><td>${esc(holding.name)}(${esc(holding.code)})</td><td>${esc(holding.type)}</td><td>${holding.qty}股</td><td>${holding.cost}</td><td>${holding.price}</td><td>${holding.value}</td><td>${holding.pnl >= 0 ? '+' : ''}${holding.pnl}</td><td>${holding.pct >= 0 ? '+' : ''}${holding.pct}%</td></tr>`
      })
      html += '</table>'

      const winners = holdings.filter((holding) => holding.pnl > 0).sort((a, b) => b.pct - a.pct)
      const losers = holdings.filter((holding) => holding.pnl < 0).sort((a, b) => a.pct - b.pct)
      if (winners.length > 0) {
        html += `<p><strong>獲利排行：</strong>${winners.map((holding) => `${esc(holding.name)}(+${holding.pct}%)`).join('、')}</p>`
      }
      if (losers.length > 0) {
        html += `<p><strong>虧損排行：</strong>${losers.map((holding) => `${esc(holding.name)}(${holding.pct}%)`).join('、')}</p>`
      }
    } else {
      html += '<h2>持倉明細</h2><p>（尚未同步）</p>'
    }

    if (brain) {
      html += '<h2>策略大腦</h2>'
      html += `<p>累計分析：${brain.stats?.totalAnalyses || 0} 次 | 命中率：${brain.stats?.hitRate || '計算中'} | 更新：${brain.lastUpdate || '—'}</p>`
      if (brain.rules?.length > 0) {
        html += '<h3>核心規則</h3><ol>'
        brain.rules.forEach((rule) => {
          html += `<li>${esc(rule)}</li>`
        })
        html += '</ol>'
      }
      if (brain.commonMistakes?.length > 0) {
        html += `<p><strong>常犯錯誤：</strong>${brain.commonMistakes.map(esc).join('、')}</p>`
      }
      if (brain.lessons?.length > 0) {
        html += '<h3>最近教訓</h3><ul>'
        brain.lessons.slice(-5).forEach((lesson) => {
          html += `<li>[${esc(lesson.date)}] ${esc(lesson.text)}</li>`
        })
        html += '</ul>'
      }
    } else {
      html += '<h2>策略大腦</h2><p>（尚未建立）</p>'
    }

    if (events && Array.isArray(events)) {
      const past = events.filter((event) => event.status === 'past')
      const pending = events.filter((event) => event.status === 'pending')
      const hits = past.filter((event) => event.correct === true).length
      const total = past.filter((event) => event.correct !== null).length

      html += '<h2>事件預測</h2>'
      html += `<p>命中率：${total > 0 ? `${Math.round((hits / total) * 100)}%（${hits}/${total}）` : '尚無'}</p>`

      if (past.length > 0) {
        html += '<h3>已驗證</h3><ul>'
        past.forEach((event) => {
          html += `<li>[${event.correct ? '✓' : '✗'}] ${esc(event.date)} ${esc(event.title)} — ${event.pred === 'up' ? '看漲' : event.pred === 'down' ? '看跌' : '中性'} | ${esc(event.actualNote || '—')}</li>`
        })
        html += '</ul>'
      }

      if (pending.length > 0) {
        html += '<h3>待驗證</h3><ul>'
        pending.forEach((event) => {
          html += `<li>[⏳] ${esc(event.date)} ${esc(event.title)} — ${event.pred === 'up' ? '看漲' : event.pred === 'down' ? '看跌' : '中性'} | ${esc(event.predReason || '—')}</li>`
        })
        html += '</ul>'
      }
    }

    if (history.length > 0) {
      html += '<h2>近 7 日分析</h2>'
      history.forEach((report) => {
        html += `<h3>【${esc(report.date)} ${esc(report.time)}】損益${report.totalTodayPnl >= 0 ? '+' : ''}${report.totalTodayPnl}</h3>`
        if (report.aiInsight) html += `<p>${esc(report.aiInsight)}</p>`
        html += '<hr>'
      })
    }

    html += '<hr><p>以上為持倉看板自動生成的週報素材。</p></body></html>'
    return res.status(200).send(html)
  } catch (error) {
    return res.status(500).send(`錯誤: ${error.message}`)
  }
}

export default withApiAuth(handler)
