#!/usr/bin/env node
// Generic public listing scraper for sites without a custom parser
// Usage: node scripts/fetch-listing-page.mjs <listing-url> <dest-folder> [--max-images=N]
//
// Renders the page with Playwright, scrolls to bottom, extracts:
//   - Title
//   - All visible <img> with high-res srcset variants (above min-size threshold)
//   - All <a> outbound links (heuristic: project links)
//   - Body text
//
// Writes:
//   <dest>/page.html
//   <dest>/page-text.md   — title / fetched at / body text + image refs / outbound links
//   <dest>/img-NN.<ext>   — first N images
//
// Designed for Awwwards / Codrops / Land-book / Httpster / SiteInspire / SaaSframe

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const url = args[0];
const destDir = args[1];
const maxImagesFlag = args.find((a) => a.startsWith("--max-images="));
const MAX_IMAGES = maxImagesFlag ? parseInt(maxImagesFlag.split("=")[1], 10) : 30;

if (!url || !destDir) {
  console.error("Usage: fetch-listing-page.mjs <url> <dest> [--max-images=N]");
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

console.log(`[fetch] ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);

const totalH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < totalH * 1.5 + 1000; y += 700) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(280);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const html = await page.content();
await fs.writeFile(path.join(destDir, "page.html"), html);

const data = await page.evaluate(() => {
  const title = document.querySelector("h1")?.innerText?.trim() || document.title;
  const ogDesc =
    document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
    document.querySelector("meta[name='description']")?.getAttribute("content") ||
    "";

  // Body text — major paragraphs only
  const paras = Array.from(document.querySelectorAll("p, h2, h3, h4"))
    .map((n) => ({ tag: n.tagName.toLowerCase(), text: n.innerText?.trim() }))
    .filter((p) => p.text && p.text.length > 6);

  // Outbound links (excluding anchors / nav)
  const outbound = Array.from(document.querySelectorAll("a[href^='http']"))
    .map((a) => ({ text: a.innerText?.trim(), href: a.getAttribute("href") }))
    .filter((l) => l.text && l.text.length > 3 && l.text.length < 80)
    .slice(0, 100);

  // Images — pick highest-res variant from srcset, drop tiny ones (likely icons)
  const imgs = [];
  const seen = new Set();
  document.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    const srcset = img.getAttribute("srcset") || "";
    const alt = img.getAttribute("alt") || "";
    let best = src;
    let bestW = 0;
    if (srcset) {
      const candidates = srcset.split(",").map((s) => {
        const [u, w] = s.trim().split(/\s+/);
        return { u, w: parseInt((w || "0").replace(/[^\d]/g, ""), 10) || 0 };
      });
      candidates.sort((a, b) => b.w - a.w);
      if (candidates[0]?.u) {
        best = candidates[0].u;
        bestW = candidates[0].w;
      }
    }
    if (!best || !/^https?:/.test(best)) return;
    if (seen.has(best)) return;
    seen.add(best);
    imgs.push({ src: best, alt, width: bestW });
  });

  return { title, ogDesc, paras, outbound, imgs };
});

// Sort images by intrinsic width if known (descending)
data.imgs.sort((a, b) => (b.width || 0) - (a.width || 0));
const topImgs = data.imgs.slice(0, MAX_IMAGES);

// Compose markdown
const lines = [];
lines.push(`# ${data.title}`);
lines.push("");
lines.push(`- **Source URL**：${url}`);
lines.push(`- **Fetched**：${new Date().toISOString()}`);
lines.push(`- **og:description**：${data.ogDesc.slice(0, 300)}`);
lines.push(`- **Total images discovered**：${data.imgs.length}（saved top ${topImgs.length}）`);
lines.push("");
lines.push("## Body text（major paragraphs）");
lines.push("");
for (const p of data.paras.slice(0, 60)) {
  if (p.tag === "h2") lines.push(`### ${p.text}`);
  else if (p.tag === "h3") lines.push(`#### ${p.text}`);
  else if (p.tag === "h4") lines.push(`##### ${p.text}`);
  else lines.push(p.text);
  lines.push("");
}
lines.push("## Outbound links（top 100 plain-text）");
lines.push("");
data.outbound.slice(0, 100).forEach((l) => lines.push(`- [${l.text}](${l.href})`));
lines.push("");
lines.push("## Images saved");
lines.push("");
topImgs.forEach((im, i) => {
  const num = String(i + 1).padStart(2, "0");
  const ext = (im.src.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)?.[1] || "png")
    .toLowerCase()
    .replace("jpeg", "jpg");
  lines.push(`- \`img-${num}.${ext}\` ← ${im.src}  ${im.width ? `(${im.width}w)` : ""}  alt="${im.alt}"`);
});

await fs.writeFile(path.join(destDir, "page-text.md"), lines.join("\n"));
console.log(`[wrote] ${destDir}/page-text.md  ${data.imgs.length} imgs (saving top ${topImgs.length})`);

// Download top images
let n = 0;
for (const im of topImgs) {
  n += 1;
  const num = String(n).padStart(2, "0");
  const ext = (im.src.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)?.[1] || "png")
    .toLowerCase()
    .replace("jpeg", "jpg");
  const filename = `img-${num}.${ext}`;
  const outPath = path.join(destDir, filename);
  try {
    const res = await page.request.get(im.src, { headers: { Referer: url } });
    if (!res.ok()) {
      console.warn(`[skip] ${im.src} ${res.status()}`);
      continue;
    }
    const buf = await res.body();
    await fs.writeFile(outPath, buf);
    console.log(`[saved] ${filename}  ${buf.length} bytes`);
  } catch (e) {
    console.warn(`[err] ${im.src} ${e.message}`);
  }
}

await browser.close();
console.log(`[done] ${destDir}`);
