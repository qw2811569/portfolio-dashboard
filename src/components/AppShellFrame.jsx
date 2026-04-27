import { useEffect, useRef, useState } from 'react'
import { C } from '../theme.js'
import AppPanels from './AppPanels.jsx'
import { ConfirmDialog } from './common/index.js'
import { Skeleton } from './common/Skeleton.jsx'
import CmdKPalette from './common/CmdKPalette.jsx'
import Header from './Header.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { PortfolioPanelsProvider } from '../contexts/PortfolioPanelsContext.jsx'
import { useCmdK } from '../hooks/useCmdK.js'
import OnboardingTour from './onboarding/OnboardingTour.jsx'

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
  const panelRootRef = useRef(null)
  const [onboardingReplayToken, setOnboardingReplayToken] = useState(0)
  const visuallyHiddenStyle = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }
  const cmdK = useCmdK({
    headerProps,
    panelsActions,
    panelRootRef,
  })
  const handleCmdKKeyDown = cmdK.handleGlobalKeyDown

  useEffect(() => {
    const handleKeyDown = (event) => {
      handleCmdKKeyDown(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCmdKKeyDown])

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
          background: `var(--app-bg, ${C.appBg})`,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.text,
          fontFamily: 'var(--font-body)',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            background: C.raised,
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
              padding: '12px 16px',
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
              持倉看板
            </div>
            <div style={{ fontSize: 11, color: C.textMute }}>
              {elapsedSeconds ? `啟動中 ${elapsedSeconds}s` : '正在建立主畫面'}
            </div>
          </div>

          <div style={{ padding: '24px 16px 16px' }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              {['持倉', '事件', '收盤分析', '研究'].map((item) => (
                <span
                  key={item}
                  style={{
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.textMute,
                    background: C.surface,
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
            <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8, marginBottom: 16 }}>
              {detail}
            </div>

            <div data-skeleton="boot-shell" style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
              <Skeleton variant="text" count={1} />
              <Skeleton variant="row" count={3} />
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
      className="portfolio-app-root"
      style={{
        background: `var(--app-bg, ${C.appBg})`,
        minHeight: '100vh',
        color: C.text,
        fontFamily: 'var(--font-body)',
        paddingBottom: 48,
      }}
    >
      <style>{`
        :root {
          --font-headline: 'Source Serif 4','Noto Serif TC',serif;
          --font-body: 'Source Sans 3','Noto Sans TC',sans-serif;
          --font-num: 'Source Serif 4','IBM Plex Mono',serif;
          --font-mono: 'IBM Plex Mono','SFMono-Regular',ui-monospace,monospace;
        }
        @media (max-width: 768px) {
          .portfolio-app-root {
            padding-bottom: calc(104px + env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>

      <ErrorBoundary
        scope="header"
        title={headerBoundaryCopy.title}
        description={headerBoundaryCopy.description}
      >
        <Header
          {...headerProps}
          onOpenOnboarding={() => setOnboardingReplayToken((current) => current + 1)}
        />
      </ErrorBoundary>

      <main className="app-shell" style={{ padding: '8px 12px' }} aria-label="持倉工作台主內容">
        <h1 style={visuallyHiddenStyle}>持倉工作台</h1>
        <div ref={panelRootRef}>
          <PortfolioPanelsProvider data={panelsData} actions={panelsActions}>
            <AppPanels {...panelsProps} />
          </PortfolioPanelsProvider>
        </div>
      </main>

      <CmdKPalette
        open={cmdK.open}
        query={cmdK.query}
        results={cmdK.results}
        activeIndex={cmdK.activeIndex}
        onQueryChange={cmdK.setQuery}
        onKeyDown={cmdK.onInputKeyDown}
        onHoverItem={cmdK.setActiveIndex}
        onSelectItem={cmdK.onSelectItem}
        onClose={cmdK.closePalette}
      />
      <ConfirmDialog {...confirmDialogProps} />
      <OnboardingTour
        key={onboardingReplayToken}
        replayToken={onboardingReplayToken}
        onNavigate={headerProps?.setTab}
      />
    </div>
  )
}
