#!/usr/bin/env node
// Usage: node scripts/fetch-muzli-listicle.mjs <article-url> <dest-folder>
// Renders a muz.li blog listicle, dumps:
//   <dest>/page.html         — raw rendered HTML
//   <dest>/page-text.md      — structured: title / intro / each entry (heading + body + image URLs)
//   <dest>/img-NN.<ext>      — every figure image in entry order (numbered 01,02,...)

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import { createWriteStream } from "node:fs";

const [, , articleUrl, destDir] = process.argv;
if (!articleUrl || !destDir) {
  console.error("Usage: fetch-muzli-listicle.mjs <article-url> <dest-folder>");
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

console.log(`[fetch] ${articleUrl}`);
await page.goto(articleUrl, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);

// Scroll all the way down to trigger lazy-loaded images
const totalH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < totalH + 800; y += 600) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(220);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(700);

// Save raw HTML
const html = await page.content();
await fs.writeFile(path.join(destDir, "page.html"), html);

// Walk article DOM and pull title + entries
const article = await page.evaluate(() => {
  // muz.li uses Webflow / standard <article> or <main>. Try multiple candidates.
  const root =
    document.querySelector("article") ||
    document.querySelector("[class*='post-body']") ||
    document.querySelector("[class*='blog-post']") ||
    document.querySelector("main");
  if (!root) return null;

  const title = (document.querySelector("h1") || root.querySelector("h1"))?.innerText?.trim();

  // Collect children in document order: h2/h3 = entry boundary, p = body, figure/img = image
  const items = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  let node;
  while ((node = walker.nextNode())) {
    const tag = node.tagName.toLowerCase();
    if (tag === "h1") {
      items.push({ kind: "h1", text: node.innerText?.trim() });
    } else if (tag === "h2") {
      items.push({ kind: "h2", text: node.innerText?.trim() });
    } else if (tag === "h3") {
      items.push({ kind: "h3", text: node.innerText?.trim() });
    } else if (tag === "h4") {
      items.push({ kind: "h4", text: node.innerText?.trim() });
    } else if (tag === "p") {
      const txt = node.innerText?.trim();
      // Skip empty + nav-bullshit paragraphs
      if (txt && txt.length > 4) {
        // Capture inline links to original sources
        const links = Array.from(node.querySelectorAll("a"))
          .map((a) => ({ text: a.innerText?.trim(), href: a.getAttribute("href") }))
          .filter((l) => l.href && /^https?:/.test(l.href));
        items.push({ kind: "p", text: txt, links });
      }
    } else if (tag === "ul" || tag === "ol") {
      const lis = Array.from(node.querySelectorAll(":scope > li"))
        .map((li) => li.innerText?.trim())
        .filter(Boolean);
      if (lis.length) items.push({ kind: tag, items: lis });
    } else if (tag === "img") {
      // Pick best src — prefer data-src / srcset for lazy-loaded
      const src =
        node.getAttribute("src") ||
        node.getAttribute("data-src") ||
        node.getAttribute("data-lazy-src") ||
        "";
      const srcset = node.getAttribute("srcset") || "";
      const alt = node.getAttribute("alt") || "";
      // Prefer the largest item from srcset
      let best = src;
      if (srcset) {
        const candidates = srcset.split(",").map((s) => {
          const [u, w] = s.trim().split(/\s+/);
          return { u, w: parseInt((w || "0").replace("w", ""), 10) || 0 };
        });
        candidates.sort((a, b) => b.w - a.w);
        if (candidates[0]?.u) best = candidates[0].u;
      }
      if (best && /^https?:/.test(best)) {
        items.push({ kind: "img", src: best, alt });
      }
    } else if (tag === "iframe" || tag === "video") {
      const src = node.getAttribute("src") || node.getAttribute("data-src") || "";
      if (src) items.push({ kind: tag, src });
    } else if (tag === "blockquote") {
      const txt = node.innerText?.trim();
      if (txt) items.push({ kind: "blockquote", text: txt });
    }
  }
  return { title, items };
});

if (!article) {
  console.error("[err] no article root found");
  process.exit(2);
}

// Group items into "entries" — each h2 starts a new entry.
const entries = [];
let cur = { heading: article.title || "(intro)", level: "h1", body: [] };
for (const it of article.items) {
  if (it.kind === "h2") {
    if (cur.body.length > 0 || cur.heading !== article.title) entries.push(cur);
    cur = { heading: it.text, level: "h2", body: [] };
  } else if (it.kind === "h1") {
    // already used as title
  } else {
    cur.body.push(it);
  }
}
entries.push(cur);

// Compose markdown
const lines = [];
lines.push(`# ${article.title || "(no title)"}`);
lines.push("");
lines.push(`- **Source URL**：${articleUrl}`);
lines.push(`- **Fetched**：${new Date().toISOString()}`);
lines.push(`- **Entries**：${entries.length - 1}（不含 intro）`);
lines.push("");
lines.push("---");
lines.push("");

let imgCounter = 0;
const downloads = []; // { url, filename }
for (const e of entries) {
  if (e.level === "h1") lines.push(`## Intro / 全文導讀`);
  else lines.push(`## ${e.heading}`);
  lines.push("");
  for (const b of e.body) {
    if (b.kind === "h3") lines.push(`### ${b.text}\n`);
    else if (b.kind === "h4") lines.push(`#### ${b.text}\n`);
    else if (b.kind === "p") {
      lines.push(b.text);
      if (b.links && b.links.length) {
        for (const l of b.links) lines.push(`> 🔗 [${l.text || l.href}](${l.href})`);
      }
      lines.push("");
    } else if (b.kind === "ul" || b.kind === "ol") {
      for (const li of b.items) lines.push(`- ${li}`);
      lines.push("");
    } else if (b.kind === "blockquote") {
      lines.push(`> ${b.text.replace(/\n/g, "\n> ")}`);
      lines.push("");
    } else if (b.kind === "img") {
      imgCounter += 1;
      const num = String(imgCounter).padStart(2, "0");
      const ext = (b.src.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i)?.[1] || "png")
        .toLowerCase()
        .replace("jpeg", "jpg");
      const filename = `img-${num}.${ext}`;
      lines.push(`![${b.alt || "img " + num}](./${filename})`);
      lines.push(`> 🖼  source: \`${b.src}\``);
      lines.push("");
      downloads.push({ url: b.src, filename });
    } else if (b.kind === "iframe" || b.kind === "video") {
      lines.push(`> 🎬 ${b.kind}: \`${b.src}\``);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
}

await fs.writeFile(path.join(destDir, "page-text.md"), lines.join("\n"));
console.log(`[wrote] ${destDir}/page-text.md   ${entries.length - 1} entries / ${downloads.length} images`);

// Download every image (use Playwright request to retain referer + cookies)
for (const d of downloads) {
  try {
    const res = await page.request.get(d.url, { headers: { Referer: articleUrl } });
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
