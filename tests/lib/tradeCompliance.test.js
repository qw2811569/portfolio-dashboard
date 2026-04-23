import { describe, expect, it, vi } from 'vitest'
import {
  TRADE_DISCLAIMER_STORAGE_KEY,
  readTradeDisclaimerAckAt,
  shouldPromptTradeDisclaimer,
  writeTradeDisclaimerAckAt,
} from '../../src/lib/tradeCompliance.js'

function createStorageMock() {
  const store = new Map()
  return {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value))
    }),
  }
}

describe('tradeCompliance', () => {
  it('prompts when disclaimer ack is missing, invalid, or older than 90 days', () => {
    expect(shouldPromptTradeDisclaimer('', { now: '2026-04-24T00:00:00.000Z' })).toBe(true)
    expect(shouldPromptTradeDisclaimer('not-a-date', { now: '2026-04-24T00:00:00.000Z' })).toBe(
      true
    )
    expect(
      shouldPromptTradeDisclaimer('2026-01-01T00:00:00.000Z', {
        now: '2026-04-24T00:00:00.000Z',
      })
    ).toBe(true)
  })

  it('skips the modal when the last ack is still fresh', () => {
    expect(
      shouldPromptTradeDisclaimer('2026-03-15T00:00:00.000Z', {
        now: '2026-04-24T00:00:00.000Z',
      })
    ).toBe(false)
  })

  it('reads and writes the canonical disclaimer localStorage key', () => {
    const storage = createStorageMock()
    const writtenAt = writeTradeDisclaimerAckAt(storage, '2026-04-24T08:30:00.000Z')

    expect(writtenAt).toBe('2026-04-24T08:30:00.000Z')
    expect(storage.setItem).toHaveBeenCalledWith(
      TRADE_DISCLAIMER_STORAGE_KEY,
      '2026-04-24T08:30:00.000Z'
    )
    expect(readTradeDisclaimerAckAt(storage)).toBe('2026-04-24T08:30:00.000Z')
  })
})
