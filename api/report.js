// Vercel Serverless Function — 週報素材 API
// 回傳純文字格式，供 Claude.ai 或其他 AI 直接讀取
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  try {
    // 同時讀取所有資料
    const [brainRes, histRes, evtRes, holdRes] = await Promise.all([
      list({ prefix: 'strategy-brain.json' }),
      list({ prefix: 'analysis-history/' }),
      list({ prefix: 'events.json' }),
      list({ prefix: 'holdings.json' }),
    ]);

    // 策略大腦
    let brain = null;
    if (brainRes.blobs.length > 0) {
      const r = await fetch(brainRes.blobs[0].url);
      brain = await r.json();
    }

    // 分析歷史（最近 7 筆）
    const history = [];
    for (const blob of histRes.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 7)) {
      const r = await fetch(blob.url);
      history.push(await r.json());
    }

    // 事件資料
    let events = null;
    if (evtRes.blobs.length > 0) {
      const r = await fetch(evtRes.blobs[0].url);
      events = await r.json();
    }

    // 持倉資料
    let holdings = null;
    if (holdRes.blobs.length > 0) {
      const r = await fetch(holdRes.blobs[0].url);
      holdings = await r.json();
    }

    // 組裝純文字報告
    const today = new Date().toLocaleDateString("zh-TW");
    let report = `# 持倉看板週報素材\n生成日期：${today}\n\n`;

    // 持倉明細
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

      // 獲利/虧損排行
      const winners = holdings.filter(h => h.pnl > 0).sort((a, b) => b.pct - a.pct);
      const losers = holdings.filter(h => h.pnl < 0).sort((a, b) => a.pct - b.pct);
      if (winners.length > 0) {
        report += `獲利排行：${winners.map(h => `${h.name}(+${h.pct}%)`).join("、")}\n`;
      }
      if (losers.length > 0) {
        report += `虧損排行：${losers.map(h => `${h.name}(${h.pct}%)`).join("、")}\n`;
      }
      report += `\n`;
    } else {
      report += `## 持倉明細\n（持倉數據尚未同步到雲端，請先在看板上刷新一次股價）\n\n`;
    }

    // 策略大腦
    if (brain) {
      report += `## 策略大腦\n`;
      report += `累計分析次數：${brain.stats?.totalAnalyses || 0}\n`;
      report += `命中率：${brain.stats?.hitRate || "計算中"}\n`;
      report += `最後更新：${brain.lastUpdate || "—"}\n\n`;

      if (brain.rules?.length > 0) {
        report += `核心策略規則：\n`;
        brain.rules.forEach((r, i) => { report += `${i + 1}. ${r}\n`; });
        report += `\n`;
      }

      if (brain.commonMistakes?.length > 0) {
        report += `常犯錯誤：${brain.commonMistakes.join("、")}\n\n`;
      }

      if (brain.lessons?.length > 0) {
        report += `最近教訓：\n`;
        brain.lessons.slice(-5).forEach(l => { report += `- [${l.date}] ${l.text}\n`; });
        report += `\n`;
      }
    } else {
      report += `## 策略大腦\n（尚未執行過收盤分析，策略大腦為空）\n\n`;
    }

    // 事件預測
    if (events && Array.isArray(events)) {
      const past = events.filter(e => e.status === "past");
      const pending = events.filter(e => e.status === "pending");
      const hits = past.filter(e => e.correct === true).length;
      const total = past.filter(e => e.correct !== null).length;

      report += `## 事件預測紀錄\n`;
      report += `總命中率：${total > 0 ? Math.round(hits / total * 100) + "%（" + hits + "/" + total + "）" : "尚無數據"}\n\n`;

      if (past.length > 0) {
        report += `已驗證（${past.length} 筆）：\n`;
        past.forEach(e => {
          report += `[${e.correct ? "✓準確" : "✗失誤"}] ${e.date} ${e.title}\n`;
          report += `  預測：${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | 結果：${e.actualNote || "—"}\n`;
          if (e.lessons) report += `  教訓：${e.lessons}\n`;
        });
        report += `\n`;
      }

      if (pending.length > 0) {
        report += `待驗證（${pending.length} 筆）：\n`;
        pending.forEach(e => {
          report += `[⏳] ${e.date} ${e.title}\n`;
          report += `  預測：${e.pred === "up" ? "看漲" : e.pred === "down" ? "看跌" : "中性"} | 理由：${e.predReason || "—"}\n`;
        });
        report += `\n`;
      }
    } else {
      report += `## 事件預測紀錄\n（事件數據尚未同步到雲端）\n\n`;
    }

    // 近期分析
    if (history.length > 0) {
      report += `## 近 7 日收盤分析\n\n`;
      history.forEach(r => {
        report += `【${r.date} ${r.time}】損益${r.totalTodayPnl >= 0 ? "+" : ""}${r.totalTodayPnl}\n`;
        if (r.aiInsight) {
          report += `${r.aiInsight}\n`;
        }
        report += `\n---\n\n`;
      });
    } else {
      report += `## 近 7 日收盤分析\n（尚無分析紀錄）\n\n`;
    }

    report += `---\n以上為持倉看板自動生成的週報素材，請根據這些數據撰寫 Podcast 腳本。\n`;

    return res.status(200).send(report);
  } catch (err) {
    return res.status(500).send(`生成週報失敗: ${err.message}`);
  }
}
