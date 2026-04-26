import { createElement as h, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { Card, Button, TextFieldDialog } from '../common'
import { assessTradeParseQuality, summarizeTradeBatch } from '../../lib/tradeParseUtils.js'
import { TradeDisclaimerModal } from './TradeDisclaimerModal.jsx'
import TradeWizard from './TradeWizard.jsx'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}

/**
 * Upload Dropzone
 */
export function UploadDropzone({
  img,
  parsed: _parsed,
  dragOver,
  setDragOver,
  processFile,
  processFiles,
  parseShot,
  parsing,
  parseErr,
  uploads = [],
  activeUploadId = null,
  activeUploadIndex = -1,
  selectUpload,
  removeUpload,
  clearUploads,
}) {
  const uploadCount = Array.isArray(uploads) ? uploads.length : 0

  const handleFiles = (fileList) => {
    if (processFiles) {
      processFiles(fileList)
      return
    }
    processFile?.(fileList?.[0] || null)
  }

  return h(
    'div',
    { 'data-testid': 'upload-dropzone' },
    h(
      'div',
      {
        onDragOver: (e) => {
          e.preventDefault()
          setDragOver(true)
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        },
        onClick: () => document.getElementById('fi').click(),
        className: 'ui-card',
        style: {
          border: `1px dashed ${dragOver ? C.borderStrong : C.border}`,
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? C.subtleElev : C.card,
          marginBottom: 12,
          transition: 'all 0.2s',
        },
      },
      h('input', {
        'data-testid': 'trade-upload-input',
        id: 'fi',
        type: 'file',
        multiple: true,
        accept: 'image/*',
        onChange: (e) => handleFiles(e.target.files),
        style: { display: 'none' },
      }),
      img
        ? h(
            'div',
            null,
            h('img', {
              src: img,
              alt: '',
              style: {
                maxHeight: 200,
                maxWidth: '100%',
                borderRadius: 8,
                objectFit: 'contain',
                marginBottom: 8,
              },
            }),
            h(
              'div',
              { style: { fontSize: 11, color: C.textMute } },
              '點擊新增更多截圖或切換待處理圖片'
            )
          )
        : h(
            'div',
            null,
            h('div', { style: { fontSize: 32, marginBottom: 8, opacity: 0.5 } }, '↑'),
            h(
              'div',
              { style: { fontSize: 13, fontWeight: 500, color: C.textSec } },
              '上傳已成交截圖'
            ),
            h(
              'div',
              { style: { fontSize: 11, color: C.textMute, marginTop: 4 } },
              '支援一次加入多張，買進 · 賣出回報皆可'
            )
          )
    ),
    uploadCount > 0 &&
      h(
        Card,
        {
          style: {
            marginBottom: 12,
            borderLeft: `2px solid ${alpha(C.positive, '35')}`,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 8,
            },
          },
          h(
            'div',
            null,
            h('div', { style: lbl }, '待處理截圖佇列'),
            h(
              'div',
              { style: { fontSize: 11, color: C.textMute } },
              uploadCount > 1
                ? `第 ${activeUploadIndex + 1} / ${uploadCount} 張，補登完成後會自動切下一張`
                : '單張模式，解析完成後可直接寫入持倉與交易日誌'
            )
          ),
          uploadCount > 1 &&
            h(
              Button,
              {
                onClick: clearUploads,
                size: 'xs',
              },
              '清空全部'
            )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          uploads.map((upload, index) => {
            const isActive = upload.id === activeUploadId
            const statusLabel = upload.parseErr
              ? '解析失敗'
              : upload.parsed?.trades?.length
                ? `${upload.parsed.trades.length} 筆`
                : '待解析'

            return h(
              'div',
              {
                key: upload.id,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: isActive ? C.subtleElev : C.subtle,
                  border: `1px solid ${isActive ? C.borderStrong : C.border}`,
                  borderRadius: 999,
                  padding: '4px 8px',
                },
              },
              h(
                'button',
                {
                  className: 'ui-btn',
                  onClick: () => selectUpload?.(upload.id),
                  style: {
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? C.text : C.textSec,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                  },
                },
                `${index + 1}. ${upload.name}`
              ),
              h(
                'span',
                { style: { fontSize: 11, color: upload.parseErr ? C.textSec : C.textMute } },
                statusLabel
              ),
              h(
                'button',
                {
                  className: 'ui-btn',
                  onClick: () => removeUpload?.(upload.id),
                  style: {
                    border: 'none',
                    background: 'transparent',
                    color: C.textMute,
                    cursor: 'pointer',
                    fontSize: 12,
                  },
                  'aria-label': `移除 ${upload.name}`,
                },
                '×'
              )
            )
          })
        )
      ),
    img &&
      h(
        Button,
        {
          onClick: parseShot,
          disabled: parsing,
          style: {
            width: '100%',
            padding: '12px',
            borderRadius: C.radii.md,
            background: parsing ? C.subtle : C.cardHover,
            color: parsing ? C.textMute : C.text,
            border: `1px solid ${parsing ? C.border : alpha(C.amber, '40')}`,
            fontSize: 13,
            fontWeight: 500,
            cursor: parsing ? 'not-allowed' : 'pointer',
            letterSpacing: '0.02em',
          },
        },
        parsing
          ? '解析中...'
          : `解析目前這張${uploadCount > 1 ? `（${activeUploadIndex + 1}/${uploadCount}）` : ''}`
      ),
    parseErr &&
      h(
        'div',
        {
          style: {
            marginTop: 8,
            background: C.upBg,
            border: `1px solid ${alpha(C.up, '20')}`,
            borderRadius: C.radii.md,
            padding: 12,
            fontSize: 12,
            color: C.text,
          },
        },
        parseErr
      )
  )
}

