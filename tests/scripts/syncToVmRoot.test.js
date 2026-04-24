import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildVercelMirror, parseArgs } from '../../scripts/sync-to-vm-root.mjs'

function createMockResponse(
  body,
  { contentType = 'text/plain; charset=utf-8', status = 200, url } = {}
) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  return {
    status,
    url,
    headers: new Headers({ 'content-type': contentType }),
    async text() {
      return buffer.toString('utf8')
    },
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    },
  }
}

describe('sync-to-vm-root', () => {
  it('parses mirror mode without changing legacy flags', () => {
    expect(
      parseArgs([
        '--mirror-vercel',
        '--dry-run',
        '--prod-url=https://example.vercel.app',
        '--backup-dir=/tmp/backup',
      ])
    ).toMatchObject({
      mirrorVercel: true,
      dryRun: true,
      prodUrl: 'https://example.vercel.app',
      backupDir: '/tmp/backup',
    })
  })

  it('builds dist-from-vercel by crawling same-origin html/css/js assets', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sync-to-vm-root-'))
    const responses = new Map([
      [
        'https://example.vercel.app/',
        createMockResponse(
          `<!doctype html>
          <html>
            <head>
              <style>@font-face { src: url('/fonts/SourceHanSansTC-Regular.woff2'); }</style>
              <link rel="icon" href="/favicon.svg" />
              <link rel="stylesheet" href="/assets/index-BBB.css" />
              <script type="module" src="/assets/index-AAA.js"></script>
            </head>
          </html>`,
          { contentType: 'text/html; charset=utf-8', url: 'https://example.vercel.app/' }
        ),
      ],
      [
        'https://example.vercel.app/assets/index-AAA.js',
        createMockResponse(
          `import "./lazy-CCC.js";
          const featureLoader = () => import("./feature-DDD.js");
          const logo = "/icons/app.svg";
          const ignored = "/portfolio-report/progress.json";
          console.log(featureLoader, logo, ignored);`,
          {
            contentType: 'application/javascript',
            url: 'https://example.vercel.app/assets/index-AAA.js',
          }
        ),
      ],
      [
        'https://example.vercel.app/assets/index-BBB.css',
        createMockResponse(`body { background-image: url('/images/hero.png'); }`, {
          contentType: 'text/css',
          url: 'https://example.vercel.app/assets/index-BBB.css',
        }),
      ],
      [
        'https://example.vercel.app/assets/lazy-CCC.js',
        createMockResponse(`console.log('lazy chunk');`, {
          contentType: 'application/javascript',
          url: 'https://example.vercel.app/assets/lazy-CCC.js',
        }),
      ],
      [
        'https://example.vercel.app/assets/feature-DDD.js',
        createMockResponse(`console.log('feature chunk');`, {
          contentType: 'application/javascript',
          url: 'https://example.vercel.app/assets/feature-DDD.js',
        }),
      ],
      [
        'https://example.vercel.app/fonts/SourceHanSansTC-Regular.woff2',
        createMockResponse(Buffer.from('font-bytes'), {
          contentType: 'font/woff2',
          url: 'https://example.vercel.app/fonts/SourceHanSansTC-Regular.woff2',
        }),
      ],
      [
        'https://example.vercel.app/favicon.svg',
        createMockResponse('<svg></svg>', {
          contentType: 'image/svg+xml',
          url: 'https://example.vercel.app/favicon.svg',
        }),
      ],
      [
        'https://example.vercel.app/icons/app.svg',
        createMockResponse('<svg></svg>', {
          contentType: 'image/svg+xml',
          url: 'https://example.vercel.app/icons/app.svg',
        }),
      ],
      [
        'https://example.vercel.app/images/hero.png',
        createMockResponse(Buffer.from([137, 80, 78, 71]), {
          contentType: 'image/png',
          url: 'https://example.vercel.app/images/hero.png',
        }),
      ],
    ])

    const fetchImpl = async (url) => {
      const response = responses.get(String(url))
      if (!response) {
        return createMockResponse('not found', {
          contentType: 'text/plain',
          status: 404,
          url: String(url),
        })
      }
      return response
    }

    const result = await buildVercelMirror({
      prodUrl: 'https://example.vercel.app/',
      outputDir: tempDir,
      fetchImpl,
    })

    expect(result.indexInfo).toMatchObject({
      mainAsset: '/assets/index-AAA.js',
      cssAsset: '/assets/index-BBB.css',
    })

    await expect(readFile(path.join(tempDir, 'index.html'), 'utf8')).resolves.toContain(
      '/assets/index-AAA.js'
    )
    await expect(readFile(path.join(tempDir, 'assets', 'index-AAA.js'), 'utf8')).resolves.toContain(
      'featureLoader'
    )
    await expect(readFile(path.join(tempDir, 'assets', 'lazy-CCC.js'), 'utf8')).resolves.toContain(
      'lazy chunk'
    )
    await expect(
      readFile(path.join(tempDir, 'assets', 'feature-DDD.js'), 'utf8')
    ).resolves.toContain('feature chunk')
    await expect(
      readFile(path.join(tempDir, 'fonts', 'SourceHanSansTC-Regular.woff2'))
    ).resolves.toHaveLength(10)
    await expect(readFile(path.join(tempDir, 'favicon.svg'), 'utf8')).resolves.toContain('<svg>')
    await expect(readFile(path.join(tempDir, 'icons', 'app.svg'), 'utf8')).resolves.toContain(
      '<svg>'
    )
    await expect(readFile(path.join(tempDir, 'images', 'hero.png'))).resolves.toHaveLength(4)
    await expect(
      readFile(path.join(tempDir, 'portfolio-report', 'progress.json'), 'utf8')
    ).rejects.toThrow()
    expect(result.files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining([
        'assets/feature-DDD.js',
        'assets/index-AAA.js',
        'assets/index-BBB.css',
        'assets/lazy-CCC.js',
        'favicon.svg',
        'fonts/SourceHanSansTC-Regular.woff2',
        'icons/app.svg',
        'images/hero.png',
        'index.html',
      ])
    )
  })
})
