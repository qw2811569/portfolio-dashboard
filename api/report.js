// Vercel Serverless Function — 週報素材 API
// 回傳 HTML 頁面，讓 Claude.ai 的 web fetch 能正確解析
import { list } from '@vercel/blob';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;

async function readBlob(blob) {
  const r = await fetch(blob.url);
  return r.json();
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  const opts = { token: TOKEN };

  try {
    const [brainRes, histRes, evtRes, holdRes] = await Promise.all([
      list({ prefix: 'strategy-brain.json', ...opts }),
      list({ prefix: 'analysis-history/', ...opts }),
      list({ prefix: 'events.json', ...opts }),
      list({ prefix: 'holdings.json', ...opts }),
    ]);

    let brain = null;
    if (brainRes.blobs.length > 0) brain = await readBlob(brainRes.blobs[0]);

    const history = [];
    for (const blob of histRes.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 7)) {
      history.push(await readBlob(blob));
    }

    let events = null;
    if (evtRes.blobs.length > 0) events = await readBlob(evtRes.blobs[0]);

    let holdings = null;
    if (holdRes.blobs.length > 0) holdings = await readBlob(holdRes.blobs[0]);

    // 組裝 HTML 報告
    const today = new Date().toLocaleDateString("zh-TW");
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>持倉看板週報素材</title></head><body>`;
    html += `<h1>持倉看板週報素材</h1><p>生成日期：${today}</p>`;

    if (holdings && Array.isArray(holdings) && holdings.length > 0) {
      const totalCost = holdings.reduce((s, h) => s + (h.cost * h.qty), 0);
      const totalVal = holdings.reduce((s, h) => s + h.value, 0);
      const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
      const retPct = totalCost > 0 ? (totalPnl / totalCost * 100).toFixed(2) : "0";

      html += `<h2>投資組合總覽</h2>`;
      html += `<p>總成本：${Math.round(totalCost).toLocaleString()} | 總市值：${totalVal.toLocaleString()} | 損益：${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}（${retPct}%）</p>`;
      html += `<p>持股數：${holdings.length} 檔</p>`;

      html += `<h2>持倉明細</h2><table><tr><th>名稱</th><th>類型</th><th>數量</th><th>成本</th><th>現價</th><th>市值</th><th>損益</th><th>報酬率</th></tr>`;
      holdings.forEach(h => {
        html += `<tr><td>${esc(h.name)}(${esc(h.code)})</td><td>${esc(h.type)}</td><td>${h.qty}股</td><td>${h.cost}</td><td>${h.price}</td><td>${h.value}</td><td>${h.pnl >= 0 ? "+" : ""}${h.pnl}</td><td>${h.pct >= 0 ? "+" : ""}${h.pct}%</td></tr>`;
      });
      html += `</table>`;

      const winners = holdings.filter(h => h.pnl > 0).sort((a, b) => b.pct - a.pct);
      const losers = holdings.filter(h => h.pnl < 0).sort((a, b) => a.pct - b.pct);
      if (winners.length > 0) html += `<p><strong>獲利排行：</strong>${winners.map(h => `${esc(h.name)}(+${h.pct}%)`).join("、")}</p>`;
      if (losers.length > 0) html += `<p><strong>虧損排行：</strong>${losers.map(h => `${esc(h.name)}(${h.pct}%)`).join("、")}</p>`;
    } else {
      html += `<h2>持倉明細</h2><p>（尚未同步）</p>`;
    }

    if (brain) {
      html += `<h2>策略大腦</h2>`;
      html += `<p>累計分析：${brain.stats?.totalAnalyses || 0} 次 | 命中率：${brain.stats?.hitRate || "計算中"} | 更新：${brain.lastUpdate || "—"}</p>`;
      if (brain.rules?.length > 0) {
        html += `<h3>核心規則</h3><ol>`;
        brain.rules.forEach(r => { html += `<li>${esc(r)}</li>`; });
        html += `</ol>`;
      }
      if (brain.commonMistakes?.length > 0) html += `<p><strong>常犯錯誤：</strong>${brain.commonMistakes.map(esc).join("、")}</p>`;
      if (brain.lessons?.length > 0) {
        html += `<h3>最近教訓</h3><ul>`;
        brain.lessons.slice(-5).forEach(l => { html += `<li>[${esc(l.date)}] ${esc(l.text)}</li>`; });
        html += `</ul>`;
      }
    } else {
      html += `<h2>策略大腦</h2><p>（尚未建立）</p>`;
    }

    if (events && Array.isArray(events)) {
      const past = events.filter(e => e.status === "past");
      const pending = events.filter(e => e.status === "pending");
      const hits = past.filter(e => e.correct === true).length;
      const total = past.filter(e => e.correct !== null).length;

      html += `<h2>事件預測</h2>`;
      html += `<p>命中率：${total > 0 ? Math.round(hits / total * 100) + "%（" + hits + "/" + total + "）" : "尚無"}</p>`;

      if (past.length > 0) {
        html += `<h3>已驗證</h3><ul>`;
        past.forEach(e => {
          html += `<li>[${e.correct ? "✓" : "✗"}] ${esc(e.date)} ${esc(e.title)} — ${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | ${esc(e.actualNote || "—")}</li>`;
        });
        html += `</ul>`;
      }
      if (pending.length > 0) {
        html += `<h3>待驗證</h3><ul>`;
        pending.forEach(e => {
          html += `<li>[⏳] ${esc(e.date)} ${esc(e.title)} — ${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | ${esc(e.predReason || "—")}</li>`;
        });
        html += `</ul>`;
      }
    }

    if (history.length > 0) {
      html += `<h2>近 7 日分析</h2>`;
      history.forEach(r => {
        html += `<h3>【${esc(r.date)} ${esc(r.time)}】損益${r.totalTodayPnl >= 0 ? "+" : ""}${r.totalTodayPnl}</h3>`;
        if (r.aiInsight) html += `<p>${esc(r.aiInsight)}</p>`;
        html += `<hr>`;
      });
    }

    html += `<hr><p>以上為持倉看板自動生成的週報素材。</p></body></html>`;
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send(`錯誤: ${err.message}`);
  }
}
