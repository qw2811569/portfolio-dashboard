#!/usr/bin/env node
// Parse Dribbble's embedded shotData JSON from saved page.html.
// Outputs:
//   <dest>/page-text.md       — structured: title / designer / tags / case-study sections in original order / media list
//   <dest>/img-NN-original.<ext>  — every original-resolution image (3200x2400 typical)
//   <dest>/video-NN.mp4        — case-study videos if present

import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";

const args = process.argv.slice(2);
const skipDownload = args.includes("--skip-download");
const destDir = args.find((a) => !a.startsWith("--"));
if (!destDir) {
  console.error("Usage: parse-dribbble-shotdata.mjs <dest-folder> [--skip-download]");
  process.exit(1);
}

const html = await fs.readFile(path.join(destDir, "page.html"), "utf8");

// Extract canonical og:url so the description file links back to source
const ogUrlMatch = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i);
const sourceUrl = ogUrlMatch?.[1] || "(unknown — see page.html)";

// Find the shotData literal — it appears as `shotData: {...},` inside a JS bootstrap block
// Grab from `shotData: ` to the matching closing `}` followed by `,\n` (then bracket-balance manually)
const startMarker = "shotData: ";
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) {
  console.error("shotData not found in", destDir);
  process.exit(2);
}
let depth = 0;
let inStr = false;
let strChar = "";
let escape = false;
let endIdx = -1;
for (let i = startIdx + startMarker.length; i < html.length; i += 1) {
  const ch = html[i];
  if (inStr) {
    if (escape) {
      escape = false;
    } else if (ch === "\\") {
      escape = true;
    } else if (ch === strChar) {
      inStr = false;
    }
    continue;
  }
  if (ch === '"' || ch === "'") {
    inStr = true;
    strChar = ch;
    continue;
  }
  if (ch === "{") depth += 1;
  else if (ch === "}") {
    depth -= 1;
    if (depth === 0) {
      endIdx = i + 1;
      break;
    }
  }
}
if (endIdx === -1) {
  console.error("shotData parse: did not find matching brace in", destDir);
  process.exit(3);
}
const jsonStr = html.slice(startIdx + startMarker.length, endIdx);

let shotData;
try {
  shotData = JSON.parse(jsonStr);
} catch (e) {
  console.error("JSON.parse failed:", e.message);
  process.exit(4);
}

const title = shotData.title || "(no title)";
const designer = shotData.shotUser?.name || "(unknown)";
const designerUrl = shotData.shotUser?.url ? `https://dribbble.com${shotData.shotUser.url}` : "";
const tags = shotData.tags || [];
const postedOn = shotData.postedOn || "";
const likes = shotData.likesCount || 0;
const views = shotData.viewsCount || 0;
const saves = shotData.savesCount || 0;
const comments = shotData.commentsCount || 0;

// contentBlocks.results: array, each has {position, contentType: 'text'|'image'|'video', content}
const blocks = (shotData.contentBlocks?.results || []).slice().sort(
  (a, b) => (a.position ?? 0) - (b.position ?? 0)
);

// Walk text doc into plain markdown
function nodeToMd(n) {
  if (!n) return "";
  if (n.type === "doc") return (n.content || []).map(nodeToMd).filter(Boolean).join("\n\n");
  if (n.type === "heading") {
    const level = n.attrs?.level || 1;
    const inner = (n.content || []).map(nodeToMd).join("");
    return `${"#".repeat(Math.min(level + 1, 6))} ${inner}`; // shift +1 so doc h1 -> md h2
  }
  if (n.type === "paragraph") {
    const inner = (n.content || []).map(nodeToMd).join("");
    return inner;
  }
  if (n.type === "text") {
    let txt = n.text ?? "";
    const marks = n.marks || [];
    if (marks.some((m) => m.type === "bold")) txt = `**${txt}**`;
    if (marks.some((m) => m.type === "italic")) txt = `*${txt}*`;
    if (marks.some((m) => m.type === "underline")) txt = `${txt}`; // md has no underline; leave plain
    const link = marks.find((m) => m.type === "link");
    if (link?.attrs?.href) txt = `[${txt}](${link.attrs.href})`;
    return txt;
  }
  if (n.type === "bulletList" || n.type === "orderedList") {
    return (n.content || []).map(nodeToMd).join("\n");
  }
  if (n.type === "listItem") {
    return "- " + (n.content || []).map(nodeToMd).join("\n  ");
  }
  if (n.type === "hardBreak") return "\n";
  if (n.content) return n.content.map(nodeToMd).join("");
  return "";
}

