import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildThemeArtifactsFromCss,
  syncThemeArtifacts,
} from '../../scripts/sync-theme-from-canonical.mjs'

describe('sync-theme-from-canonical', () => {
  it('builds generated output from a canonical fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/theme-fixture.css')
    const cssText = await readFile(fixturePath, 'utf8')
    const { tokens, moduleSource } = buildThemeArtifactsFromCss(cssText)

    expect(tokens.ink).toBe('#111111')
    expect(tokens.fontBody).toBe('"Demo Sans", sans-serif')
    expect(moduleSource).toContain("ink: '#111111'")
    expect(moduleSource).toContain("radius: '24px'")
  })

  it('detects drift and rewrites generated artifacts when canonical changes', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'theme-sync-'))
    const canonicalPath = path.join(tempDir, 'tokens.css')
    const generatedPath = path.join(tempDir, 'theme.generated.js')
    const checksumPath = path.join(tempDir, 'theme.generated.checksum')

    await writeFile(canonicalPath, ':root { --ink: #111111; --positive: #ef7d2f; }\n', 'utf8')
    await syncThemeArtifacts({ canonicalPath, generatedPath, checksumPath })

    const firstGenerated = await readFile(generatedPath, 'utf8')
    expect(firstGenerated).toContain("ink: '#111111'")

    await writeFile(canonicalPath, ':root { --ink: #222222; --positive: #ef7d2f; }\n', 'utf8')

    const driftResult = await syncThemeArtifacts({
      canonicalPath,
      generatedPath,
      checksumPath,
      check: true,
    })
    expect(driftResult.drift).toHaveLength(2)

    await syncThemeArtifacts({ canonicalPath, generatedPath, checksumPath })
    const secondGenerated = await readFile(generatedPath, 'utf8')

    expect(secondGenerated).toContain("ink: '#222222'")
    expect(secondGenerated).not.toBe(firstGenerated)
  })
})
