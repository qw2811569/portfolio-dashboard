#!/usr/bin/env node
// Usage: node scripts/fetch-dribbble-shot.mjs <shot-url> <dest-folder>
// Renders a Dribbble shot page with chromium (handles WAF challenge),
// then dumps:
//   <dest>/page.html               — raw rendered HTML
//   <dest>/page-text.md            — extracted designer description + meta
//   <dest>/img-NN.<ext>            — every shot image (cdn.dribbble.com)

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const [, , shotUrl, destDir] = process.argv;
if (!shotUrl || !destDir) {
  console.error("Usage: fetch-dribbble-shot.mjs <shot-url> <dest-folder>");
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

console.log(`[fetch] ${shotUrl}`);
await page.goto(shotUrl, { waitUntil: "networkidle", timeout: 90000 });
// Wait for shot-description-container to actually have content (JS-rendered)
await page
  .waitForFunction(
    () => {
      const c = document.querySelector(".shot-description-container");
      return c && (c.innerText?.trim().length > 20 || c.children.length > 0);
    },
    { timeout: 25000 }
  )
  .catch(() => {});
// Scroll a bit to trigger any lazy stuff
await page.evaluate(() => window.scrollTo(0, 800));
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const html = await page.content();
await fs.writeFile(path.join(destDir, "page.html"), html);

// Extract designer text + image URLs from rendered DOM
const meta = await page.evaluate(() => {
  const pickText = (sel) =>
    Array.from(document.querySelectorAll(sel))
      .map((n) => n.innerText?.trim())
      .filter(Boolean);

  const title =
    document.querySelector("h1")?.innerText?.trim() ||
    document.title?.replace(/\s+\|\s+Dribbble.*$/, "").trim();

  // Designer name (link in header area)
  const designer =
    document.querySelector(".user-name, .shot-byline a, .user-information a, [data-author-name]")
      ?.innerText?.trim() || "";
  const designerBio =
    document.querySelector(".user-bio")?.innerText?.trim() || "";

  // Description body — Dribbble renders the designer copy inside .shot-description-container
  const descNodes = Array.from(
    document.querySelectorAll(
      ".shot-description-container, .shot-description, .shot-desc, .desc, [data-test-id='shot-description']"
    )
  );
  const description = descNodes.map((n) => n.innerText?.trim()).filter(Boolean).join("\n\n");

  // Tags
  const tags = pickText(".shot-tags a, .tags a, .single-shot-tags a, [class*='tag'] a").filter(
    (t) => t.length > 0 && t.length < 40
  );

  // Image URLs — pick all img src + srcset that point to dribbble cdn
  const urls = new Set();
  document.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    const srcset = img.getAttribute("srcset");
    [src, srcset].forEach((v) => {
      if (!v) return;
      v.split(",").forEach((piece) => {
        const u = piece.trim().split(" ")[0];
        if (/cdn\.dribbble\.com|dribbble\.com\/userupload/.test(u)) urls.add(u);
      });
    });
  });
  // Also pick from <picture><source srcset=...>
  document.querySelectorAll("source").forEach((s) => {
    const v = s.getAttribute("srcset");
    if (!v) return;
    v.split(",").forEach((piece) => {
      const u = piece.trim().split(" ")[0];
      if (/cdn\.dribbble\.com|dribbble\.com\/userupload/.test(u)) urls.add(u);
    });
  });

  // Bonus: og:image / twitter:image
  document.querySelectorAll("meta").forEach((m) => {
    const p = m.getAttribute("property") || m.getAttribute("name");
    const c = m.getAttribute("content");
    if (!c) return;
    if (/og:image|twitter:image/i.test(p || "") && /cdn\.dribbble\.com/.test(c)) {
      urls.add(c);
    }
  });

  return { title, designer, designerBio, tags, description, urls: Array.from(urls) };
});

// Filter to "shot" hero images (skip avatars + thumbs); keep the highest-res variant per ID
const shotUrls = [];
const seenBase = new Map();
for (const u of meta.urls) {
  // Skip avatars
  if (/\/avatars\//.test(u)) continue;
  // Skip very small variants (we want the original)
  // Group by canonical "id" — strip size-suffix patterns
  const key = u.replace(/\?.*$/, "").replace(/_\dx\.|_(thumb|small|medium|large)\./, "_X.");
  if (!seenBase.has(key)) {
    seenBase.set(key, u);
    shotUrls.push(u);
  }
}

console.log(`[meta] title=${meta.title} | designer=${meta.designer} | tags=${meta.tags.length} | urls=${shotUrls.length}/${meta.urls.length}`);

// Save page-text.md
const md = [
  `# Dribbble shot — ${meta.title || ""}`,
  ``,
  `- **Source URL**：${shotUrl}`,
  `- **Designer**：${meta.designer || "(parse failed)"}${meta.designerBio ? ` — ${meta.designerBio}` : ""}`,
  `- **Tags**：${meta.tags.join(", ") || "(none)"}`,
  `- **Fetched**：${new Date().toISOString()}`,
  ``,
  `## Description（designer 原文）`,
  ``,
  meta.description || "(empty / parse failed — see page.html)",
  ``,
  `## Image URLs (filtered shot images)`,
  ``,
  ...shotUrls.map((u) => `- ${u}`),
  ``,
  `## Image URLs (raw, all)`,
  ``,
  ...meta.urls.map((u) => `- ${u}`),
  ``,
].join("\n");
await fs.writeFile(path.join(destDir, "page-text.md"), md);

// Download each shot image
let i = 0;
for (const url of shotUrls) {
  i += 1;
  const ext = (url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)?.[1] || "png").toLowerCase().replace("jpeg", "jpg");
  const filename = `img-${String(i).padStart(2, "0")}.${ext}`;
  const out = path.join(destDir, filename);
  try {
    const res = await page.request.get(url, { headers: { Referer: shotUrl } });
    if (!res.ok()) {
      console.warn(`[skip] ${url} ${res.status()}`);
      continue;
    }
    const buf = await res.body();
    await fs.writeFile(out, buf);
    console.log(`[saved] ${filename}  ${buf.length} bytes`);
  } catch (e) {
    console.warn(`[err] ${url} ${e.message}`);
  }
}

await browser.close();
console.log(`[done] ${destDir}`);
