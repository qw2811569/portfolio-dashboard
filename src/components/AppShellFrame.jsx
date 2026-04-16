import { C, alpha } from '../theme.js'
import AppPanels from './AppPanels.jsx'
import { ConfirmDialog } from './common/index.js'
import Header from './Header.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { PortfolioPanelsProvider } from '../contexts/PortfolioPanelsContext.jsx'

export default function AppShellFrame({
  ready,
  loadingMessage,
  loadingState,
  headerBoundaryCopy,
  headerProps,
  panelsData,
  panelsActions,
  panelsProps,
  confirmDialogProps,
}) {
  if (!ready) {
    const title = loadingState?.title || '正在啟動投組工作台'
    const detail = loadingState?.detail || loadingMessage
    const elapsedSeconds =
      Number.isFinite(loadingState?.elapsedMs) && loadingState.elapsedMs > 0
        ? (loadingState.elapsedMs / 1000).toFixed(1)
        : null
    return (
      <div
        style={{
          background: C.bg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.text,
          fontFamily: 'var(--font-body)',
          padding: '24px 18px',
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            border: `1px solid ${C.border}`,
            borderRadius: 24,
            background: C.shell,
            boxShadow: C.shellShadow,
            overflow: 'hidden',
          }}
        >
          <style>{`
            @keyframes app-shell-boot-indeterminate {
              0% { transform: translateX(-120%); }
              50% { transform: translateX(90%); }
              100% { transform: translateX(160%); }
            }
          `}</style>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderSub}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: C.textMute,
                textTransform: 'uppercase',
              }}
            >
              PORTFOLIO OS
            </div>
            <div style={{ fontSize: 11, color: C.textMute }}>
              {elapsedSeconds ? `啟動中 ${elapsedSeconds}s` : '正在建立主畫面'}
            </div>
          </div>

          <div style={{ padding: '22px 18px 18px' }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 18,
                flexWrap: 'wrap',
              }}
            >
              {['持倉', '事件', '收盤分析', '研究'].map((item) => (
                <span
                  key={item}
                  style={{
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 10,
                    fontWeight: 500,
                    color: C.textMute,
                    background: C.card,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                marginBottom: 8,
                fontFamily: 'var(--font-headline)',
                lineHeight: 1.05,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8, marginBottom: 18 }}>
              {detail}
            </div>

            <div
              aria-hidden="true"
              style={{
                height: 6,
                borderRadius: 999,
                background: C.subtleElev,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: '42%',
                  height: '100%',
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${C.cyan}, ${C.blue}, ${C.teal})`,
                  animation: 'app-shell-boot-indeterminate 1.8s ease-in-out infinite',
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.7 }}>
              首次載入會先整理本機投組，再把各頁資料接回同一套主畫面。
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100vh',
        color: C.text,
        fontFamily: 'var(--font-body)',
        paddingBottom: 40,
      }}
    >
      <style>{`
        :root {
          --font-headline: 'Source Serif 4','Noto Serif TC',serif;
          --font-body: 'Source Sans 3','Noto Sans TC',sans-serif;
          --font-num: 'Source Serif 4','IBM Plex Mono',serif;
          --font-mono: 'IBM Plex Mono','SFMono-Regular',ui-monospace,monospace;
        }
      `}</style>

      <ErrorBoundary
        scope="header"
        title={headerBoundaryCopy.title}
        description={headerBoundaryCopy.description}
      >
        <Header {...headerProps} />
      </ErrorBoundary>

      <div className="app-shell" style={{ padding: '10px 14px' }}>
        <PortfolioPanelsProvider data={panelsData} actions={panelsActions}>
          <AppPanels {...panelsProps} />
        </PortfolioPanelsProvider>
      </div>

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  )
}
