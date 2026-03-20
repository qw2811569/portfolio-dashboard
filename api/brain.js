// Vercel Serverless Function — 策略大腦讀寫
// 使用 Vercel Blob Storage (Public) 持久化策略知識庫
import { put, list, del } from '@vercel/blob';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;
const BRAIN_KEY = 'strategy-brain.json';
const HISTORY_PREFIX = 'analysis-history/';

// Public blob 可以直接 fetch URL 讀取
async function readBlob(blob) {
  const r = await fetch(blob.url);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const opts = { token: TOKEN };

  try {
    // GET — 讀取
    if (req.method === "GET") {
      const { action } = req.query;

      if (action === "brain") {
        const { blobs } = await list({ prefix: BRAIN_KEY, ...opts });
        if (blobs.length === 0) return res.status(200).json({ brain: null });
        const brain = await readBlob(blobs[0]);
        return res.status(200).json({ brain });
      }

      if (action === "history") {
        const { blobs } = await list({ prefix: HISTORY_PREFIX, ...opts });
        const history = [];
        for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
          history.push(await readBlob(blob));
        }
        return res.status(200).json({ history });
      }

      if (action === "all") {
        const { blobs: brainBlobs } = await list({ prefix: BRAIN_KEY, ...opts });
        const { blobs: histBlobs } = await list({ prefix: HISTORY_PREFIX, ...opts });
        let brain = null;
        if (brainBlobs.length > 0) brain = await readBlob(brainBlobs[0]);
        const history = [];
        for (const blob of histBlobs) history.push(await readBlob(blob));
        return res.status(200).json({ brain, history });
      }

      return res.status(400).json({ error: "需要 action 參數 (brain/history/all)" });
    }

    // POST — 寫入
    if (req.method === "POST") {
      const { action, data } = req.body;

      if (action === "save-brain") {
        const { blobs } = await list({ prefix: BRAIN_KEY, ...opts });
        for (const blob of blobs) await del(blob.url, opts);
        if (data) {
          await put(BRAIN_KEY, JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === "save-analysis") {
        const key = `${HISTORY_PREFIX}${data.date}-${Date.now()}.json`;
        await put(key, JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        return res.status(200).json({ ok: true });
      }

      if (action === "save-events") {
        const { blobs } = await list({ prefix: 'events.json', ...opts });
        for (const blob of blobs) await del(blob.url, opts);
        await put('events.json', JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        return res.status(200).json({ ok: true });
      }

      if (action === "load-events") {
        const { blobs } = await list({ prefix: 'events.json', ...opts });
        if (blobs.length === 0) return res.status(200).json({ events: null });
        return res.status(200).json({ events: await readBlob(blobs[0]) });
      }

      if (action === "save-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json', ...opts });
        for (const blob of blobs) await del(blob.url, opts);
        if (data) {
          await put('holdings.json', JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === "clear-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json', ...opts });
        for (const blob of blobs) await del(blob.url, opts);
        return res.status(200).json({ ok: true, deleted: blobs.length });
      }

      if (action === "load-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json', ...opts });
        if (blobs.length === 0) return res.status(200).json({ holdings: null });
        return res.status(200).json({ holdings: await readBlob(blobs[0]) });
      }

      return res.status(400).json({ error: "未知 action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
