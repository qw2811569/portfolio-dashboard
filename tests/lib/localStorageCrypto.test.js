import { beforeEach, describe, expect, it } from 'vitest'
import {
  getEncryptedPortfolioFieldKey,
  migratePortfolioField,
  readPortfolioFieldWithMigration,
  writeEncryptedPortfolioField,
} from '../../src/lib/localStorageCrypto.js'

class MemoryStorage {
  constructor() {
    this.rows = new Map()
  }

  getItem(key) {
    return this.rows.has(key) ? this.rows.get(key) : null
  }

  setItem(key, value) {
    this.rows.set(key, String(value))
  }

  removeItem(key) {
    this.rows.delete(key)
  }
}

describe('lib/localStorageCrypto.js', () => {
  let storage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('migrates plaintext to encrypted storage and decrypts it back', async () => {
    const plainKey = 'pf-me-notes-v1'
    storage.setItem(plainKey, JSON.stringify({ riskProfile: 'balanced', customNotes: 'hedge' }))

    const migration = await migratePortfolioField({
      storage,
      plainKey,
      userIdentity: 'me',
    })

    expect(migration.status).toBe('migrated')
    expect(storage.getItem(plainKey)).toBeNull()
    expect(storage.getItem(getEncryptedPortfolioFieldKey(plainKey))).toContain('"AES-GCM"')

    const loaded = await readPortfolioFieldWithMigration({
      storage,
      plainKey,
      userIdentity: 'me',
      migratePlaintext: true,
    })

    expect(loaded.status).toBe('decrypted')
    expect(loaded.value).toEqual({ riskProfile: 'balanced', customNotes: 'hedge' })
  })

  it('removes stale plaintext when an encrypted value already exists', async () => {
    const plainKey = 'pf-me-holdings-v2'

    await writeEncryptedPortfolioField({
      storage,
      plainKey,
      userIdentity: 'me',
      value: [{ code: '2330', qty: 1 }],
    })
    storage.setItem(plainKey, JSON.stringify([{ code: '9999', qty: 99 }]))

    const migration = await migratePortfolioField({
      storage,
      plainKey,
      userIdentity: 'me',
    })
    const loaded = await readPortfolioFieldWithMigration({
      storage,
      plainKey,
      userIdentity: 'me',
    })

    expect(migration.status).toBe('removed-stale-plaintext')
    expect(storage.getItem(plainKey)).toBeNull()
    expect(loaded.value).toEqual([{ code: '2330', qty: 1 }])
  })

  it('round-trips an intentionally empty array without treating it as missing', async () => {
    const plainKey = 'pf-me-analysis-history-v1'

    await writeEncryptedPortfolioField({
      storage,
      plainKey,
      userIdentity: 'me',
      value: [],
    })

    const loaded = await readPortfolioFieldWithMigration({
      storage,
      plainKey,
      userIdentity: 'me',
    })

    expect(loaded.status).toBe('decrypted')
    expect(loaded.value).toEqual([])
  })
})
