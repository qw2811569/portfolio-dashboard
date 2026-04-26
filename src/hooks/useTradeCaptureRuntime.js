import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MEMO_Q, PARSE_PROMPT } from '../constants.js'
import {
  applyParsedTradesToHoldings,
  buildTradeLogEntries,
  getTradeBatchMode,
  normalizeTradeParseResult,
} from '../lib/tradeParseUtils.js'
import { buildTradeParseErrorMessage } from '../lib/tradeAiResponse.js'
import {
  readTradeDisclaimerAckAt,
  shouldPromptTradeDisclaimer,
  writeTradeDisclaimerAckAt,
} from '../lib/tradeCompliance.js'

function createEmptyTradeEditorState(createDefaultFundamentalDraft) {
  return {
    uploads: [],
    activeUploadId: null,
    tpCode: '',
    tpFirm: '',
    tpVal: '',
    fundamentalDraft: createDefaultFundamentalDraft(),
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`讀取檔案失敗：${file?.name || 'unknown'}`))
    reader.onload = (event) => resolve(String(event.target?.result || ''))
    reader.readAsDataURL(file)
  })
}

function revokeUploadPreview(upload) {
  if (upload?.img) {
    URL.revokeObjectURL(upload.img)
  }
}

export function useTradeCaptureRuntime({
  portfolioId = 'me',
  holdings = [],
  tradeLog = [],
  marketQuotes = null,
  setHoldings = () => {},
  setTradeLog = () => {},
  upsertTargetReport = () => false,
  updateTargetPrice = () => false,
  upsertFundamentalsEntry = () => false,
  applyTradeEntryToHoldings = (rows) => rows,
  createDefaultFundamentalDraft = () => ({}),
  toSlashDate = () => new Date().toLocaleDateString('zh-TW'),
  flashSaved = () => {},
  afterSubmit = () => {},
}) {
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [submittingTrade, setSubmittingTrade] = useState(false)
  const [tradeDisclaimer, setTradeDisclaimer] = useState(() => {
    const ackedAt = readTradeDisclaimerAckAt()
    return {
      ackedAt,
      checked: false,
      open: shouldPromptTradeDisclaimer(ackedAt),
      mode: 'entry',
    }
  })
  const [tradeEditorState, setTradeEditorState] = useState(() =>
    createEmptyTradeEditorState(createDefaultFundamentalDraft)
  )
  const uploadIdRef = useRef(0)
  const uploadsRef = useRef([])
  const submittingTradeRef = useRef(false)

  useEffect(() => {
    uploadsRef.current = tradeEditorState.uploads
  }, [tradeEditorState.uploads])

  useEffect(
    () => () => {
      uploadsRef.current.forEach(revokeUploadPreview)
    },
    []
  )

  const updateActiveUpload = useCallback((updater) => {
    setTradeEditorState((prev) => {
      const uploads = prev.uploads.map((upload) => {
        if (upload.id !== prev.activeUploadId) return upload
        return typeof updater === 'function' ? updater(upload) : { ...upload, ...updater }
      })
      return { ...prev, uploads }
    })
  }, [])

  const buildSyntheticUpload = useCallback(
    (parsed = null) => {
      uploadIdRef.current += 1
      return {
        id: `manual-upload-${Date.now()}-${uploadIdRef.current}`,
        name: '手動新增交易',
        img: null,
        b64: '',
        mediaType: '',
        parsed,
        parseErr: '',
        tradeDate: parsed?.tradeDate || toSlashDate(),
        memoStep: 0,
        memoAns: [],
        memoIn: '',
        isPreviewReady: false,
        previewGeneratedAt: '',
      }
    },
    [toSlashDate]
  )

  const enqueueFiles = useCallback(
    async (incomingFiles) => {
      const files = Array.from(incomingFiles || []).filter((file) =>
        file?.type?.startsWith('image/')
      )
      if (!files.length) return

      try {
        const nextUploads = await Promise.all(
          files.map(async (file) => {
            const dataUrl = await readFileAsDataUrl(file)
            const objectUrl = URL.createObjectURL(file)
            uploadIdRef.current += 1
            return {
              id: `upload-${Date.now()}-${uploadIdRef.current}`,
              name: file.name || `截圖-${uploadIdRef.current}`,
              img: objectUrl,
              b64: String(dataUrl.split(',')[1] || ''),
              mediaType: file.type || 'image/jpeg',
              parsed: null,
              parseErr: '',
              tradeDate: toSlashDate(),
              memoStep: 0,
              memoAns: [],
              memoIn: '',
              isPreviewReady: false,
              previewGeneratedAt: '',
            }
          })
        )

        setTradeEditorState((prev) => ({
          ...prev,
          uploads: [...prev.uploads, ...nextUploads],
          activeUploadId: prev.activeUploadId || nextUploads[0]?.id || null,
        }))
      } catch (error) {
        flashSaved(`❌ 讀取截圖失敗：${error.message || '請重新選擇圖片'}`, 4000)
      }
    },
    [flashSaved, toSlashDate]
  )

  const processFile = useCallback(
    (file) => {
      void enqueueFiles(file ? [file] : [])
    },
    [enqueueFiles]
  )

  const processFiles = useCallback(
    (files) => {
      void enqueueFiles(files)
    },
    [enqueueFiles]
  )

  const activeUpload = useMemo(
    () =>
      tradeEditorState.uploads.find((upload) => upload.id === tradeEditorState.activeUploadId) ||
      null,
    [tradeEditorState.activeUploadId, tradeEditorState.uploads]
  )

  const selectUpload = useCallback((uploadId) => {
    setTradeEditorState((prev) =>
      prev.uploads.some((upload) => upload.id === uploadId)
        ? { ...prev, activeUploadId: uploadId }
        : prev
    )
  }, [])

  const removeUpload = useCallback((uploadId) => {
    setTradeEditorState((prev) => {
      const upload = prev.uploads.find((item) => item.id === uploadId)
      if (upload) revokeUploadPreview(upload)

      const uploads = prev.uploads.filter((item) => item.id !== uploadId)
      const nextActive =
        prev.activeUploadId === uploadId ? uploads[0]?.id || null : prev.activeUploadId

      return {
        ...prev,
        uploads,
        activeUploadId: nextActive,
      }
    })
  }, [])

  const clearUploads = useCallback(() => {
    setTradeEditorState((prev) => {
      prev.uploads.forEach(revokeUploadPreview)
      return {
        ...prev,
        uploads: [],
        activeUploadId: null,
      }
    })
  }, [])

  const resetTradeCapture = useCallback(() => {
    setTradeEditorState((prev) => {
      prev.uploads.forEach(revokeUploadPreview)
      return createEmptyTradeEditorState(createDefaultFundamentalDraft)
    })
    setDragOver(false)
    setParsing(false)
    submittingTradeRef.current = false
  }, [createDefaultFundamentalDraft])

  const setParsed = useCallback(
    (valueOrUpdater) => {
      setTradeEditorState((prev) => {
        const activeUpload =
          prev.uploads.find((upload) => upload.id === prev.activeUploadId) || null
        const nextParsed =
          typeof valueOrUpdater === 'function'
            ? valueOrUpdater(activeUpload?.parsed || null)
            : valueOrUpdater

        if (!activeUpload) {
          const syntheticUpload = buildSyntheticUpload(nextParsed)
          return {
            ...prev,
            uploads: [...prev.uploads, syntheticUpload],
            activeUploadId: syntheticUpload.id,
          }
        }

        const uploads = prev.uploads.map((upload) =>
          upload.id === activeUpload.id
            ? {
                ...upload,
                parsed: nextParsed,
                tradeDate: nextParsed?.tradeDate || upload.tradeDate,
                isPreviewReady: false,
                previewGeneratedAt: '',
              }
            : upload
        )

        return { ...prev, uploads }
      })
    },
    [buildSyntheticUpload]
  )

  const setTradeDate = useCallback(
    (value) => {
      updateActiveUpload((upload) => ({ ...upload, tradeDate: value }))
    },
    [updateActiveUpload]
  )

  const setMemoIn = useCallback(
    (valueOrUpdater) => {
      updateActiveUpload((upload) => ({
        ...upload,
        memoIn:
          typeof valueOrUpdater === 'function' ? valueOrUpdater(upload.memoIn) : valueOrUpdater,
      }))
    },
    [updateActiveUpload]
  )

  const setMemoStep = useCallback(
    (valueOrUpdater) => {
      updateActiveUpload((upload) => ({
        ...upload,
        memoStep:
          typeof valueOrUpdater === 'function' ? valueOrUpdater(upload.memoStep) : valueOrUpdater,
      }))
    },
    [updateActiveUpload]
  )

  const setMemoAns = useCallback(
    (valueOrUpdater) => {
      updateActiveUpload((upload) => ({
        ...upload,
        memoAns:
          typeof valueOrUpdater === 'function' ? valueOrUpdater(upload.memoAns) : valueOrUpdater,
        isPreviewReady: false,
        previewGeneratedAt: '',
      }))
    },
    [updateActiveUpload]
  )

  const resetActiveUploadMemo = useCallback(() => {
    updateActiveUpload((upload) => ({
      ...upload,
      memoStep: 0,
      memoAns: [],
      memoIn: '',
      isPreviewReady: false,
      previewGeneratedAt: '',
    }))
  }, [updateActiveUpload])

  const parseShot = useCallback(async () => {
    if (!activeUpload?.b64) return
    setParsing(true)
    updateActiveUpload((upload) => ({ ...upload, parseErr: '' }))

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: PARSE_PROMPT,
          base64: activeUpload.b64,
          mediaType: activeUpload.mediaType,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || 'API 錯誤')

      const normalized = normalizeTradeParseResult(data, activeUpload.tradeDate || toSlashDate())
      if (!normalized.trades.length && !normalized.targetPriceUpdates.length) {
        throw new Error('沒有辨識到有效成交，請改用更清晰的截圖或手動修正')
      }

      const tradeCount = normalized.trades.length
      const targetCount = (normalized.targetPriceUpdates || []).length
      let successMsg = `✅ 成功辨識 ${tradeCount} 筆交易`
      if (targetCount > 0) successMsg += `、${targetCount} 筆目標價`
      flashSaved(successMsg, 3000)

      updateActiveUpload((upload) => ({
        ...upload,
        parsed: normalized,
        parseErr: '',
        tradeDate: normalized.tradeDate || upload.tradeDate || toSlashDate(),
        memoStep: 0,
        memoAns: [],
        memoIn: '',
        isPreviewReady: false,
        previewGeneratedAt: '',
      }))
    } catch (error) {
      console.error('parseShot error:', error)
      updateActiveUpload((upload) => ({
        ...upload,
        parseErr:
          buildTradeParseErrorMessage({
            error,
          }) || '解析失敗，請確認截圖清晰',
      }))
    } finally {
      setParsing(false)
    }
  }, [activeUpload, flashSaved, toSlashDate, updateActiveUpload])

  const parsed = activeUpload?.parsed || null
  const memoBatchMode = useMemo(() => getTradeBatchMode(parsed?.trades || []), [parsed])
  const memoQuestions = useMemo(() => MEMO_Q[memoBatchMode] || MEMO_Q['買進'], [memoBatchMode])

  const previewEntries = useMemo(() => {
    if (!activeUpload?.parsed?.trades?.length || !activeUpload?.isPreviewReady) return []

    return buildTradeLogEntries({
      parsed: activeUpload.parsed,
      tradeDate: String(activeUpload.tradeDate || '').trim() || toSlashDate(),
      memoQuestions,
      memoAnswers: activeUpload.memoAns || [],
      now: new Date(activeUpload.previewGeneratedAt || new Date().toISOString()),
    })
  }, [activeUpload, memoQuestions, toSlashDate])

  const setTradeDisclaimerChecked = useCallback((value) => {
    setTradeDisclaimer((prev) => ({ ...prev, checked: Boolean(value) }))
  }, [])

  const openTradeDisclaimer = useCallback((mode = 'entry') => {
    setTradeDisclaimer((prev) => ({
      ...prev,
      checked: false,
      open: true,
      mode,
    }))
  }, [])

  const acknowledgeTradeDisclaimer = useCallback(() => {
    const ackedAt = writeTradeDisclaimerAckAt()
    setTradeDisclaimer({
      ackedAt,
      checked: false,
      open: false,
      mode: 'entry',
    })
    return ackedAt
  }, [])

  const persistTradeAudit = useCallback(
    async ({ entries, nextHoldings, memoAnswers = [] }) => {
      const beforeHoldings = Array.isArray(holdings) ? holdings : []
      const beforeTradeLog = Array.isArray(tradeLog) ? tradeLog : []
      const disclaimerAckedAt = tradeDisclaimer.ackedAt || readTradeDisclaimerAckAt()

      const response = await fetch('/api/trade-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          action: 'trade.confirm',
          disclaimerAckedAt,
          before: {
            holdings: beforeHoldings,
            tradeLogCount: beforeTradeLog.length,
          },
          after: {
            holdings: nextHoldings,
            tradeLogCount: beforeTradeLog.length + entries.length,
            appendedTradeLogEntries: entries,
            targetPriceUpdates: activeUpload?.parsed?.targetPriceUpdates || [],
            memoAnswers,
          },
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || payload?.detail || 'trade audit append failed')
      }

      return {
        beforeHoldings,
        beforeTradeLog,
        disclaimerAckedAt,
      }
    },
    [activeUpload, holdings, portfolioId, tradeDisclaimer.ackedAt, tradeLog]
  )

  const finalizeTradeSubmit = useCallback(
    async (memoAnswers) => {
      if (!activeUpload?.parsed?.trades?.length || submittingTradeRef.current) return
      submittingTradeRef.current = true
      setSubmittingTrade(true)

      try {
        const selectedTradeDate = String(activeUpload.tradeDate || '').trim() || toSlashDate()
        const entries = buildTradeLogEntries({
          parsed: activeUpload.parsed,
          tradeDate: selectedTradeDate,
          memoQuestions,
          memoAnswers,
          now: new Date(activeUpload.previewGeneratedAt || new Date().toISOString()),
        })

        const nextHoldings = applyParsedTradesToHoldings({
          holdings: Array.isArray(holdings) ? holdings : [],
          parsed: activeUpload.parsed,
          applyTradeEntryToHoldings,
          marketQuotes,
        })

        await persistTradeAudit({ entries, nextHoldings, memoAnswers })
        setHoldings(nextHoldings)

        setTradeLog((prev) => [...entries, ...(Array.isArray(prev) ? prev : tradeLog)])
        ;(activeUpload.parsed.targetPriceUpdates || []).forEach((update) => {
          upsertTargetReport(update)
          const targetValue = Number(update?.targetPrice ?? update?.target)
          if (update?.code && Number.isFinite(targetValue) && targetValue > 0) {
            updateTargetPrice(update.code, targetValue)
          }
        })

        const remainingUploads = Math.max(tradeEditorState.uploads.length - 1, 0)
        flashSaved(
          remainingUploads > 0
            ? `✅ 已寫入 ${entries.length} 筆成交，還有 ${remainingUploads} 張待處理`
            : `✅ 已寫入 ${entries.length} 筆成交`,
          3000
        )

        const processedUploadId = activeUpload.id
        removeUpload(processedUploadId)
        afterSubmit({
          processedTrades: entries.length,
          remainingUploads,
          processedUploadId,
        })
      } catch (error) {
        console.error('trade audit append failed:', error)
        flashSaved(`❌ ${error?.message || '交易稽核寫入失敗，這筆交易尚未送出。'}`, 4200)
      } finally {
        submittingTradeRef.current = false
        setSubmittingTrade(false)
      }
    },
    [
      activeUpload,
      afterSubmit,
      applyTradeEntryToHoldings,
      flashSaved,
      holdings,
      marketQuotes,
      memoQuestions,
      persistTradeAudit,
      removeUpload,
      setHoldings,
      setTradeLog,
      toSlashDate,
      tradeEditorState.uploads.length,
      tradeLog,
      updateTargetPrice,
      upsertTargetReport,
    ]
  )

  const submitMemo = useCallback(() => {
    if (!activeUpload?.parsed?.trades?.length) return

    const nextAnswers = [...(activeUpload.memoAns || []), activeUpload.memoIn || '']
    if ((activeUpload.memoStep || 0) < memoQuestions.length - 1) {
      updateActiveUpload((upload) => ({
        ...upload,
        memoAns: nextAnswers,
        memoIn: '',
        memoStep: (upload.memoStep || 0) + 1,
        isPreviewReady: false,
      }))
      return
    }

    updateActiveUpload((upload) => ({
      ...upload,
      memoAns: nextAnswers,
      memoIn: '',
      isPreviewReady: true,
      previewGeneratedAt: new Date().toISOString(),
    }))
  }, [activeUpload, memoQuestions, updateActiveUpload])

  const skipMemo = useCallback(() => {
    if (!activeUpload?.parsed?.trades?.length) return
    const emptyAnswers = memoQuestions.map(() => '')
    updateActiveUpload((upload) => ({
      ...upload,
      memoAns: emptyAnswers,
      memoIn: '',
      isPreviewReady: true,
      previewGeneratedAt: new Date().toISOString(),
    }))
  }, [activeUpload, memoQuestions, updateActiveUpload])

  const confirmTradePreview = useCallback(async () => {
    if (
      !activeUpload?.parsed?.trades?.length ||
      !activeUpload?.isPreviewReady ||
      submittingTradeRef.current
    ) {
      return
    }

    const currentAckedAt = tradeDisclaimer.ackedAt || readTradeDisclaimerAckAt()
    if (shouldPromptTradeDisclaimer(currentAckedAt)) {
      openTradeDisclaimer('confirm')
      return
    }

    await finalizeTradeSubmit(activeUpload.memoAns || memoQuestions.map(() => ''))
  }, [
    activeUpload,
    finalizeTradeSubmit,
    memoQuestions,
    openTradeDisclaimer,
    tradeDisclaimer.ackedAt,
  ])

  return useMemo(
    () => ({
      img: activeUpload?.img || null,
      portfolioId,
      holdings,
      tradeLog,
      marketQuotes,
      setHoldings,
      setTradeLog,
      uploads: tradeEditorState.uploads,
      activeUploadId: tradeEditorState.activeUploadId,
      activeUploadIndex: tradeEditorState.uploads.findIndex(
        (upload) => upload.id === tradeEditorState.activeUploadId
      ),
      uploadCount: tradeEditorState.uploads.length,
      activeUploadName: activeUpload?.name || '',
      dragOver,
      setDragOver,
      processFile,
      processFiles,
      parseShot,
      parsing,
      parseErr: activeUpload?.parseErr || null,
      parsed,
      setParsed,
      tradeDate: activeUpload?.tradeDate || toSlashDate(),
      setTradeDate,
      qs: memoQuestions,
      memoBatchMode,
      memoAns: activeUpload?.memoAns || [],
      setMemoAns,
      memoIn: activeUpload?.memoIn || '',
      setMemoIn,
      memoStep: activeUpload?.memoStep || 0,
      setMemoStep,
      isPreviewReady: Boolean(activeUpload?.isPreviewReady),
      previewEntries,
      submittingTrade,
      submitMemo,
      skipMemo,
      confirmTradePreview,
      selectUpload,
      removeUpload,
      clearUploads,
      resetTradeCapture,
      tradeDisclaimer,
      setTradeDisclaimerChecked,
      acknowledgeTradeDisclaimer,
      openTradeDisclaimer,
      tpCode: tradeEditorState.tpCode,
      tpFirm: tradeEditorState.tpFirm,
      tpVal: tradeEditorState.tpVal,
      setTpCode: (value) => setTradeEditorState((prev) => ({ ...prev, tpCode: value })),
      setTpFirm: (value) => setTradeEditorState((prev) => ({ ...prev, tpFirm: value })),
      setTpVal: (value) => setTradeEditorState((prev) => ({ ...prev, tpVal: value })),
      fundamentalDraft: tradeEditorState.fundamentalDraft,
      setFundamentalDraft: (valueOrUpdater) =>
        setTradeEditorState((prev) => ({
          ...prev,
          fundamentalDraft:
            typeof valueOrUpdater === 'function'
              ? valueOrUpdater(prev.fundamentalDraft)
              : valueOrUpdater,
        })),
      upsertTargetReport,
      upsertFundamentalsEntry,
      createDefaultFundamentalDraft,
      toSlashDate,
      flashSaved,
      resetActiveUploadMemo,
    }),
    [
      activeUpload,
      createDefaultFundamentalDraft,
      dragOver,
      memoBatchMode,
      memoQuestions,
      parseShot,
      parsed,
      parsing,
      previewEntries,
      processFile,
      processFiles,
      removeUpload,
      clearUploads,
      resetTradeCapture,
      resetActiveUploadMemo,
      selectUpload,
      setMemoAns,
      setMemoIn,
      setMemoStep,
      setParsed,
      setTradeDate,
      skipMemo,
      submittingTrade,
      submitMemo,
      confirmTradePreview,
      tradeDisclaimer,
      setTradeDisclaimerChecked,
      acknowledgeTradeDisclaimer,
      openTradeDisclaimer,
      portfolioId,
      holdings,
      tradeLog,
      marketQuotes,
      setHoldings,
      setTradeLog,
      flashSaved,
      toSlashDate,
      tradeEditorState,
      upsertFundamentalsEntry,
      upsertTargetReport,
    ]
  )
}
