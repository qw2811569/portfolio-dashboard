// Vercel Serverless Function — 策略大腦讀寫
// 使用 Vercel Blob Storage 持久化策略知識庫
// 所有裝置共用同一份策略大腦
import { put, list, del } from '@vercel/blob';

const BRAIN_KEY = 'strategy-brain.json';
const HISTORY_PREFIX = 'analysis-history/';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — 讀取策略大腦
    if (req.method === "GET") {
      const { action } = req.query;

      if (action === "brain") {
        const { blobs } = await list({ prefix: BRAIN_KEY });
        if (blobs.length === 0) return res.status(200).json({ brain: null });
        const response = await fetch(blobs[0].url);
        const brain = await response.json();
        return res.status(200).json({ brain });
      }

      if (action === "history") {
        const { blobs } = await list({ prefix: HISTORY_PREFIX });
        const history = [];
        for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
          const response = await fetch(blob.url);
          history.push(await response.json());
        }
        return res.status(200).json({ history });
      }

      if (action === "all") {
        // 匯出全部資料
        const { blobs: brainBlobs } = await list({ prefix: BRAIN_KEY });
        const { blobs: histBlobs } = await list({ prefix: HISTORY_PREFIX });
        let brain = null;
        if (brainBlobs.length > 0) {
          const r = await fetch(brainBlobs[0].url);
          brain = await r.json();
        }
        const history = [];
        for (const blob of histBlobs) {
          const r = await fetch(blob.url);
          history.push(await r.json());
        }
        return res.status(200).json({ brain, history });
      }

      return res.status(400).json({ error: "需要 action 參數 (brain/history/all)" });
    }

    // POST — 寫入
    if (req.method === "POST") {
      const { action, data } = req.body;

      if (action === "save-brain") {
        // 先刪除舊的
        const { blobs } = await list({ prefix: BRAIN_KEY });
        for (const blob of blobs) await del(blob.url);
        // 寫入新的
        await put(BRAIN_KEY, JSON.stringify(data), {
          contentType: 'application/json',
          access: 'public',
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "save-analysis") {
        const key = `${HISTORY_PREFIX}${data.date}-${Date.now()}.json`;
        await put(key, JSON.stringify(data), {
          contentType: 'application/json',
          access: 'public',
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "save-events") {
        // 刪除舊的
        const { blobs } = await list({ prefix: 'events.json' });
        for (const blob of blobs) await del(blob.url);
        await put('events.json', JSON.stringify(data), {
          contentType: 'application/json',
          access: 'public',
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "load-events") {
        const { blobs } = await list({ prefix: 'events.json' });
        if (blobs.length === 0) return res.status(200).json({ events: null });
        const r = await fetch(blobs[0].url);
        return res.status(200).json({ events: await r.json() });
      }

      if (action === "save-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json' });
        for (const blob of blobs) await del(blob.url);
        await put('holdings.json', JSON.stringify(data), {
          contentType: 'application/json',
          access: 'public',
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "load-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json' });
        if (blobs.length === 0) return res.status(200).json({ holdings: null });
        const r = await fetch(blobs[0].url);
        return res.status(200).json({ holdings: await r.json() });
      }

      return res.status(400).json({ error: "未知 action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
