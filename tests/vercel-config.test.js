import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('vercel.json', () => {
  it('applies baseline security headers to every route', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))
    const globalHeaders = vercelConfig.headers.find((entry) => entry.source === '/(.*)')

    expect(globalHeaders).toBeTruthy()
    expect(globalHeaders.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'Content-Security-Policy',
          value: expect.stringContaining("default-src 'self'"),
        }),
        expect.objectContaining({ key: 'X-Frame-Options', value: 'DENY' }),
        expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
        expect.objectContaining({
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        }),
        expect.objectContaining({
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        }),
      ])
    )
  })

  it('contains the weekday target-price cron entry', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/api/cron/collect-target-prices',
          schedule: '30 9 * * 1-5',
        }),
      ])
    )
  })

  it('contains the valuation cron entry at 22:00 UTC for 06:00 Asia/Taipei', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/api/cron/compute-valuations',
          schedule: '0 22 * * *',
        }),
      ])
    )
  })

  it('pins target-price cron maxDuration to 60 seconds', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.functions['api/cron/collect-target-prices.js']).toEqual({
      maxDuration: 60,
    })
  })

  it('pins valuation cron maxDuration to 300 seconds', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.functions['api/cron/compute-valuations.js']).toEqual({
      maxDuration: 300,
    })
  })

  it('points ignoreCommand at the wrapper script', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.ignoreCommand).toBe('bash scripts/vercel-ignore.sh')
  })

  it('allows only the known outbound domains in connect-src', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))
    const globalHeaders = vercelConfig.headers.find((entry) => entry.source === '/(.*)')
    const cspHeader = globalHeaders.headers.find((entry) => entry.key === 'Content-Security-Policy')

    expect(cspHeader.value).toContain('https://*.vercel-storage.com')
    expect(cspHeader.value).toContain('https://api.finmindtrade.com')
    expect(cspHeader.value).toContain('https://newsapi.org')
    expect(cspHeader.value).toContain('https://35.236.155.62.sslip.io')
  })
})
