import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const systemdDir = path.join(repoRoot, 'deploy/systemd')
const vercelConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'))

const cronScheduleToOnCalendar = {
  '0 22 * * *': '*-*-* 22:00:00',
  '0 8 * * 1-5': 'Mon..Fri *-*-* 08:00:00',
  '30 9 * * 1-5': 'Mon..Fri *-*-* 09:30:00',
  '0 10 * * 1-5': 'Mon..Fri *-*-* 10:00:00',
}

function parseSystemdUnit(source) {
  const parsed = {}
  let currentSection = null
  let currentKey = null

  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return

    const sectionMatch = trimmed.match(/^\[([A-Za-z][A-Za-z0-9]*)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      parsed[currentSection] ||= {}
      currentKey = null
      return
    }

    expect(currentSection, `line ${index + 1} must be inside a section`).toBeTruthy()

    if (/^\s/.test(line)) {
      expect(
        source.split(/\r?\n/)[index - 1]?.trim().endsWith('\\'),
        `line ${index + 1} continuations must follow a trailing backslash`
      ).toBe(true)
      expect(currentKey, `line ${index + 1} continuations must follow a key`).toBeTruthy()
      parsed[currentSection][currentKey] =
        `${parsed[currentSection][currentKey].replace(/\\$/, '').trim()} ${trimmed}`
      return
    }

    expect(trimmed, `line ${index + 1} must be key=value`).toMatch(/^[A-Za-z][A-Za-z0-9]*=/)
    const [key, ...valueParts] = trimmed.split('=')
    parsed[currentSection][key] = valueParts.join('=')
    currentKey = key
  })

  return parsed
}

describe('cron systemd units', () => {
  const crons = vercelConfig.crons || []

  it('keeps the Round 46 cron manifest in vercel.json', () => {
    expect(crons.map(({ path, schedule }) => ({ path, schedule }))).toEqual([
      { path: '/api/cron/compute-valuations', schedule: '0 22 * * *' },
      { path: '/api/cron/collect-daily-events', schedule: '0 8 * * 1-5' },
      { path: '/api/cron/collect-target-prices', schedule: '30 9 * * 1-5' },
      { path: '/api/cron/collect-news', schedule: '0 10 * * 1-5' },
    ])
  })

  it('defines one service and timer per Vercel cron', () => {
    for (const cron of crons) {
      const cronName = cron.path.replace('/api/cron/', '')
      const servicePath = path.join(systemdDir, `jcv-${cronName}.service`)
      const timerPath = path.join(systemdDir, `jcv-${cronName}.timer`)

      expect(fs.existsSync(servicePath), `${servicePath} exists`).toBe(true)
      expect(fs.existsSync(timerPath), `${timerPath} exists`).toBe(true)
    }
  })

  it('has valid service/timer sections and key=value syntax', () => {
    for (const cron of crons) {
      const cronName = cron.path.replace('/api/cron/', '')
      const service = parseSystemdUnit(
        fs.readFileSync(path.join(systemdDir, `jcv-${cronName}.service`), 'utf8')
      )
      const timer = parseSystemdUnit(
        fs.readFileSync(path.join(systemdDir, `jcv-${cronName}.timer`), 'utf8')
      )

      expect(Object.keys(service)).toEqual(['Unit', 'Service'])
      expect(Object.keys(timer)).toEqual(['Unit', 'Timer', 'Install'])
      expect(service.Unit.Description).toBe(`JCV cron · ${cronName}`)
      expect(service.Service.Type).toBe('oneshot')
      expect(service.Service.User).toBe('chenkuichen')
      expect(service.Service.WorkingDirectory).toBe('/home/chenkuichen/app/portfolio-dashboard')
      expect(service.Service.EnvironmentFile).toBe(
        '/home/chenkuichen/app/portfolio-dashboard/.env.local'
      )
      expect(service.Service.ExecStart).toContain(`http://127.0.0.1:3000${cron.path}`)
      expect(timer.Timer.Unit).toBe(`jcv-${cronName}.service`)
      expect(timer.Timer.Persistent).toBe('true')
      expect(timer.Install.WantedBy).toBe('timers.target')
    }
  })

  it('translates Vercel cron schedules to systemd OnCalendar', () => {
    for (const cron of crons) {
      const cronName = cron.path.replace('/api/cron/', '')
      const timer = parseSystemdUnit(
        fs.readFileSync(path.join(systemdDir, `jcv-${cronName}.timer`), 'utf8')
      )

      expect(timer.Timer.OnCalendar).toBe(cronScheduleToOnCalendar[cron.schedule])
    }
  })
})
