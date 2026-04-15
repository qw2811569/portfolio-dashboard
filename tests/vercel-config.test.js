import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('vercel.json', () => {
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

  it('pins target-price cron maxDuration to 60 seconds', () => {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'))

    expect(vercelConfig.functions['api/cron/collect-target-prices.js']).toEqual({
      maxDuration: 60,
    })
  })
})
