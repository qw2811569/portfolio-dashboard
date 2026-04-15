import { C } from '../theme.js'
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
          fontFamily: "'Inter','Noto Sans TC',system-ui,sans-serif",
          padding: '24px 18px',
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            border: `1px solid ${C.borderSub}`,
            borderRadius: 18,
            background: C.shell,
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
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
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: C.teal }}>
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
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.textMute,
                    background: C.card,
                    border: `1px solid ${C.borderSub}`,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8, marginBottom: 18 }}>
              {detail}
            </div>

            <div
              aria-hidden="true"
              style={{
                height: 6,
                borderRadius: 999,
                background: C.card,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: '42%',
                  height: '100%',
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${C.teal}, ${C.blue})`,
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
        fontFamily: "'Inter','Noto Sans TC',system-ui,sans-serif",
        paddingBottom: 40,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        /* Global styles moved to a separate CSS file or a dedicated style component if needed */
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
