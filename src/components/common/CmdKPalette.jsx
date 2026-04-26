import { useEffect, useMemo, useRef, useState } from 'react'
import { C, alpha } from '../../theme.js'

const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

function getIsMobileViewport() {
  const isMobile =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches

  return isMobile
}

function groupResults(results) {
  return results.reduce((accumulator, item, index) => {
    const group = accumulator.get(item.source) || []
    group.push({ ...item, _index: index })
    accumulator.set(item.source, group)
    return accumulator
  }, new Map())
}

export default function CmdKPalette({
  open = false,
  query = '',
  results = [],
  activeIndex = 0,
  onQueryChange = () => {},
  onKeyDown = () => {},
  onHoverItem = () => {},
  onSelectItem = () => {},
  onClose = () => {},
}) {
  const inputRef = useRef(null)
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport())
  const [viewportHeight, setViewportHeight] = useState(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    inputRef.current?.select?.()
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)

    updateIsMobile()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateIsMobile)
      return () => mediaQuery.removeEventListener('change', updateIsMobile)
    }

    mediaQuery.addListener(updateIsMobile)
    return () => mediaQuery.removeListener(updateIsMobile)
  }, [])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined

    const updateViewportHeight = () => {
      setViewportHeight(window.visualViewport?.height || null)
    }

    updateViewportHeight()

    if (!window.visualViewport) return undefined

    window.visualViewport.addEventListener('resize', updateViewportHeight)
    return () => window.visualViewport.removeEventListener('resize', updateViewportHeight)
  }, [open])

  const groupedResults = useMemo(() => groupResults(results), [results])

  const openFromFab = () => {
    window.dispatchEvent(new CustomEvent('cmdk:open'))
  }

  return (
    <>
      <style>{`
        .cmd-k-modal {
          max-height: 100dvh;
        }

        @supports not (height: 100dvh) {
          .cmd-k-modal {
            max-height: 100vh;
          }
        }
      `}</style>

      {isMobile && !open ? (
        <button
          type="button"
          aria-label="開啟全局搜尋"
          className="cmd-k-fab"
          onClick={openFromFab}
          style={{
            position: 'fixed',
            right: 'max(16px, env(safe-area-inset-right))',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 1190,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `1px solid ${alpha(C.positive, '40')}`,
            background: alpha(C.shell, 'f8'),
            color: C.text,
            boxShadow: `0 18px 40px ${alpha(C.bg, '72')}`,
            fontSize: 24,
            cursor: 'pointer',
          }}
        >
          🔍
        </button>
      ) : null}

      {open ? (
        <div
          aria-hidden="false"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: alpha(C.shell, 'ee'),
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            justifyContent: 'center',
            padding: isMobile ? 0 : '9vh 16px 24px',
          }}
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="全局搜尋"
            className="cmd-k-modal"
            style={{
              width: isMobile ? '100%' : 'min(760px, 100%)',
              height: isMobile ? '100%' : 'auto',
              maxHeight: viewportHeight ? `${viewportHeight}px` : undefined,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: isMobile ? 0 : 16,
              background: alpha(C.shell, 'fb'),
              border: isMobile ? 'none' : `1px solid ${C.borderStrong}`,
              boxShadow: isMobile ? 'none' : `0 36px 90px ${alpha(C.bg, '90')}, ${C.shellShadow}`,
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: isMobile ? '16px 16px 12px' : '16px 16px 12px',
                borderBottom: `1px solid ${C.borderSub}`,
                background: alpha(C.card, '10'),
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 16,
                  border: `1px solid ${C.borderStrong}`,
                  background: alpha(C.bg, '30'),
                  padding: '12px 16px',
                }}
              >
                <span style={{ color: C.textMute, fontSize: 14 }}>{isMobile ? '搜尋' : '⌘K'}</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="搜尋持股代碼、事件、報告或指令"
                  aria-label="搜尋內容"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: C.text,
                    fontSize: 16,
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.textMute }}>
                {isMobile
                  ? '點一下結果即可跳轉 · 可用 Esc 關閉'
                  : '`Enter` 跳轉 · `↑↓` 選擇 · `Esc` 關閉'}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: isMobile
                  ? '12px 16px max(24px, env(safe-area-inset-bottom))'
                  : '12px 12px 16px',
              }}
            >
              {results.length === 0 ? (
                <div
                  style={{
                    padding: isMobile ? '48px 24px' : '32px 16px',
                    textAlign: 'center',
                    color: C.textMute,
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                >
                  找不到符合結果，試試股票代碼、事件名稱或頁面名稱。
                </div>
              ) : (
                Array.from(groupedResults.entries()).map(([groupName, items]) => (
                  <section
                    key={groupName}
                    aria-label={`${groupName}結果`}
                    style={{ marginBottom: 8 }}
                  >
                    <div
                      style={{
                        padding: isMobile ? '8px 12px 8px' : '8px 12px 4px',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: C.textMute,
                        textTransform: 'uppercase',
                      }}
                    >
                      {groupName}
                    </div>
                    {items.map((item) => {
                      const selected = item._index === activeIndex
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-selected={selected}
                          onMouseEnter={() => onHoverItem(item._index)}
                          onClick={() => onSelectItem(item)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            border: `1px solid ${selected ? alpha(C.positive, '44') : 'transparent'}`,
                            background: selected ? alpha(C.positive, '12') : 'transparent',
                            color: C.text,
                            borderRadius: 16,
                            padding: isMobile ? '16px 16px' : '12px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: isMobile ? 15 : 14,
                                fontWeight: 600,
                                color: selected ? C.positive : C.text,
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                fontSize: isMobile ? 12 : 11,
                                color: C.textMute,
                                marginTop: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: selected ? C.text : C.textMute,
                              borderRadius: 999,
                              border: `1px solid ${selected ? alpha(C.positive, '30') : C.borderSub}`,
                              padding: isMobile ? '4px 8px' : '4px 8px',
                              flexShrink: 0,
                            }}
                          >
                            {item.source}
                          </span>
                        </button>
                      )
                    })}
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