// Build markdown narrative
const sections = [];
const mediaItems = []; // { kind: 'image'|'video', position, url, width, height, ext, alt, still? }
for (const block of blocks) {
  if (block.contentType === "text") {
    const md = nodeToMd(block.content?.text);
    if (md.trim()) sections.push({ position: block.position, kind: "text", md });
  } else if (block.contentType === "image" || block.contentType === "video") {
    const ua = block.userUploadsAttributes?.[0];
    const url = ua?.originalUrl;
    const w = ua?.fileDetails?.metadata?.width;
    const h = ua?.fileDetails?.metadata?.height;
    const mime = ua?.fileDetails?.metadata?.mimeType || "";
    let ext = mime.split("/")[1] || "bin";
    if (ext === "jpeg") ext = "jpg";
    if (url) {
      mediaItems.push({
        kind: block.contentType,
        position: block.position,
        url,
        width: w,
        height: h,
        ext,
        alt: block.content?.alt || "",
        still: ua?.fileDetails?.derivatives?.still
          ? `https://cdn.dribbble.com/${ua.fileDetails.derivatives.still.id}`
          : null,
      });
    }
  }
}

// Compose markdown
const lines = [];
lines.push(`# Dribbble shot — ${title}`);
lines.push("");
lines.push(`- **Source URL**：${sourceUrl}`);
lines.push(`- **Designer**：[${designer}](${designerUrl})`);
lines.push(`- **Posted**：${postedOn}`);
lines.push(`- **Likes / Saves / Views / Comments**：${likes} / ${saves} / ${views} / ${comments}`);
lines.push(`- **Tags**：${tags.join(", ")}`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## Designer's case-study text（依原 position 排序）`);
lines.push(``);

// Interleave text + media markers in position order
const allBlocks = [...sections.map((s) => ({ ...s, type: "text" })), ...mediaItems.map((m) => ({ position: m.position, type: m.kind, media: m }))];
allBlocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

for (const item of allBlocks) {
  if (item.type === "text") {
    lines.push(item.md);
    lines.push("");
  } else if (item.type === "image") {
    lines.push(`> 🖼  [image position=${item.position}] ${item.media.width}×${item.media.height} → \`${item.media.url}\``);
    lines.push("");
  } else if (item.type === "video") {
    lines.push(`> 🎬 [video position=${item.position}] ${item.media.width}×${item.media.height} → \`${item.media.url}\``);
    lines.push("");
  }
}

lines.push(`---`);
lines.push(``);
lines.push(`## Media manifest`);
lines.push(``);
for (const m of mediaItems) {
  lines.push(`- **${m.kind}** (pos=${m.position}) ${m.width}×${m.height}  \`${m.url}\``);
}
lines.push("");

await fs.writeFile(path.join(destDir, "page-text.md"), lines.join("\n"));
console.log(`[wrote] ${destDir}/page-text.md   (${sections.length} text blocks, ${mediaItems.length} media)`);

// Download originals
function fetchToFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStreamSync(outPath);
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://dribbble.com/",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.end();
          fetchToFile(res.headers.location, outPath).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.end();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      }
    );
    req.on("error", reject);
  });
}

import { createWriteStream as createWriteStreamSync } from "node:fs";

if (skipDownload) {
  console.log(`[skip] media download (--skip-download)`);
} else {
  let idx = 0;
  for (const m of mediaItems) {
    idx += 1;
    const num = String(idx).padStart(2, "0");
    const name = `${m.kind === "video" ? "video" : "img"}-${num}-original.${m.ext}`;
    const outPath = path.join(destDir, name);
    try {
      await fetchToFile(m.url, outPath);
      const stat = await fs.stat(outPath);
      console.log(`[saved] ${name}  ${stat.size} bytes  ${m.width}×${m.height}`);
    } catch (e) {
      console.warn(`[err] ${m.url} ${e.message}`);
    }
  }
}
console.log(`[done] ${destDir}`);
