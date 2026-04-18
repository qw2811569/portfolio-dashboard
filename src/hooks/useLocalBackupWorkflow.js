import { useCallback, useRef } from 'react'
import { z } from 'zod'
import {
  ACTIVE_PORTFOLIO_KEY,
  CURRENT_SCHEMA_VERSION,
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_ALIAS_TO_SUFFIX,
  PORTFOLIOS_KEY,
  PORTFOLIO_VIEW_MODE,
  SCHEMA_VERSION_KEY,
  STATUS_MESSAGE_TIMEOUT_MS,
  VIEW_MODE_KEY,
} from '../constants.js'
import { APP_DIALOG_MESSAGES, APP_ERROR_MESSAGES, APP_TOAST_MESSAGES } from '../lib/appMessages.js'
import { normalizeHoldings } from '../lib/holdings.js'
import {
  buildPortfoliosFromStorage,
  collectPortfolioBackupStorage,
  downloadJson,
  ensurePortfolioRegistry,
  loadPortfolioSnapshot,
  normalizeImportedStorageKey,
  normalizeBackupStorage,
  readSyncAt,
  save,
  pfKey,
} from '../lib/portfolioUtils.js'

const MAX_BACKUP_IMPORT_BYTES = 2 * 1024 * 1024

const JsonValueSchema = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
)

const BackupStorageSchema = z.record(z.string(), JsonValueSchema)

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function extractRawBackupStorage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (payload.storage && typeof payload.storage === 'object' && !Array.isArray(payload.storage)) {
    return payload.storage
  }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

function validateBackupImportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(APP_ERROR_MESSAGES.backupUnrecognizedData)
  }

  const appName = String(payload.app || '').trim()
  if (appName && appName !== 'portfolio-dashboard') {
    throw new Error(APP_ERROR_MESSAGES.backupUnsupportedApp(appName))
  }

  if (payload.version != null && Number(payload.version) !== 1) {
    throw new Error(APP_ERROR_MESSAGES.backupUnsupportedVersion(payload.version))
  }

  const rawStorage = extractRawBackupStorage(payload)
  const parsedStorage = BackupStorageSchema.safeParse(rawStorage)
  if (!parsedStorage.success) {
    throw new Error(APP_ERROR_MESSAGES.backupInvalidShape)
  }

  const unsafeKeys = Object.keys(parsedStorage.data).filter(
    (key) => !normalizeImportedStorageKey(key)
  )
  if (unsafeKeys.length > 0) {
    throw new Error(APP_ERROR_MESSAGES.backupUnsafeKeys(unsafeKeys))
  }

  const schemaVersion = Number(parsedStorage.data[SCHEMA_VERSION_KEY])
  if (!Number.isFinite(schemaVersion)) {
    throw new Error(APP_ERROR_MESSAGES.backupSchemaMissing)
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(APP_ERROR_MESSAGES.backupSchemaTooNew(schemaVersion))
  }

  const normalizedStorage = normalizeBackupStorage({ storage: parsedStorage.data })
  if (!normalizedStorage || Object.keys(normalizedStorage).length === 0) {
    throw new Error(APP_ERROR_MESSAGES.backupUnrecognizedData)
  }

  return {
    normalizedStorage,
    schemaVersion,
    rawKeyCount: Object.keys(parsedStorage.data).length,
  }
}

