import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { queryFinMindDataset } = vi.hoisted(() => ({
  queryFinMindDataset: vi.fn(),
}))

vi.mock('../../api/_lib/finmind-governor.js', () => ({
  queryFinMindDataset,
}))

import { runSnapshotWorker } from '../../agent-bridge-standalone/workers/snapshot-worker.mjs'

async function writeJson(targetPath, payload) {
  await fsPromises.mkdir(path.dirname(targetPath), { recursive: true })
  await fsPromises.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8')
}

describe('snapshot-worker', () => {
  let tempRoot = ''

  afterEach(async () => {
    vi.restoreAllMocks()
    queryFinMindDataset.mockReset()
    if (tempRoot) {
      await fsPromises.rm(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  it('writes the daily snapshot tree, manifest, dated marker, and cron marker', async () => {
    tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'snapshot-worker-'))
    queryFinMindDataset.mockResolvedValue([
      {
        date: '2026-04-24',
        close: 82,
        spread: 1.5,
        open: 81.2,
        max: 82.4,
        min: 81.1,
        Trading_Volume: 123456,
      },
    ])

    await writeJson(path.join(tempRoot, 'data', 'research-index.json'), {
      schemaVersion: 1,
      items: [{ id: 'research-1' }],
    })
    await writeJson(path.join(tempRoot, 'data', 'strategy-brain.json'), {
      schemaVersion: 4,
      rules: ['keep sizing tight'],
    })
    await writeJson(path.join(tempRoot, 'data', 'analysis-history-index.json'), {
      schemaVersion: 1,
      items: [{ id: 'analysis-1' }],
    })
    await writeJson(path.join(tempRoot, 'data', 'analysis-history__2026__04__23-1.json'), {
      schemaVersion: 1,
      id: 'analysis-1',
      date: '2026-04-23',
    })
    await writeJson(path.join(tempRoot, '.tmp', 'localstorage-backups', 'latest.json'), {
      version: 1,
      app: 'portfolio-dashboard',
      exportedAt: '2026-04-24T02:55:00.000+08:00',
      storage: {
        'pf-portfolios-v1': [
          { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' },
          { id: '7865', name: '金聯成', isOwner: false, createdAt: '2026-04-02' },
        ],
        'pf-active-portfolio-v1': 'me',
        'pf-view-mode-v1': 'portfolio',
        'pf-schema-version': 3,
        'pf-me-holdings-v2': [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
        'pf-me-log-v2': [{ id: 'trade-1', code: '2330', action: '買進' }],
        'pf-me-targets-v1': { 2330: { consensus: 1200 } },
        'pf-me-fundamentals-v1': { 2330: { eps: 45 } },
        'pf-me-news-events-v1': [{ id: 'event-1', title: '法說會' }],
        'pf-me-research-history-v1': [{ id: 'rh-1', title: '台積電更新' }],
        'pf-7865-holdings-v2': [],
        'pf-7865-log-v2': [],
        'pf-7865-targets-v1': {},
        'pf-7865-fundamentals-v1': {},
        'pf-7865-news-events-v1': [],
        'pf-7865-research-history-v1': [],
      },
    })

    const writes = []
    const putImpl = vi.fn(async (pathname, content) => {
      writes.push([pathname, String(content)])
      return {
        url: `https://blob.example/${pathname}`,
      }
    })

    const result = await runSnapshotWorker({
      now: new Date('2026-04-24T03:00:00+08:00'),
      repoRoot: tempRoot,
      token: 'blob-token',
      putImpl,
      getImpl: vi.fn(),
      listImpl: vi.fn(async () => ({ blobs: [], cursor: null })),
      delImpl: vi.fn(async () => undefined),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })

    expect(result).toMatchObject({
      ok: true,
      snapshotDate: '2026-04-24',
      fileCount: expect.any(Number),
    })

    const writtenPathnames = writes.map(([pathname]) => pathname)
    expect(writtenPathnames).toContain('snapshot/research/2026-04-24/research-index.json')
    expect(writtenPathnames).toContain(
      'snapshot/research/2026-04-24/portfolio-me-research-history.json'
    )
    expect(writtenPathnames).toContain('snapshot/brain/2026-04-24/strategy-brain.json')
    expect(writtenPathnames).toContain(
      'snapshot/brain/2026-04-24/analysis-history/2026/04/23-1.json'
    )
    expect(writtenPathnames).toContain('snapshot/portfolio-state/2026-04-24/me/holdings.json')
    expect(writtenPathnames).toContain('snapshot/benchmark/2026-04-24.json')
    expect(writtenPathnames).toContain('snapshot/localStorage-checkpoint/2026-04-24.json')
    expect(writtenPathnames).toContain('snapshot/daily-manifest/2026-04-24.json')
    expect(writtenPathnames).toContain('last-success/daily-snapshot/2026-04-24.txt')
    expect(writtenPathnames).toContain('last-success-daily-snapshot.json')

    const manifestText =
      writes.find(([pathname]) => pathname === 'snapshot/daily-manifest/2026-04-24.json')?.[1] || ''
    const manifest = JSON.parse(manifestText)

    expect(manifest).toMatchObject({
      snapshotDate: '2026-04-24',
      schemaVersion: 1,
      portfolios: ['me', '7865'],
    })
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: 'snapshot/benchmark/2026-04-24.json',
          checksum: expect.any(String),
        }),
        expect.objectContaining({
          pathname: 'snapshot/portfolio-state/2026-04-24/me/tradeLog.json',
          checksum: expect.any(String),
        }),
        expect.objectContaining({
          pathname: 'snapshot/localStorage-checkpoint/2026-04-24.json',
          schemaVersion: 1,
        }),
      ])
    )
  })
})
