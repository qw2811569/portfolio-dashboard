// Vercel Serverless Function — 策略大腦讀寫
// 本地檔案優先，Blob 為備份
import { put, list, del } from '@vercel/blob';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;
const BRAIN_KEY = 'strategy-brain.json';
const HISTORY_PREFIX = 'analysis-history/';
const HISTORY_INDEX_KEY = 'analysis-history-index.json';
const DATA_DIR = join(process.cwd(), 'data');

// ── 本地檔案讀寫 ──
function localPath(key) { return join(DATA_DIR, key.replace(/\//g, '__')); }

function readLocal(key) {
  try {
    const p = localPath(key);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch { return null; }
}

function writeLocal(key, data) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(localPath(key), JSON.stringify(data, null, 2));
  } catch {}
}

// ── Blob 讀寫（best-effort）──
async function readBlob(blob) {
  const r = await fetch(blob.url);
  return r.json();
}

async function readPath(pathname, opts) {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, ...opts });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    return r.json();
  } catch { return null; }
}

async function replaceSingleton(pathname, data, opts) {
  try { await del(pathname, opts); } catch {}
  if (data == null) return;
  await put(pathname, JSON.stringify(data), {
    contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts,
  });
}

// ── 讀取策略：本地優先 → Blob 補缺 ──
async function read(key, opts) {
  const local = readLocal(key);
  if (local) return local;
  const cloud = await readPath(key, opts);
  if (cloud) writeLocal(key, cloud); // 拉回本地快取
  return cloud;
}

// ── 寫入策略：本地一定寫，Blob best-effort ──
async function write(key, data, opts) {
  writeLocal(key, data);
  try { await replaceSingleton(key, data, opts); } catch {}
}

async function updateHistoryIndex(report, opts) {
  const current = readLocal(HISTORY_INDEX_KEY) || [];
  const next = [report, ...current.filter(item => item.id !== report.id)]
    .sort((a, b) => b.id - a.id)
    .slice(0, 30);
  await write(HISTORY_INDEX_KEY, next, opts);
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
        return res.status(200).json({ brain: await read(BRAIN_KEY, opts) });
      }

      if (action === "history") {
        const cached = await read(HISTORY_INDEX_KEY, opts);
        if (cached && cached.length > 0) return res.status(200).json({ history: cached });
        try {
          const { blobs } = await list({ prefix: HISTORY_PREFIX, ...opts });
          const history = [];
          for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
            history.push(await readBlob(blob));
          }
          if (history.length > 0) writeLocal(HISTORY_INDEX_KEY, history);
          return res.status(200).json({ history });
        } catch {
          return res.status(200).json({ history: [] });
        }
      }

      if (action === "all") {
        const brain = await read(BRAIN_KEY, opts);
        const history = (await read(HISTORY_INDEX_KEY, opts)) || [];
        return res.status(200).json({ brain, history });
      }

      return res.status(400).json({ error: "需要 action 參數 (brain/history/all)" });
    }

    // POST — 寫入
    if (req.method === "POST") {
      const { action, data } = req.body;

      if (action === "save-brain") {
        await write(BRAIN_KEY, data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "save-analysis") {
        const key = `${HISTORY_PREFIX}${data.date}-${data.id}.json`;
        writeLocal(key, data);
        try {
          await put(key, JSON.stringify(data), { contentType: 'application/json', access: 'public', addRandomSuffix: false, ...opts });
        } catch {}
        await updateHistoryIndex(data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "save-events") {
        await write('events.json', data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "load-events") {
        return res.status(200).json({ events: await read('events.json', opts) });
      }

      if (action === "save-holdings") {
        await write('holdings.json', data, opts);
        return res.status(200).json({ ok: true });
      }

      if (action === "load-holdings") {
        return res.status(200).json({ holdings: await read('holdings.json', opts) });
      }

      return res.status(400).json({ error: "未知 action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(200).json({ brain: null, history: [], events: null, holdings: null });
  }
}