export function useLocalBackupWorkflow({
  portfolios = [],
  activePortfolioId = OWNER_PORTFOLIO_ID,
  viewMode = PORTFOLIO_VIEW_MODE,
  marketQuotes = null,
  requestConfirmation = async () => true,
  applyPortfolioSnapshot = () => {},
  portfolioTransitionRef = {
    current: { isHydrating: false, fromPid: activePortfolioId, toPid: activePortfolioId },
  },
  cloudSyncStateRef = { current: { enabled: false, syncedAt: 0 } },
  setPortfolios = () => {},
  setActivePortfolioId = () => {},
  setViewMode = () => {},
  setCloudSync = () => {},
  flashSaved = () => {},
  liveSnapshot = {},
}) {
  const backupFileInputRef = useRef(null)

  const exportLocalBackup = useCallback(() => {
    try {
      const storage = collectPortfolioBackupStorage()
      storage[PORTFOLIOS_KEY] = portfolios
      storage[ACTIVE_PORTFOLIO_KEY] = activePortfolioId
      storage[VIEW_MODE_KEY] = viewMode
      storage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION

      for (const [alias, value] of Object.entries(liveSnapshot || {})) {
        const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias]
        if (!suffix || value === undefined) continue
        storage[pfKey(activePortfolioId, suffix)] = value
      }

      if (Object.keys(storage).length === 0) {
        flashSaved(APP_TOAST_MESSAGES.backupNoExportableData)
        return
      }

      downloadJson(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1,
        app: 'portfolio-dashboard',
        exportedAt: new Date().toISOString(),
        origin: window.location.origin,
        storage,
      })
      flashSaved(APP_TOAST_MESSAGES.backupExported)
    } catch (error) {
      console.error('匯出備份失敗:', error)
      flashSaved(APP_TOAST_MESSAGES.backupExportFailed)
    }
  }, [activePortfolioId, flashSaved, liveSnapshot, portfolios, viewMode])

  const importLocalBackup = useCallback(
    async (event) => {
      const file = event?.target?.files?.[0]
      if (event?.target) {
        event.target.value = ''
      }
      if (!file) return

      if (Number(file.size) > MAX_BACKUP_IMPORT_BYTES) {
        flashSaved(
          APP_TOAST_MESSAGES.backupImportFailed(
            APP_ERROR_MESSAGES.backupTooLarge(formatBytes(MAX_BACKUP_IMPORT_BYTES))
          ),
          STATUS_MESSAGE_TIMEOUT_MS.LONG
        )
        return
      }

      const confirmed = await requestConfirmation(
        APP_DIALOG_MESSAGES.importBackup(file.name || '', formatBytes(file.size))
      )
      if (!confirmed) return

      let nextPid = activePortfolioId
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const validated = validateBackupImportPayload(parsed)
        const normalizedStorage = { ...validated.normalizedStorage }
        const importedPortfolios = buildPortfoliosFromStorage(normalizedStorage)
        const finalConfirmed = await requestConfirmation(
          APP_DIALOG_MESSAGES.importBackupReview({
            fileName: file.name || '',
            sizeLabel: formatBytes(file.size),
            schemaVersion: validated.schemaVersion,
            keyCount: validated.rawKeyCount,
            portfolioCount: importedPortfolios.length,
          })
        )
        if (!finalConfirmed) return

        for (const key of Object.keys(normalizedStorage)) {
          if (!key.endsWith(`-${PORTFOLIO_ALIAS_TO_SUFFIX.holdings}`)) continue
          normalizedStorage[key] = normalizeHoldings(normalizedStorage[key], marketQuotes)
        }
        normalizedStorage[PORTFOLIOS_KEY] = importedPortfolios
        normalizedStorage[ACTIVE_PORTFOLIO_KEY] =
          typeof normalizedStorage[ACTIVE_PORTFOLIO_KEY] === 'string' &&
          importedPortfolios.some((item) => item.id === normalizedStorage[ACTIVE_PORTFOLIO_KEY])
            ? normalizedStorage[ACTIVE_PORTFOLIO_KEY]
            : OWNER_PORTFOLIO_ID
        normalizedStorage[VIEW_MODE_KEY] = PORTFOLIO_VIEW_MODE
        normalizedStorage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION

        portfolioTransitionRef.current = {
          isHydrating: true,
          fromPid: activePortfolioId,
          toPid: normalizedStorage[ACTIVE_PORTFOLIO_KEY],
        }

        for (const [key, value] of Object.entries(normalizedStorage)) {
          await save(key, value)
        }

        const registry = await ensurePortfolioRegistry()
        nextPid = registry.activePortfolioId
        const snapshot = await loadPortfolioSnapshot(nextPid)

        setPortfolios(registry.portfolios)
        setActivePortfolioId(nextPid)
        setViewMode(registry.viewMode)
        applyPortfolioSnapshot(snapshot)

        const cloudEnabled =
          registry.viewMode === PORTFOLIO_VIEW_MODE && nextPid === OWNER_PORTFOLIO_ID
        cloudSyncStateRef.current = {
          enabled: cloudEnabled,
          syncedAt: cloudEnabled ? readSyncAt('pf-cloud-sync-at') : 0,
        }
        setCloudSync(cloudEnabled)

        flashSaved(
          APP_TOAST_MESSAGES.backupImported(Object.keys(normalizedStorage).length),
          STATUS_MESSAGE_TIMEOUT_MS.LONG
        )
      } catch (error) {
        console.error('匯入備份失敗:', error)
        const detail =
          error instanceof SyntaxError
            ? APP_ERROR_MESSAGES.backupInvalidJson
            : error?.message || APP_ERROR_MESSAGES.backupInvalidJson
        flashSaved(APP_TOAST_MESSAGES.backupImportFailed(detail), STATUS_MESSAGE_TIMEOUT_MS.LONG)
      } finally {
        portfolioTransitionRef.current = {
          isHydrating: false,
          fromPid: nextPid,
          toPid: nextPid,
        }
      }
    },
    [
      activePortfolioId,
      applyPortfolioSnapshot,
      cloudSyncStateRef,
      flashSaved,
      marketQuotes,
      portfolioTransitionRef,
      requestConfirmation,
      setActivePortfolioId,
      setCloudSync,
      setPortfolios,
      setViewMode,
    ]
  )

  return {
    backupFileInputRef,
    exportLocalBackup,
    importLocalBackup,
  }
}
