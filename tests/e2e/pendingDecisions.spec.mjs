import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import { writePendingDecisionsFixture } from '../../api/_lib/pending-decisions-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const PORT = 9654
const BASE_URL = `http://127.0.0.1:${PORT}`

async function waitForServer(url, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-decisions-e2e-'))
  const pendingPath = path.join(tmpDir, 'pending-decisions.jsonl')
  writePendingDecisionsFixture([
    {
      id: 'r129-order',
      createdAt: '2026-04-18T21:20:00Z',
      askedBy: 'claude',
      context: 'R129 · pending section order',
      question: 'Pending poster 要放在 Focus 後面嗎？',
      options: [
        { key: 'A', label: '放 Focus 後、Week 前' },
        { key: 'B', label: '放 Week 後、維持舊順序' },
      ],
      recommendation: 'A',
      recommendationReason: '決策比回顧更該先看到',
      status: 'pending',
      nextExpectedDecisionAt: '預計 3 天後 · L8 signoff 前',
    },
  ], pendingPath)

  const server = spawn('node', ['agent-bridge-standalone/server.mjs'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT: String(PORT),
      BRIDGE_DASHBOARD_PIN: '0306',
      PENDING_DECISIONS_PATH: pendingPath,
      WORKSPACE_ROOT: REPO_ROOT,
    },
  })

  let browser
  try {
    await waitForServer(`${BASE_URL}/api/health`)
    browser = await chromium.launch()
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    })

    await page.goto(`${BASE_URL}/dashboard/login.html`, {
      waitUntil: 'networkidle',
    })
    await page.locator('#pin').fill('0306')
    await page.getByRole('button', { name: '用 PIN 進入' }).click()
    await page.waitForURL(`${BASE_URL}/dashboard/`)

    await page.getByText('Pending Decision').waitFor()
    await page.getByText('Pending poster 要放在 Focus 後面嗎？').waitFor()
    await page.getByRole('button', { name: /放 Focus 後、Week 前/i }).click()

    await page.getByText('已回 A').waitFor()
    await page.getByText('No Questions').waitFor()
    await page.getByText('Claude / Codex 自動跑中').waitFor()

    const raw = fs.readFileSync(pendingPath, 'utf-8')
    assert.match(raw, /"status":"answered"/)
    assert.match(raw, /"answer":"A"/)
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exit(1)
})
