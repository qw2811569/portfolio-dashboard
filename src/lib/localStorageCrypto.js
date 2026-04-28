const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()
const DEFAULT_VERSION = 1
const ENCRYPTED_KEY_SUFFIX = '.encrypted'

function bytesToBase64(bytes) {
  if (typeof btoa !== 'function' && typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value = '') {
  if (typeof atob !== 'function' && typeof globalThis.Buffer !== 'undefined') {
    return Uint8Array.from(globalThis.Buffer.from(String(value || ''), 'base64'))
  }
  const binary = atob(String(value || ''))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function resolveCrypto() {
  return globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues ? globalThis.crypto : null
}

export async function deriveLocalStorageCryptoKey(
  userIdentity,
  { salt = 'portfolio-dashboard' } = {}
) {
  const cryptoImpl = resolveCrypto()
  const identity = String(userIdentity || '').trim()
  if (!cryptoImpl || !identity) return null

  const keyMaterial = await cryptoImpl.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(identity),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return cryptoImpl.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: TEXT_ENCODER.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptLocalStorageValue(value, { userIdentity, aad = '' } = {}) {
  const cryptoImpl = resolveCrypto()
  const key = await deriveLocalStorageCryptoKey(userIdentity)
  if (!cryptoImpl || !key) return null

  const iv = cryptoImpl.getRandomValues(new Uint8Array(12))
  const encoded = TEXT_ENCODER.encode(JSON.stringify(value))
  const ciphertext = await cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad ? TEXT_ENCODER.encode(aad) : undefined,
    },
    key,
    encoded
  )

  return {
    v: DEFAULT_VERSION,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptLocalStorageValue(envelope, { userIdentity, aad = '' } = {}) {
  const cryptoImpl = resolveCrypto()
  const key = await deriveLocalStorageCryptoKey(userIdentity)
  if (!cryptoImpl || !key || !envelope?.iv || !envelope?.data) return null

  const plaintext = await cryptoImpl.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.iv),
      additionalData: aad ? TEXT_ENCODER.encode(aad) : undefined,
    },
    key,
    base64ToBytes(envelope.data)
  )

  return JSON.parse(TEXT_DECODER.decode(plaintext))
}

export async function migratePlainLocalStorageFieldToEncryptedSentinel({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  plainKey,
  encryptedKey = `${plainKey}.encrypted-poc`,
  userIdentity,
} = {}) {
  if (!storage || !plainKey || !userIdentity) return { status: 'skipped' }
  if (storage.getItem(encryptedKey)) return { status: 'exists', encryptedKey }

  const raw = storage.getItem(plainKey)
  if (raw == null) return { status: 'missing' }

  let value
  try {
    value = JSON.parse(raw)
  } catch {
    value = raw
  }

  const envelope = await encryptLocalStorageValue(value, { userIdentity, aad: plainKey })
  if (!envelope) return { status: 'unsupported' }

  storage.setItem(encryptedKey, JSON.stringify(envelope))
  return { status: 'migrated', encryptedKey }
}

export function getEncryptedPortfolioFieldKey(plainKey) {
  return plainKey ? `${plainKey}${ENCRYPTED_KEY_SUFFIX}` : ''
}

function parseStoredValue(raw) {
  if (raw == null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function readEncryptedPortfolioField({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  plainKey,
  encryptedKey = getEncryptedPortfolioFieldKey(plainKey),
  userIdentity,
} = {}) {
  if (!storage || !plainKey || !userIdentity) return { status: 'unsupported', value: undefined }

  const encryptedRaw = storage.getItem(encryptedKey)
  if (!encryptedRaw) return { status: 'missing', value: undefined }

  try {
    const value = await decryptLocalStorageValue(JSON.parse(encryptedRaw), {
      userIdentity,
      aad: plainKey,
    })
    return { status: 'decrypted', value }
  } catch {
    return { status: 'decrypt-failed', value: undefined }
  }
}

export async function writeEncryptedPortfolioField({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  plainKey,
  encryptedKey = getEncryptedPortfolioFieldKey(plainKey),
  userIdentity,
  value,
  removePlaintext = true,
} = {}) {
  if (!storage || !plainKey || !userIdentity) return { status: 'skipped' }

  const envelope = await encryptLocalStorageValue(value, { userIdentity, aad: plainKey })
  if (!envelope) return { status: 'unsupported' }

  storage.setItem(encryptedKey, JSON.stringify(envelope))
  if (removePlaintext) storage.removeItem(plainKey)
  return { status: 'encrypted', encryptedKey }
}

export async function migratePortfolioField({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  plainKey,
  encryptedKey = getEncryptedPortfolioFieldKey(plainKey),
  userIdentity,
} = {}) {
  if (!storage || !plainKey || !userIdentity) return { status: 'skipped' }

  const raw = storage.getItem(plainKey)
  if (raw == null) return { status: storage.getItem(encryptedKey) ? 'encrypted-only' : 'missing' }

  if (storage.getItem(encryptedKey)) {
    storage.removeItem(plainKey)
    return { status: 'removed-stale-plaintext', encryptedKey }
  }

  const value = parseStoredValue(raw)
  return writeEncryptedPortfolioField({
    storage,
    plainKey,
    encryptedKey,
    userIdentity,
    value,
    removePlaintext: true,
  }).then((result) =>
    result.status === 'encrypted' ? { status: 'migrated', encryptedKey } : result
  )
}

export async function readPortfolioFieldWithMigration({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  plainKey,
  encryptedKey = getEncryptedPortfolioFieldKey(plainKey),
  userIdentity,
  migratePlaintext = false,
} = {}) {
  const encrypted = await readEncryptedPortfolioField({
    storage,
    plainKey,
    encryptedKey,
    userIdentity,
  })
  if (encrypted.status === 'decrypted') return encrypted

  if (!storage || !plainKey) return encrypted
  const raw = storage.getItem(plainKey)
  if (raw == null) return encrypted

  const value = parseStoredValue(raw)
  const migration = migratePlaintext
    ? await migratePortfolioField({ storage, plainKey, encryptedKey, userIdentity })
    : { status: 'not-migrated' }
  return { status: 'plaintext', value, migrationStatus: migration.status }
}
