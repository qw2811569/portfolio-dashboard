#!/usr/bin/env node

const { chromium } = require("playwright");

const URL = process.env.APP_URL || "http://127.0.0.1:3002";
const REQUIRED_MARKERS = ["持倉看板", "持倉", "深度研究"];
const IGNORED_RESPONSE_PATTERNS = [/\/api\/target-prices\?code=/];
const NAVIGATION_TIMEOUT_MS = 20000;
const MARKER_TIMEOUT_MS = 90000;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const issues = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    const type = message.type();
    const text = message.text();
    if (/^Failed to load resource:/i.test(text)) return;
    if (type === "error" || /ReferenceError|TypeError/.test(text)) {
      issues.push(`console:${type}: ${text}`);
    }
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (IGNORED_RESPONSE_PATTERNS.some((pattern) => pattern.test(url))) return;
    issues.push(`response:${response.status()}: ${url}`);
  });

  try {
    // Local Vite cold starts can leave the document in an interactive state for a while
    // even though the app is still progressively loading modules. Accept the initial
    // navigation commit, then wait for the required UI markers instead.
    await page.goto(URL, { waitUntil: "commit", timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForFunction(
      (markers) => markers.every((marker) => document.body.innerText.includes(marker)),
      REQUIRED_MARKERS,
      { timeout: MARKER_TIMEOUT_MS }
    ).catch(() => {});
    const body = await page.locator("body").innerText();
    const missingMarkers = REQUIRED_MARKERS.filter((marker) => !body.includes(marker));

    if (missingMarkers.length > 0) {
      throw new Error(`missing UI markers: ${missingMarkers.join(", ")}`);
    }

    if (issues.length > 0) {
      throw new Error(issues.join("\n"));
    }

    console.log(`✅ UI smoke passed: ${URL}`);
    console.log(`Markers: ${REQUIRED_MARKERS.join(" / ")}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`❌ UI smoke failed: ${URL}`);
  console.error(error.message || error);
  process.exit(1);
});
