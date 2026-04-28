#!/usr/bin/env node
// Usage: node scripts/fetch-behance-gallery.mjs <gallery-url> <dest-folder>
// Renders a Behance project gallery, dumps:
//   <dest>/page.html         — raw rendered HTML
//   <dest>/page-text.md      — title / owner / description / module text + image refs
//   <dest>/img-NN.<ext>      — every project module image in document order

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const [, , galleryUrl, destDir] = process.argv;
if (!galleryUrl || !destDir) {
  console.error("Usage: fetch-behance-gallery.mjs <gallery-url> <dest-folder>");
  process.exit(1);
}
await fs.mkdir(destDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});
const page = await ctx.newPage();

console.log(`[fetch] ${galleryUrl}`);
await page.goto(galleryUrl, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);

// scroll all the way down so lazy-loaded module images render
const totalH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < totalH + 1500; y += 600) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(280);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const html = await page.content();
await fs.writeFile(path.join(destDir, "page.html"), html);

const meta = await page.evaluate(() => {
  const pickMeta = (prop) =>
    document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") ||
    document.querySelector(`meta[name="${prop}"]`)?.getAttribute("content") ||
    "";
  const title =
    document.querySelector("h1")?.innerText?.trim() ||
    pickMeta("og:title") ||
    document.title;
  const ogDesc = pickMeta("og:description") || pickMeta("description");
  const ogUrl = pickMeta("og:url") || location.href;

  // Owners: behance has multiple owner-link nodes
  const owners = Array.from(
    document.querySelectorAll("a[href*='/']")
  )
    .filter((a) => /^\/[^\/]+\/?$/.test(a.getAttribute("href") || ""))
    .map((a) => ({ name: a.innerText?.trim(), url: `https://www.behance.net${a.getAttribute("href")}` }))
    .filter((o) => o.name && o.name.length > 1 && o.name.length < 60)
    .slice(0, 8);

  // Project description: behance usually wraps the text modules in [class*='Project-'] or similar
  // Walk the DOM in order: text modules vs image modules
  const root =
    document.querySelector("[class*='ProjectModuleContainer']") ||
    document.querySelector("[class*='Project-modules']") ||
    document.querySelector("main") ||
    document.body;

  // Collect inline text + image src in document order
  const items = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  let node;
  while ((node = tw.nextNode())) {
    const tag = node.tagName.toLowerCase();
    if (["h1", "h2", "h3", "h4", "h5"].includes(tag)) {
      const t = node.innerText?.trim();
      if (t) items.push({ kind: tag, text: t });
    } else if (tag === "p") {
      const t = node.innerText?.trim();
      if (t && t.length > 6 && !/^(Follow|Like|Share|Save)/i.test(t)) {
        items.push({ kind: "p", text: t });
      }
    } else if (tag === "img") {
      const src = node.getAttribute("src") || node.getAttribute("data-src") || "";
      const srcset = node.getAttribute("srcset") || "";
      const alt = node.getAttribute("alt") || "";
      let best = src;
      if (srcset) {
        const candidates = srcset.split(",").map((s) => {
          const [u, w] = s.trim().split(/\s+/);
          return { u, w: parseInt((w || "0").replace(/[^\d]/g, ""), 10) || 0 };
        });
        candidates.sort((a, b) => b.w - a.w);
        if (candidates[0]?.u) best = candidates[0].u;
      }
      if (
        best &&
        /^https?:/.test(best) &&
        /(behance\.net|adobe|behanceCDN)/i.test(best) === false ? /^https?:/.test(best) : true
      ) {
        // Skip avatars (small) — Behance avatars are usually 138 / 50 px
        if (!/avatars/i.test(best) && !best.endsWith(".gif")) {
          items.push({ kind: "img", src: best, alt });
        }
      }
    } else if (tag === "video") {
      const src = node.getAttribute("src") || node.querySelector("source")?.getAttribute("src") || "";
      if (src) items.push({ kind: "video", src });
    }
  }

  return { title, ogDesc, ogUrl, owners, items };
});

// Compose markdown
const lines = [];
lines.push(`# Behance gallery — ${meta.title}`);
lines.push("");
lines.push(`- **Source URL**：${meta.ogUrl || galleryUrl}`);
lines.push(`- **og:description**：${meta.ogDesc || "(none)"}`);
lines.push(`- **Owners (best-effort parse)**：${meta.owners.map((o) => `[${o.name}](${o.url})`).join(", ") || "(none)"}`);
lines.push(`- **Fetched**：${new Date().toISOString()}`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Project body（modules in document order）");
lines.push("");

let imgIdx = 0;
const downloads = [];
for (const it of meta.items) {
  if (["h1", "h2", "h3", "h4", "h5"].includes(it.kind)) {
    const level = parseInt(it.kind.slice(1), 10);
    lines.push(`${"#".repeat(Math.min(level + 1, 6))} ${it.text}`);
    lines.push("");
  } else if (it.kind === "p") {
    lines.push(it.text);
    lines.push("");
  } else if (it.kind === "img") {
    imgIdx += 1;
    const num = String(imgIdx).padStart(2, "0");
    const ext = (it.src.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)?.[1] || "png")
      .toLowerCase()
      .replace("jpeg", "jpg");
    const filename = `img-${num}.${ext}`;
    lines.push(`![${it.alt || "img " + num}](./${filename})`);
    lines.push(`> 🖼  source: \`${it.src}\``);
    lines.push("");
    downloads.push({ url: it.src, filename });
  } else if (it.kind === "video") {
    lines.push(`> 🎬 video: \`${it.src}\``);
    lines.push("");
  }
}

await fs.writeFile(path.join(destDir, "page-text.md"), lines.join("\n"));
console.log(`[wrote] page-text.md   ${meta.items.length} items / ${downloads.length} images`);

for (const d of downloads) {
  try {
    const res = await page.request.get(d.url, { headers: { Referer: galleryUrl } });
    if (!res.ok()) {
      console.warn(`[skip] ${d.url} ${res.status()}`);
      continue;
    }
    const buf = await res.body();
    await fs.writeFile(path.join(destDir, d.filename), buf);
    console.log(`[saved] ${d.filename}  ${buf.length} bytes`);
  } catch (e) {
    console.warn(`[err] ${d.url} ${e.message}`);
  }
}

await browser.close();
console.log(`[done] ${destDir}`);
