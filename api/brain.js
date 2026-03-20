// Vercel Serverless Function — 策略大腦讀寫
// 使用 Vercel Blob Storage 持久化策略知識庫
import { put, list, del, head } from '@vercel/blob';

const BRAIN_KEY = 'strategy-brain.json';
const HISTORY_PREFIX = 'analysis-history/';

// 讀取 private blob
async function readBlob(blob) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  // 嘗試多種授權方式
  const r = await fetch(blob.url, {
    headers: {
      'x-vercel-blob-token': token,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) throw new Error(`Blob read failed: ${r.status} ${r.statusText}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — 讀取
    if (req.method === "GET") {
      const { action } = req.query;

      if (action === "brain") {
        const { blobs } = await list({ prefix: BRAIN_KEY });
        if (blobs.length === 0) return res.status(200).json({ brain: null });
        const brain = await readBlob(blobs[0]);
        return res.status(200).json({ brain });
      }

      if (action === "history") {
        const { blobs } = await list({ prefix: HISTORY_PREFIX });
        const history = [];
        for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
          history.push(await readBlob(blob));
        }
        return res.status(200).json({ history });
      }

      if (action === "all") {
        const { blobs: brainBlobs } = await list({ prefix: BRAIN_KEY });
        const { blobs: histBlobs } = await list({ prefix: HISTORY_PREFIX });
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
        const { blobs } = await list({ prefix: BRAIN_KEY });
        for (const blob of blobs) await del(blob.url);
        if (data) {
          await put(BRAIN_KEY, JSON.stringify(data), { contentType: 'application/json', access: 'private', addRandomSuffix: false });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === "save-analysis") {
        const key = `${HISTORY_PREFIX}${data.date}-${Date.now()}.json`;
        await put(key, JSON.stringify(data), { contentType: 'application/json', access: 'private', addRandomSuffix: false });
        return res.status(200).json({ ok: true });
      }

      if (action === "save-events") {
        const { blobs } = await list({ prefix: 'events.json' });
        for (const blob of blobs) await del(blob.url);
        await put('events.json', JSON.stringify(data), { contentType: 'application/json', access: 'private', addRandomSuffix: false });
        return res.status(200).json({ ok: true });
      }

      if (action === "load-events") {
        const { blobs } = await list({ prefix: 'events.json' });
        if (blobs.length === 0) return res.status(200).json({ events: null });
        return res.status(200).json({ events: await readBlob(blobs[0]) });
      }

      if (action === "save-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json' });
        for (const blob of blobs) await del(blob.url);
        await put('holdings.json', JSON.stringify(data), { contentType: 'application/json', access: 'private', addRandomSuffix: false });
        return res.status(200).json({ ok: true });
      }

      if (action === "load-holdings") {
        const { blobs } = await list({ prefix: 'holdings.json' });
        if (blobs.length === 0) return res.status(200).json({ holdings: null });
        const blob = blobs[0];
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        // 測試 Vercel Blob API 下載端點
        const tests = {};
        for (const [name, url] of [
          ['api-download', `https://vercel.com/api/blob/download?url=${encodeURIComponent(blob.url)}`],
          ['api-get', `https://vercel.com/api/blob?url=${encodeURIComponent(blob.url)}`],
          ['pathname', `https://p6zab0gnjublhvyz.private.blob.vercel-storage.com/holdings.json?token=${token}`],
        ]) {
          try {
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            tests[name] = { status: r.status, body: (await r.text()).substring(0, 300) };
          } catch (e) { tests[name] = { error: e.message }; }
        }
        return res.status(200).json({ tests });
      }

      return res.status(400).json({ error: "未知 action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
