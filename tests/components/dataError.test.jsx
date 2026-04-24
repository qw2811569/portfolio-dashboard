// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataError } from '../../src/components/common/DataError.jsx'

describe('components/DataError', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders soft copy for auth failures with login guidance', () => {
    render(<DataError status={401} resource="analyst-reports" onRetry={vi.fn()} />)

    expect(screen.getByText('需要重新登入 · 前往登入')).toBeInTheDocument()
    expect(screen.getByText('重新登入')).toBeInTheDocument()
    expect(screen.getByText('重新整理')).toBeInTheDocument()
  })

  it('auto-retries retryable server errors with exponential backoff', async () => {
    vi.useFakeTimers()
    const onRetry = vi.fn()

    render(<DataError status="5xx" resource="news" onRetry={onRetry} maxAutoRetries={2} />)

    await vi.advanceTimersByTimeAsync(999)
    expect(onRetry).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onRetry).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1999)
    expect(onRetry).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })
})
