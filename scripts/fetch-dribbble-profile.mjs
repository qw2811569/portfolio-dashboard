#!/usr/bin/env node
// Usage: node scripts/fetch-dribbble-profile.mjs <profile-url> <dest-folder> [--top N=10] [--filter "<keyword>"]
// Visits a Dribbble profile (e.g. https://dribbble.com/RonDesignLab) and:
//   1. Lists all shots with title + URL + thumb
//   2. Saves catalog as <dest>/profile-shots.md
//   3. (Optional) Downloads top-N shot URLs for later parsing via parse-dribbble-shotdata.mjs
//      — by hitting each shot URL one-by-one (limited to top N to avoid burning bandwidth)

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const profileUrl = args[0];
const destDir = args[1];
const topNFlag = args.find((a) => a.startsWith("--top="));
const topN = topNFlag ? parseInt(topNFlag.split("=")[1], 10) : 10;
const filterFlag = args.find((a) => a.startsWith("--filter="));
const filter = filterFlag ? filterFlag.split("=")[1].toLowerCase() : null;

if (!profileUrl || !destDir) {
  console.error("Usage: fetch-dribbble-profile.mjs <profile-url> <dest> [--top=N] [--filter=keyword]");
  process.exit(1);
}
await fs.mkdir(destDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

console.log(`[fetch] ${profileUrl}`);
await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
// scroll to load shots
const totalH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < totalH * 2 + 1500; y += 800) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(280);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const shots = await page.evaluate(() => {
  const out = [];
  // Dribbble profile shots are linked via /shots/<id>-<slug>
  const seen = new Set();
  document.querySelectorAll("a[href^='/shots/']").forEach((a) => {
    const href = a.getAttribute("href");
    const m = href?.match(/^\/shots\/(\d+)-([\w-]+)/);
    if (!m) return;
    const id = m[1];
    if (seen.has(id)) return;
    seen.add(id);
    const slug = m[2];
    // Title: try to find an aria-label / title / surrounding text
    const title =
      a.getAttribute("aria-label") ||
      a.getAttribute("title") ||
      a.querySelector("img")?.getAttribute("alt") ||
      slug.replace(/-/g, " ");
    const thumb = a.querySelector("img")?.getAttribute("src") || "";
    out.push({
      id,
      slug,
      title: title.trim(),
      url: `https://dribbble.com${href.split("?")[0]}`,
      thumb,
    });
  });
  return out;
});

console.log(`[meta] found ${shots.length} shots`);

// Apply filter if provided
let filteredShots = shots;
if (filter) {
  filteredShots = shots.filter((s) => s.title.toLowerCase().includes(filter) || s.slug.toLowerCase().includes(filter));
  console.log(`[filter] '${filter}' kept ${filteredShots.length} shots`);
}

const topShots = filteredShots.slice(0, topN);

// Compose catalog markdown
const lines = [];
lines.push(`# Dribbble Profile Catalog — ${profileUrl.replace(/^https?:\/\//, "")}`);
lines.push("");
lines.push(`- **Source URL**：${profileUrl}`);
lines.push(`- **Fetched**：${new Date().toISOString()}`);
lines.push(`- **Total shots discovered**：${shots.length}`);
lines.push(`- **Filter**：${filter || "(none)"}`);
lines.push(`- **Top-N to deep-fetch**：${topN}`);
lines.push("");
lines.push("## All discovered shots");
lines.push("");
lines.push("| #   | Title                                  | URL                                      | Thumb                              |");
lines.push("| --- | -------------------------------------- | ---------------------------------------- | ---------------------------------- |");
shots.forEach((s, i) => {
  lines.push(`| ${i + 1}  | ${s.title.slice(0, 50)} | [${s.id}](${s.url}) | \`${s.thumb}\` |`);
});
lines.push("");
lines.push(`## Top-${topN} for deep-fetch`);
lines.push("");
lines.push("Run these via `fetch-dribbble-shot.mjs` + `parse-dribbble-shotdata.mjs` to get full case study text + originals:");
lines.push("");
topShots.forEach((s, i) => {
  lines.push(`### ${i + 1}. ${s.title}`);
  lines.push(`- URL: ${s.url}`);
  lines.push(`- Thumb: \`${s.thumb}\``);
  lines.push("");
});

await fs.writeFile(path.join(destDir, "profile-shots.md"), lines.join("\n"));
console.log(`[wrote] ${destDir}/profile-shots.md   ${shots.length} total / ${topShots.length} marked top-N`);

// Save top-N URL list as a plain file for batch driver
const urlListPath = path.join(destDir, "top-urls.txt");
await fs.writeFile(urlListPath, topShots.map((s) => s.url).join("\n") + "\n");
console.log(`[wrote] ${urlListPath}   (newline-delimited URLs for batch driver)`);

await browser.close();
console.log(`[done] ${destDir}`);