/**
 * Parse Results
 */
export function ParseResults({
  parsed,
  setParsed,
  qs,
  memoAns,
  memoIn,
  setMemoIn,
  memoStep,
  submitMemo,
  skipMemo,
  tradeDate,
  setTradeDate,
  memoBatchMode,
  uploadCount = 0,
  activeUploadIndex = -1,
  isPreviewReady = false,
  previewEntries = [],
  confirmTradePreview,
  submittingTrade = false,
  disclaimerAckedAt = '',
  openTradeDisclaimer,
}) {
  const [editingField, setEditingField] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingError, setEditingError] = useState('')

  if (!parsed?.trades?.length) return null

  const openFieldEditor = (tradeIndex, field, value) => {
    setEditingField({ tradeIndex, field })
    setEditingValue(String(value ?? ''))
    setEditingError('')
  }

  const closeFieldEditor = () => {
    setEditingField(null)
    setEditingValue('')
    setEditingError('')
  }

  const submitFieldEdit = () => {
    if (!editingField) return
    const { tradeIndex, field } = editingField
    const isNumericField = field === 'qty' || field === 'price'
    const nextValue = isNumericField ? Number(editingValue) : editingValue.trim()

    if (isNumericField && Number.isNaN(nextValue)) {
      setEditingError('請輸入有效數字')
      return
    }
    if (!isNumericField && !String(nextValue || '').trim()) {
      setEditingError('欄位不可留白')
      return
    }

    setParsed((prev) => {
      const trades = [...prev.trades]
      trades[tradeIndex] = { ...trades[tradeIndex], [field]: nextValue }
      return { ...prev, trades }
    })
    closeFieldEditor()
  }

  const batchSummary = summarizeTradeBatch(parsed)
  const quality = assessTradeParseQuality(parsed)

  return h(
    'div',
    { 'data-testid': 'trade-parse-results' },
    h(TextFieldDialog, {
      open: Boolean(editingField),
      title: editingField
        ? `修正${{ qty: '股數', price: '成交價', name: '名稱', code: '代碼' }[editingField.field]}`
        : '修正欄位',
      subtitle: '修正 OCR 辨識結果，避免錯誤寫回交易紀錄與持倉。',
      label: editingField
        ? `新的${{ qty: '股數', price: '成交價', name: '名稱', code: '代碼' }[editingField.field]}`
        : '欄位',
      value: editingValue,
      onChange: (event) => setEditingValue(event.target.value),
      onSubmit: submitFieldEdit,
      onCancel: closeFieldEditor,
      submitLabel: '套用修正',
      placeholder: editingField
        ? String(parsed.trades?.[editingField.tradeIndex]?.[editingField.field] ?? '')
        : '',
      inputMode:
        editingField?.field === 'qty' || editingField?.field === 'price' ? 'decimal' : undefined,
      type: editingField?.field === 'qty' || editingField?.field === 'price' ? 'number' : 'text',
      error: editingError,
    }),
    h(
      Card,
      { style: { marginBottom: 12 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          null,
          h('div', { style: lbl }, '解析結果'),
          h(
            'div',
            { style: { fontSize: 12, color: C.textMute } },
            uploadCount > 1
              ? `目前是第 ${activeUploadIndex + 1} / ${uploadCount} 張，完成後會自動跳到下一張`
              : '點擊欄位可修正 OCR，完成後會直接寫入交易日誌與持倉'
          )
        ),
        h('span', { style: { fontSize: 11, color: C.textMute } }, '點擊可修正')
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 220px) auto',
            gap: 8,
            alignItems: 'end',
            marginBottom: 12,
          },
        },
        h(
          'label',
          { style: { display: 'grid', gap: 4 } },
          h('span', { style: { fontSize: 11, color: C.textMute } }, '成交日期'),
          h('input', {
            'data-testid': 'trade-date-input',
            value: tradeDate || '',
            onChange: (event) => setTradeDate?.(event.target.value),
            placeholder: '例如 2026/03/28',
            style: {
              width: '100%',
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
            },
          })
        ),
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: memoBatchMode === '混合' ? C.amber : C.textMute,
              background: memoBatchMode === '混合' ? C.amberBg : C.subtle,
              border: `1px solid ${memoBatchMode === '混合' ? alpha(C.amber, '25') : C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
              lineHeight: 1.6,
            },
          },
          memoBatchMode === '混合'
            ? '這批截圖同時包含買進與賣出，備忘錄會用批次問題記錄這次整體調整。'
            : `這張截圖會一次寫入 ${parsed.trades.length} 筆${memoBatchMode}交易。`
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
            gap: 8,
            marginBottom: 12,
          },
        },
        h(
          'div',
          {
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
            },
          },
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '批次摘要'),
          h(
            'div',
            { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
            `${batchSummary.tradeCount} 筆成交`
          )
        ),
        h(
          'div',
          {
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
            },
          },
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '買 / 賣分布'),
          h(
            'div',
            { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
            `${batchSummary.buyCount} 買 / ${batchSummary.sellCount} 賣`
          )
        ),
        h(
          'div',
          {
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
            },
          },
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '估計成交金額'),
          h(
            'div',
            { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
            `${Math.round(batchSummary.totalNotional).toLocaleString()} 元`
          )
        ),
        h(
          'div',
          {
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 8px',
            },
          },
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '涉及標的'),
          h(
            'div',
            { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
            batchSummary.codes.length ? batchSummary.codes.join(', ') : '待確認'
          )
        )
      ),
      quality.needsManualReview &&
        h(
          'div',
          {
            style: {
              marginBottom: 12,
              background: quality.confidence === 'low' ? C.upBg : C.amberBg,
              border: `1px solid ${alpha(quality.confidence === 'low' ? C.up : C.amber, '25')}`,
              borderRadius: 8,
              padding: '8px 12px',
            },
          },
          h(
            'div',
            {
              style: {
                fontSize: 12,
                fontWeight: 700,
                color: quality.confidence === 'low' ? C.up : C.amber,
                marginBottom: 4,
                letterSpacing: '0.04em',
              },
            },
            quality.confidence === 'low' ? 'OCR 低信心警示' : 'OCR 需要人工覆核'
          ),
          quality.issues.map((issue, index) =>
            h(
              'div',
              {
                key: `issue-${index}`,
                style: { fontSize: 11, color: C.textSec, lineHeight: 1.6 },
              },
              `• ${issue}`
            )
          ),
          quality.rowWarnings.length > 0 &&
            h(
              'div',
              {
                style: {
                  marginTop: 8,
                  display: 'grid',
                  gap: 4,
                },
              },
              quality.rowWarnings.map((warning) =>
                h(
                  'div',
                  {
                    key: `row-warning-${warning.index}`,
                    style: {
                      fontSize: 12,
                      color: C.textSec,
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 7,
                      padding: '4px 8px',
                    },
                  },
                  `第 ${warning.index + 1} 筆 ${warning.name || warning.code || '未命名交易'}：${warning.issues.join('、')}`
                )
              )
            )
        ),
      parsed.trades.map((t, i) => {
        const rowWarning = quality.rowWarnings.find((warning) => warning.index === i) || null
        const toggleAction = () =>
          setParsed((prev) => {
            const trades = [...prev.trades]
            trades[i] = { ...trades[i], action: trades[i].action === '買進' ? '賣出' : '買進' }
            return { ...prev, trades }
          })

        return h(
          'div',
          {
            key: i,
            style: {
              padding: '8px 0',
              borderBottom: i < parsed.trades.length - 1 ? `1px solid ${C.borderSub}` : 'none',
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' } },
            h(
              'span',
              {
                onClick: toggleAction,
                style: {
                  background: t.action === '買進' ? C.upBg : C.downBg,
                  color: t.action === '買進' ? C.up : C.down,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px dashed ${t.action === '買進' ? C.up : C.down}44`,
                },
              },
              `${t.action} ↔`
            ),
            h(
              'span',
              {
                onClick: () => openFieldEditor(i, 'name', t.name),
                style: { fontSize: 14, fontWeight: 600, color: C.text, cursor: 'pointer' },
              },
              t.name
            ),
            h(
              'span',
              {
                onClick: () => openFieldEditor(i, 'code', t.code),
                style: { fontSize: 12, color: C.textMute, cursor: 'pointer' },
              },
              t.code
            )
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 } },
            h(
              'span',
              {
                onClick: () => openFieldEditor(i, 'qty', t.qty),
                style: {
                  fontSize: 11,
                  color: C.textMute,
                  cursor: 'pointer',
                  borderBottom: `1px dashed ${C.borderStrong}`,
                },
              },
              `${t.qty}股`
            ),
            h('span', { style: { fontSize: 11, color: C.textMute } }, '@'),
            h(
              'span',
              {
                onClick: () => openFieldEditor(i, 'price', t.price),
                style: {
                  fontSize: 11,
                  color: C.textMute,
                  cursor: 'pointer',
                  borderBottom: `1px dashed ${C.borderStrong}`,
                },
              },
              `${t.price?.toLocaleString()}元`
            )
          ),
          rowWarning &&
            h(
              'div',
              {
                style: {
                  marginTop: 4,
                  fontSize: 12,
                  color: C.textSec,
                  background: C.amberBg,
                  border: `1px solid ${alpha(C.amber, '20')}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                },
              },
              `請確認：${rowWarning.issues.join('、')}`
            )
        )
      }),
      parsed.note &&
        h('div', { style: { fontSize: 12, color: C.textMute, marginTop: 8 } }, parsed.note),
      parsed.targetPriceUpdates?.length > 0 &&
        h(
          'div',
          {
            style: {
              marginTop: 8,
              background: alpha(C.positive, '12'),
              border: `1px solid ${alpha(C.positive, '20')}`,
              borderRadius: 7,
              padding: '8px 8px',
            },
          },
          h(
            'div',
            { style: { fontSize: 11, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
            '偵測到目標價更新'
          ),
          parsed.targetPriceUpdates.map((u, i) =>
            h(
              'div',
              { key: i, style: { fontSize: 11, color: C.textSec } },
              `${u.code} · ${u.firm} → ${u.target?.toLocaleString()}元`
            )
          )
        )
    ),

    h(
      Card,
      { style: { borderLeft: `2px solid ${alpha(C.ink, '40')}` } },
      h('div', { style: lbl }, '交易備忘錄'),
      memoAns.map((a, i) =>
        String(a || '').trim()
          ? h(
              'div',
              { key: i, style: { marginBottom: 12 } },
              h(
                'div',
                { style: { fontSize: 12, color: C.textMute, marginBottom: 4 } },
                `Q${i + 1}. ${qs[i]}`
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: 12,
                    color: C.textSec,
                    background: C.subtle,
                    borderRadius: 6,
                    padding: '8px 8px',
                    lineHeight: 1.6,
                  },
                },
                a
              )
            )
          : null
      ),
      isPreviewReady
        ? h(
            'div',
            {
              'data-testid': 'trade-preview-panel',
              style: {
                marginTop: 4,
                borderRadius: 12,
                border: `1px solid ${alpha(C.orange, '24')}`,
                background: alpha(C.orange, '10'),
                padding: '12px 12px',
              },
            },
            h(
              'div',
              { style: { fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 6 } },
              '寫入預覽'
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: C.textMute,
                  lineHeight: 1.7,
                  marginBottom: 10,
                },
              },
              '這一步先確認即將寫入的交易內容。系統只會記錄你已完成的交易，不會生成買賣建議。'
            ),
            previewEntries.length > 0 &&
              h(
                'div',
                {
                  style: {
                    display: 'grid',
                    gap: 8,
                    marginBottom: 10,
                  },
                },
                previewEntries.map((entry) =>
                  h(
                    'div',
                    {
                      key: entry.id,
                      style: {
                        borderRadius: C.radii.md,
                        border: `1px solid ${C.border}`,
                        background: C.card,
                        padding: '10px 10px',
                      },
                    },
                    h(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 4,
                        },
                      },
                      h(
                        'div',
                        {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          },
                        },
                        h(
                          'span',
                          {
                            style: {
                              minHeight: 28,
                              padding: '4px 8px',
                              borderRadius: 999,
                              background: entry.action === '買進' ? C.upBg : C.downBg,
                              color: entry.action === '買進' ? C.textSec : C.down,
                              fontSize: 11,
                              fontWeight: 700,
                            },
                          },
                          entry.action
                        ),
                        h(
                          'span',
                          { style: { fontSize: 13, fontWeight: 700, color: C.text } },
                          `${entry.name || entry.code} ${entry.code ? `· ${entry.code}` : ''}`
                        )
                      ),
                      h(
                        'span',
                        { style: { fontSize: 11, color: C.textMute } },
                        `${entry.date} ${entry.time}`
                      )
                    ),
                    h(
                      'div',
                      { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } },
                      `${entry.qty.toLocaleString()} 股 @ ${entry.price.toLocaleString()} 元`
                    )
                  )
                )
              ),
            h(
              'div',
              {
                style: {
                  fontSize: 11,
                  color: disclaimerAckedAt ? C.textMute : C.amber,
                  lineHeight: 1.7,
                  marginBottom: 10,
                },
              },
              disclaimerAckedAt
                ? `交易提醒已確認：${disclaimerAckedAt.slice(0, 10)}`
                : '尚未完成交易提醒確認；按下確認時會先請你勾選一次。'
            ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                },
              },
              h(
                Button,
                {
                  onClick: () => openTradeDisclaimer?.('entry'),
                  style: {
                    flex: '1 1 180px',
                  },
                },
                '查看交易提醒'
              ),
              h(
                Button,
                {
                  'data-testid': 'trade-confirm-btn',
                  onClick: () => confirmTradePreview?.(),
                  disabled: submittingTrade,
                  variant: 'filled',
                  color: 'blue',
                  style: {
                    flex: '1 1 220px',
                    fontWeight: 700,
                  },
                },
                submittingTrade ? '寫入中...' : '確認寫入交易'
              )
            )
          )
        : [
            h(
              'div',
              {
                key: 'memo-question',
                style: {
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.textSec,
                  marginBottom: 8,
                },
              },
              `Q${memoStep + 1}/${qs.length}. ${qs[memoStep]}`
            ),
            h('textarea', {
              key: 'memo-input',
              value: memoIn,
              onChange: (e) => setMemoIn(e.target.value),
              placeholder: '輸入你的想法... (Enter 送出)',
              style: {
                width: '100%',
                background: C.subtle,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '8px',
                color: C.text,
                fontSize: 12,
                resize: 'none',
                minHeight: 70,
                fontFamily: 'inherit',
                marginBottom: 8,
                lineHeight: 1.7,
              },
            }),
            h(
              Button,
              {
                key: 'memo-submit',
                onClick: submitMemo,
                disabled: !memoIn.trim(),
                style: {
                  width: '100%',
                  padding: '12px',
                  border: 'none',
                  borderRadius: 8,
                  background: memoIn.trim() ? alpha(C.fillTeal, '40') : C.subtle,
                  color: memoIn.trim() ? C.onFill : C.textMute,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: memoIn.trim() ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.02em',
                },
              },
              memoStep === qs.length - 1
                ? '完成備忘 · 前往預覽'
                : `下一題 (${memoStep + 1}/${qs.length})`
            ),
            skipMemo &&
              h(
                Button,
                {
                  key: 'memo-skip',
                  'data-testid': 'skip-memo-btn',
                  onClick: skipMemo,
                  style: {
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: 'transparent',
                    color: C.textMute,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    marginTop: 4,
                    letterSpacing: '0.02em',
                  },
                },
                '跳過備忘，先看預覽'
              ),
          ]
    )
  )
}

function normalizeManualTradeCode(value) {
  return String(value || '').trim()
}

function isValidManualTradeCode(value) {
  return /^\d{4,6}$/.test(normalizeManualTradeCode(value))
}

function isPositiveIntegerField(value) {
  const normalized = String(value || '').trim()
  return /^\d+$/.test(normalized) && Number(normalized) > 0
}

function isPositivePriceField(value) {
  const normalized = String(value || '').trim()
  return /^(?:\d+)(?:\.\d+)?$/.test(normalized) && Number(normalized) > 0
}

/**
 * Manual Trade Entry — 手動輸入買進/賣出
 */
export function ManualTradeEntry({ setParsed, toSlashDate }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [action, setAction] = useState('賣出')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const normalizedCode = normalizeManualTradeCode(code)
  const canSubmit =
    isValidManualTradeCode(normalizedCode) &&
    isPositiveIntegerField(qty) &&
    isPositivePriceField(price)

  const handleSubmit = () => {
    if (!canSubmit) return
    const q = Number.parseInt(String(qty).trim(), 10)
    const p = Number.parseFloat(String(price).trim())
    setParsed({
      trades: [
        {
          code: normalizedCode,
          name: name.trim() || normalizedCode,
          action,
          qty: q,
          price: p,
        },
      ],
      targetPriceUpdates: [],
      tradeDate: toSlashDate(),
      note: '手動輸入',
    })
    setCode('')
    setName('')
    setQty('')
    setPrice('')
  }

  const inputStyle = {
    background: C.cardBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '4px 8px',
    fontSize: 11,
    width: '100%',
  }

  return h(
    Card,
    { 'data-testid': 'manual-trade-entry', style: { marginTop: 12 } },
    h('div', { style: lbl }, '手動新增交易'),
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 } },
      h('input', {
        'data-testid': 'manual-trade-code-input',
        style: inputStyle,
        placeholder: '股票代碼',
        value: code,
        inputMode: 'numeric',
        onChange: (e) => setCode(e.target.value),
      }),
      h('input', {
        'data-testid': 'manual-trade-name-input',
        style: inputStyle,
        placeholder: '名稱（選填）',
        value: name,
        onChange: (e) => setName(e.target.value),
      }),
      h(
        'select',
        {
          'data-testid': 'manual-trade-action-select',
          'aria-label': '手動交易方向',
          style: { ...inputStyle, cursor: 'pointer' },
          value: action,
          onChange: (e) => setAction(e.target.value),
        },
        h('option', { value: '買進' }, '買進'),
        h('option', { value: '賣出' }, '賣出')
      ),
      h('input', {
        'data-testid': 'manual-trade-qty-input',
        style: inputStyle,
        placeholder: '股數',
        type: 'number',
        value: qty,
        onChange: (e) => setQty(e.target.value),
      }),
      h('input', {
        'data-testid': 'manual-trade-price-input',
        style: inputStyle,
        placeholder: '價格',
        type: 'number',
        step: '0.01',
        value: price,
        onChange: (e) => setPrice(e.target.value),
      }),
      h(
        Button,
        {
          'data-testid': 'manual-trade-submit-btn',
          disabled: !canSubmit,
          onClick: handleSubmit,
          style: { fontSize: 11, padding: '4px 12px' },
        },
        '新增'
      )
    )
  )
}

/**
 * Manual Update Forms
 */
export function ManualUpdateForms({
  tpCode,
  tpFirm,
  tpVal,
  setTpCode,
  setTpFirm,
  setTpVal,
  fundamentalDraft,
  setFundamentalDraft,
  upsertTargetReport,
  upsertFundamentalsEntry,
  createDefaultFundamentalDraft,
  toSlashDate,
}) {
  const handleAddTarget = () => {
    const ok = upsertTargetReport({
      code: tpCode,
      firm: tpFirm,
      target: parseFloat(tpVal),
      date: toSlashDate(),
    })
    if (!ok) return
    setTpCode('')
    setTpFirm('')
    setTpVal('')
  }

  const handleSaveFundamentals = () => {
    const code = fundamentalDraft.code.trim()
    if (!code) return
    const ok = upsertFundamentalsEntry(code, {
      revenueMonth: fundamentalDraft.revenueMonth.trim() || null,
      revenueYoY: fundamentalDraft.revenueYoY === '' ? null : Number(fundamentalDraft.revenueYoY),
      revenueMoM: fundamentalDraft.revenueMoM === '' ? null : Number(fundamentalDraft.revenueMoM),
      quarter: fundamentalDraft.quarter.trim() || null,
      eps: fundamentalDraft.eps === '' ? null : Number(fundamentalDraft.eps),
      grossMargin:
        fundamentalDraft.grossMargin === '' ? null : Number(fundamentalDraft.grossMargin),
      roe: fundamentalDraft.roe === '' ? null : Number(fundamentalDraft.roe),
      source: fundamentalDraft.source.trim() || '手動整理',
      updatedAt: fundamentalDraft.updatedAt.trim() || toSlashDate(),
      note: fundamentalDraft.note.trim(),
    })
    if (!ok) return
    setFundamentalDraft(createDefaultFundamentalDraft())
  }

  return h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 } },
    h(
      Card,
      { style: { borderLeft: `2px solid ${alpha(C.positive, '40')}` } },
      h('div', { style: lbl }, '手動更新目標價'),
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginBottom: 8, lineHeight: 1.6 } },
        '收到新研究報告時，直接在這裡更新。系統會自動計算多家均值。'
      ),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 } },
        h(
          'div',
          null,
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '股票代碼'),
          h('input', {
            value: tpCode,
            onChange: (e) => setTpCode(e.target.value),
            placeholder: '如 3006',
            style: {
              width: '100%',
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 8px',
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
            },
          })
        ),
        h(
          'div',
          null,
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '目標價（元）'),
          h('input', {
            value: tpVal,
            onChange: (e) => setTpVal(e.target.value),
            placeholder: '如 205',
            type: 'number',
            style: {
              width: '100%',
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 8px',
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
            },
          })
        )
      ),
      h(
        'div',
        { style: { marginBottom: 8 } },
        h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '券商 / 來源'),
        h('input', {
          value: tpFirm,
          onChange: (e) => setTpFirm(e.target.value),
          placeholder: '如 元大投顧、FactSet 共識',
          style: {
            width: '100%',
            background: C.subtle,
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            padding: '8px 8px',
            color: C.text,
            fontSize: 12,
            fontFamily: 'inherit',
          },
        })
      ),
      h(
        Button,
        {
          onClick: handleAddTarget,
          disabled: !tpCode.trim() || !tpVal,
          style: {
            width: '100%',
            padding: '8px',
            border: 'none',
            borderRadius: 8,
            background: tpCode.trim() && tpVal ? alpha(C.fillTeal, '40') : C.subtle,
            color: tpCode.trim() && tpVal ? C.onFill : C.textMute,
            fontSize: 12,
            fontWeight: 500,
            cursor: tpCode.trim() && tpVal ? 'pointer' : 'not-allowed',
          },
        },
        '新增 / 更新目標價'
      )
    ),

    h(
      Card,
      { style: { borderLeft: `2px solid ${alpha(C.amber, '40')}` } },
      h('div', { style: lbl }, '手動更新財報 / 營收'),
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginBottom: 8, lineHeight: 1.6 } },
        '法說、月營收或財報出來後，把關鍵數字補進來，持股筆記就會一起更新。'
      ),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 } },
        h(
          'div',
          null,
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '股票代碼'),
          h('input', {
            value: fundamentalDraft.code,
            onChange: (e) => setFundamentalDraft((prev) => ({ ...prev, code: e.target.value })),
            placeholder: '如 6274',
            style: {
              width: '100%',
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 8px',
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
            },
          })
        ),
        h(
          'div',
          null,
          h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '資料日期'),
          h('input', {
            value: fundamentalDraft.updatedAt,
            onChange: (e) =>
              setFundamentalDraft((prev) => ({ ...prev, updatedAt: e.target.value })),
            placeholder: '如 2026/03/24',
            style: {
              width: '100%',
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: '8px 8px',
              color: C.text,
              fontSize: 12,
              fontFamily: 'inherit',
            },
          })
        )
      ),
      h(
        'div',
        { style: { marginBottom: 8 } },
        h(
          Button,
          {
            onClick: handleSaveFundamentals,
            disabled: !fundamentalDraft.code.trim(),
            style: {
              width: '100%',
              padding: '8px',
              border: 'none',
              borderRadius: 8,
              background: fundamentalDraft.code.trim() ? alpha(C.fillAmber, '40') : C.subtle,
              color: fundamentalDraft.code.trim() ? C.onFill : C.textMute,
              fontSize: 12,
              fontWeight: 500,
              cursor: fundamentalDraft.code.trim() ? 'pointer' : 'not-allowed',
            },
          },
          '儲存財報 / 營收摘要'
        )
      )
    )
  )
}

/**
 * Main Trade Panel
 */
export function TradePanel(props) {
  const {
    portfolioId,
    holdings,
    tradeLog,
    marketQuotes,
    setHoldings,
    setTradeLog,
    tradeDisclaimer,
    setTradeDisclaimerChecked,
    acknowledgeTradeDisclaimer,
    toSlashDate,
    flashSaved,
  } = props

  return h(
    'div',
    { 'data-testid': 'trade-panel' },
    h(TradeDisclaimerModal, {
      open: Boolean(tradeDisclaimer?.open),
      checked: Boolean(tradeDisclaimer?.checked),
      onCheckedChange: setTradeDisclaimerChecked,
      onConfirm: acknowledgeTradeDisclaimer,
      mode: tradeDisclaimer?.mode || 'entry',
    }),
    h(TradeWizard, {
      portfolioId,
      holdings,
      tradeLog,
      marketQuotes,
      setHoldings,
      setTradeLog,
      toSlashDate,
      flashSaved,
      disclaimerAckedAt: tradeDisclaimer?.ackedAt || '',
    })
  )
}
