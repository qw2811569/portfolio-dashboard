#!/usr/bin/env node

import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

const HOST = process.env.WEBHOOK_HOST || '127.0.0.1'
const PORT = Number(process.env.WEBHOOK_PORT || 3010)
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/github/webhook'
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ''
const DEPLOY_REPO_DIR = path.resolve(process.env.DEPLOY_REPO_DIR || process.cwd())
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main'
const DEPLOY_REMOTE = process.env.DEPLOY_REMOTE || 'origin'
// `--include=dev` is required because the webhook runs under PM2 with NODE_ENV=production
// (set by deploy/pm2-ecosystem.config.cjs). Without this flag npm 8+ silently omits
// devDependencies, so `vite` / `@vitejs/plugin-react` go missing and `vite build` fails.
// R31+1 incident: caused two days of "fix never deployed" because every webhook run
// silently failed at build-time without surfacing to git push exit status.
const INSTALL_COMMAND = process.env.DEPLOY_INSTALL_COMMAND || 'npm ci --include=dev'
const BUILD_COMMAND = process.env.DEPLOY_BUILD_COMMAND || 'npm run build'
const DIST_SOURCE_DIR = path.resolve(DEPLOY_REPO_DIR, process.env.DEPLOY_DIST_SOURCE_DIR || 'dist')
const DEPLOY_TARGET_ROOT = process.env.DEPLOY_TARGET_ROOT || '/var/www/app'
const ATOMIC_DEPLOY_SCRIPT = path.resolve(
  DEPLOY_REPO_DIR,
  process.env.ATOMIC_DEPLOY_SCRIPT || 'scripts/vm-atomic-deploy.sh'
)
const PM2_ECOSYSTEM = path.resolve(
  process.env.PM2_ECOSYSTEM || path.join(DEPLOY_REPO_DIR, 'deploy', 'pm2-ecosystem.config.cjs')
)
const PM2_ONLY = process.env.PM2_ONLY || 'jcv-api,agent-bridge,jcv-deploy-webhook'

let deploymentCounter = 0
let activeDeployment = null
const recentDeployments = []
let deploymentChain = Promise.resolve()

function log(message) {
  console.log(`[deploy-webhook] ${message}`)
}

function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) {
    return { ok: false, status: 503, error: 'webhook secret not configured' }
  }
  if (!signatureHeader) {
    return { ok: false, status: 401, error: 'missing signature' }
  }
  const expected = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')}`
  const received = Buffer.from(signatureHeader)
  const wanted = Buffer.from(expected)
  if (received.length !== wanted.length) {
    return { ok: false, status: 401, error: 'invalid signature' }
  }
  if (!crypto.timingSafeEqual(received, wanted)) {
    return { ok: false, status: 401, error: 'invalid signature' }
  }
  return { ok: true, status: 200, error: null }
}

function runCommand(command, { cwd = DEPLOY_REPO_DIR, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Command failed (${code}): ${command}`))
    })
    child.on('error', reject)
  })
}

async function atomicDeploy() {
  await fs.mkdir(DEPLOY_TARGET_ROOT, { recursive: true })
  await runCommand(`"${ATOMIC_DEPLOY_SCRIPT}" "${DIST_SOURCE_DIR}" "${DEPLOY_TARGET_ROOT}"`)
}

function recordDeployment(record) {
  recentDeployments.unshift(record)
  recentDeployments.splice(10)
  activeDeployment = record.status === 'running' ? record : null
}

async function runDeployment(context) {
  const id = ++deploymentCounter
  const startedAt = new Date().toISOString()
  const record = {
    id,
    status: 'running',
    startedAt,
    finishedAt: null,
    branch: context.branch,
    commit: context.commit,
    delivery: context.delivery,
    error: null,
  }
  recordDeployment(record)

  try {
    log(`starting deployment #${id} for ${context.branch} @ ${context.commit}`)
    await runCommand(`git fetch ${DEPLOY_REMOTE} ${DEPLOY_BRANCH}`)
    await runCommand(`git checkout ${DEPLOY_BRANCH}`)
    await runCommand(`git pull --ff-only ${DEPLOY_REMOTE} ${DEPLOY_BRANCH}`)
    await runCommand(INSTALL_COMMAND)
    await runCommand(BUILD_COMMAND)
    await atomicDeploy()
    await runCommand(
      `pm2 startOrReload "${PM2_ECOSYSTEM}" --only "${PM2_ONLY}" --update-env`,
      { cwd: DEPLOY_REPO_DIR }
    )

    record.status = 'succeeded'
    record.finishedAt = new Date().toISOString()
    log(`deployment #${id} succeeded`)
  } catch (error) {
    record.status = 'failed'
    record.finishedAt = new Date().toISOString()
    record.error = error?.message || 'unknown error'
    log(`deployment #${id} failed: ${record.error}`)
    throw error
  } finally {
    recordDeployment(record)
  }
}

function enqueueDeployment(context) {
  deploymentChain = deploymentChain
    .then(() => runDeployment(context))
    .catch((error) => {
      log(`queued deployment failed: ${error.message}`)
    })
  return deploymentChain
}

const app = express()
app.disable('x-powered-by')

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    activeDeployment,
    recentDeployments,
    deployRepoDir: DEPLOY_REPO_DIR,
    deployBranch: DEPLOY_BRANCH,
    deployTargetRoot: DEPLOY_TARGET_ROOT,
    currentRelease: path.join(DEPLOY_TARGET_ROOT, 'current'),
  })
})

app.post(
  WEBHOOK_PATH,
  express.raw({ type: '*/*', limit: '2mb' }),
  (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    const signatureHeader = req.get('x-hub-signature-256') || ''
    const signatureCheck = verifySignature(rawBody, signatureHeader)
    if (!signatureCheck.ok) {
      return res.status(signatureCheck.status).json({ ok: false, error: signatureCheck.error })
    }

    const event = req.get('x-github-event') || 'unknown'
    const delivery = req.get('x-github-delivery') || ''

    let payload = {}
    try {
      payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid json payload' })
    }

    if (event === 'ping') {
      return res.status(200).json({ ok: true, pong: true })
    }

    if (event !== 'push') {
      return res.status(202).json({ ok: true, ignored: `unsupported event ${event}` })
    }

    const branch = String(payload?.ref || '').replace(/^refs\/heads\//, '')
    if (branch !== DEPLOY_BRANCH) {
      return res.status(202).json({ ok: true, ignored: `push to ${branch}` })
    }

    if (payload?.deleted) {
      return res.status(202).json({ ok: true, ignored: 'deleted ref' })
    }

    const context = {
      branch,
      commit: payload?.after || '',
      delivery,
    }
    enqueueDeployment(context)

    return res.status(202).json({
      ok: true,
      queued: true,
      branch,
      commit: context.commit,
      delivery,
    })
  }
)

app.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}${WEBHOOK_PATH}`)
  log(`repo=${DEPLOY_REPO_DIR} branch=${DEPLOY_BRANCH} target=${DEPLOY_TARGET_ROOT}`)
})
