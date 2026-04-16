import { randomUUID } from 'node:crypto'
import {
  resolveStockInput,
  runAnalystReportsPipeline,
  writeAnalystReportsSnapshot,
} from '../../api/analyst-reports.js'

function serializeJob(job) {
  if (!job) return null
  return {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    code: job.code,
    name: job.name,
    error: job.error,
    result: job.result,
  }
}

export function createAnalystReportsWorker({ logger = console } = {}) {
  const jobs = new Map()

  async function runJob(job) {
    job.status = 'running'
    job.startedAt = new Date().toISOString()

    try {
      const result = await runAnalystReportsPipeline(job.input)
      await writeAnalystReportsSnapshot(job.code, result)
      job.status = 'completed'
      job.completedAt = new Date().toISOString()
      job.result = result
      logger.info?.(
        `[analyst-reports-worker] completed ${job.code} (${result?.targetPriceCount || 0} targets)`
      )
    } catch (error) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.error = error?.message || 'analyst-reports job failed'
      logger.error?.(`[analyst-reports-worker] failed ${job.code}:`, error)
    }
  }

  async function submit(input = {}, { wait = false } = {}) {
    const { code, name } = resolveStockInput(input)
    if (!code || !name) {
      throw new Error('缺少 code 或 name')
    }

    const jobId = `analyst_${code}_${randomUUID().slice(0, 8)}`
    const job = {
      jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      code,
      name,
      input: { ...input, code, name },
      error: null,
      result: null,
    }
    jobs.set(jobId, job)

    const promise = runJob(job)
    if (wait) {
      await promise
    } else {
      promise.catch(() => {})
    }

    return serializeJob(job)
  }

  function get(jobId) {
    return serializeJob(jobs.get(String(jobId || '').trim()))
  }

  return {
    submit,
    get,
  }
}
