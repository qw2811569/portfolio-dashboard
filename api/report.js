// Vercel Serverless Function — 週報素材 API
// 回傳純文字格式，供 Claude.ai 或其他 AI 直接讀取
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  try {
    // 讀取策略大腦
    let brain = null;
    const { blobs: brainBlobs } = await list({ prefix: 'strategy-brain.json' });
    if (brainBlobs.length > 0) {
      const r = await fetch(brainBlobs[0].url);
      brain = await r.json();
    }

    // 讀取分析歷史（最近 7 筆）
    const { blobs: histBlobs } = await list({ prefix: 'analysis-history/' });
    const history = [];
    for (const blob of histBlobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 7)) {
      const r = await fetch(blob.url);
      history.push(await r.json());
    }

    // 讀取事件資料
    let events = null;
    const { blobs: evtBlobs } = await list({ prefix: 'events.json' });
    if (evtBlobs.length > 0) {
      const r = await fetch(evtBlobs[0].url);
      events = await r.json();
    }

    // 組裝純文字報告
    const today = new Date().toLocaleDateString("zh-TW");
    let report = `# 持倉看板週報素材\n生成日期：${today}\n\n`;

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
    }

    report += `---\n以上為持倉看板自動生成的週報素材，請根據這些數據撰寫 Podcast 腳本。\n`;

    return res.status(200).send(report);
  } catch (err) {
    return res.status(500).send(`生成週報失敗: ${err.message}`);
  }
}
