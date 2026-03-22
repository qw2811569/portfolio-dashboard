// Vercel Serverless Function — 策略大腦讀寫
// 使用 Vercel Blob Storage (Public) 持久化策略知識庫
import { put, list, del } from '@vercel/blob';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;
const BRAIN_KEY = 'strategy-brain.json';
const HISTORY_PREFIX = 'analysis-history/';
const HISTORY_INDEX_KEY = 'analysis-history-index.json';

// 用 list + fetch 讀單一檔（get() 對 public store 會 403）
async function readPath(pathname, opts) {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, ...opts });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    return r.json();
  } catch { return null; }
}

// Public blob 可以直接 fetch URL 讀取（列表用途）
async function readBlob(blob) {
  const r = await fetch(blob.url);
  return r.json();
}

async function replaceSingleton(pathname, data, opts) {
  try {
    await del(pathname, opts);
  } catch {}
  if (data == null) return;
  await put(pathname, JSON.stringify(data), {
    contentType: 'application/json',
    access: 'public',
    addRandomSuffix: false,
    ...opts,
  });
}

async function updateHistoryIndex(report, opts) {
  const current = (await readPath(HISTORY_INDEX_KEY, opts)) || [];
  const next = [report, ...current.filter(item => item.id !== report.id)]
    .sort((a, b) => b.id - a.id)
    .slice(0, 30);
  await replaceSingleton(HISTORY_INDEX_KEY, next, opts);
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
        const brain = await readPath(BRAIN_KEY, opts);
        return res.status(200).json({ brain });
      }

      if (action === "history") {
        const cachedHistory = await readPath(HISTORY_INDEX_KEY, opts);
        if (cachedHistory) return res.status(200).json({ history: cachedHistory });
        const { blobs } = await list({ prefix: HISTORY_PREFIX, ...opts });
        const history = [];
        for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
          history.push(await readBlob(blob));
        }
        await replaceSingleton(HISTORY_INDEX_KEY, history, opts);
        return res.status(200).json({ history });
      }

      if (action === "all") {
        const brain = await readPath(BRAIN_KEY, opts);
        const history = (await readPath(HISTORY_INDEX_KEY, opts)) || [];
        return res.status(200).json({ brain, history });
      }

      return res.status(400).json({ error: "需要 action 參數 (brain/history/all)" });
    }

    // POST — 寫入
    if (req.method === "POST") {
      const { action, data } = req.body;

      if (action === "save-brain") {
        await replaceSingleton(BRAIN_KEY, data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "save-analysis") {
        const key = `${HISTORY_PREFIX}${data.date}-${Date.now()}.json`;
        await put(key, JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        await updateHistoryIndex(data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "save-events") {
        await replaceSingleton('events.json', data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "load-events") {
        return res.status(200).json({ events: await readPath('events.json', opts) });
      }

      if (action === "save-holdings") {
        await replaceSingleton('holdings.json', data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "load-holdings") {
        return res.status(200).json({ holdings: await readPath('holdings.json', opts) });
      }

      return res.status(400).json({ error: "未知 action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
