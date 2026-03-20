// Vercel Serverless Function — 週報素材 API
// 回傳純文字格式，供 Claude.ai 或其他 AI 直接讀取
import { list } from '@vercel/blob';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;

async function readBlob(blob) {
  const r = await fetch(blob.url);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

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

    // 組裝報告
    const today = new Date().toLocaleDateString("zh-TW");
    let report = `# 持倉看板週報素材\n生成日期：${today}\n\n`;

    if (holdings && Array.isArray(holdings) && holdings.length > 0) {
      const totalCost = holdings.reduce((s, h) => s + (h.cost * h.qty), 0);
      const totalVal = holdings.reduce((s, h) => s + h.value, 0);
      const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
      const retPct = totalCost > 0 ? (totalPnl / totalCost * 100).toFixed(2) : "0";

      report += `## 投資組合總覽\n`;
      report += `總成本：${Math.round(totalCost).toLocaleString()} | 總市值：${totalVal.toLocaleString()} | 損益：${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}（${retPct}%）\n`;
      report += `持股數：${holdings.length} 檔\n\n`;

      report += `## 持倉明細\n`;
      holdings.forEach(h => {
        report += `${h.name}(${h.code}) | ${h.type} | ${h.qty}股 | 成本${h.cost} | 現價${h.price} | 市值${h.value} | 損益${h.pnl >= 0 ? "+" : ""}${h.pnl}(${h.pct >= 0 ? "+" : ""}${h.pct}%)\n`;
      });
      report += `\n`;

      const winners = holdings.filter(h => h.pnl > 0).sort((a, b) => b.pct - a.pct);
      const losers = holdings.filter(h => h.pnl < 0).sort((a, b) => a.pct - b.pct);
      if (winners.length > 0) report += `獲利排行：${winners.map(h => `${h.name}(+${h.pct}%)`).join("、")}\n`;
      if (losers.length > 0) report += `虧損排行：${losers.map(h => `${h.name}(${h.pct}%)`).join("、")}\n`;
      report += `\n`;
    } else {
      report += `## 持倉明細\n（尚未同步）\n\n`;
    }

    if (brain) {
      report += `## 策略大腦\n`;
      report += `累計分析：${brain.stats?.totalAnalyses || 0} 次 | 命中率：${brain.stats?.hitRate || "計算中"} | 更新：${brain.lastUpdate || "—"}\n\n`;
      if (brain.rules?.length > 0) {
        report += `核心規則：\n`;
        brain.rules.forEach((r, i) => { report += `${i + 1}. ${r}\n`; });
        report += `\n`;
      }
      if (brain.commonMistakes?.length > 0) report += `常犯錯誤：${brain.commonMistakes.join("、")}\n\n`;
      if (brain.lessons?.length > 0) {
        report += `最近教訓：\n`;
        brain.lessons.slice(-5).forEach(l => { report += `- [${l.date}] ${l.text}\n`; });
        report += `\n`;
      }
    } else {
      report += `## 策略大腦\n（尚未建立）\n\n`;
    }

    if (events && Array.isArray(events)) {
      const past = events.filter(e => e.status === "past");
      const pending = events.filter(e => e.status === "pending");
      const hits = past.filter(e => e.correct === true).length;
      const total = past.filter(e => e.correct !== null).length;

      report += `## 事件預測\n`;
      report += `命中率：${total > 0 ? Math.round(hits / total * 100) + "%（" + hits + "/" + total + "）" : "尚無"}\n\n`;

      if (past.length > 0) {
        report += `已驗證：\n`;
        past.forEach(e => {
          report += `[${e.correct ? "✓" : "✗"}] ${e.date} ${e.title} — ${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | ${e.actualNote || "—"}\n`;
        });
        report += `\n`;
      }
      if (pending.length > 0) {
        report += `待驗證：\n`;
        pending.forEach(e => {
          report += `[⏳] ${e.date} ${e.title} — ${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | ${e.predReason || "—"}\n`;
        });
        report += `\n`;
      }
    }

    if (history.length > 0) {
      report += `## 近 7 日分析\n\n`;
      history.forEach(r => {
        report += `【${r.date} ${r.time}】損益${r.totalTodayPnl >= 0 ? "+" : ""}${r.totalTodayPnl}\n`;
        if (r.aiInsight) report += `${r.aiInsight}\n`;
        report += `\n---\n\n`;
      });
    }

    report += `---\n以上為持倉看板自動生成的週報素材。\n`;
    return res.status(200).send(report);
  } catch (err) {
    return res.status(500).send(`錯誤: ${err.message}`);
  }
}
