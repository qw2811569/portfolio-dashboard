import { useMemo } from 'react'
import { C, alpha } from '../../theme.js'
import { Button, Card } from './Base.jsx'

export function UpstreamHealthBanner({
  banner = null,
  onRetryAll = null,
  onLogin = null,
  loginHref = '',
}) {
  const resolvedLoginHref = useMemo(() => {
    if (loginHref) return loginHref
    if (typeof window === 'undefined') return ''
    return window.location.href
  }, [loginHref])

  if (!banner) return null

  const tone =
    banner.kind === 'auth'
      ? {
          border: alpha(C.amber, '38'),
          background: `linear-gradient(180deg, ${alpha(C.card, 'f6')}, ${alpha(C.amber, '10')})`,
          accent: C.amber,
        }
      : {
          border: alpha(C.down, '24'),
          background: `linear-gradient(180deg, ${alpha(C.card, 'f6')}, ${alpha(C.down, '08')})`,
          accent: C.textSec,
        }

  return (
    <Card
      data-testid="upstream-health-banner"
      data-upstream-kind={banner.kind}
      style={{
        marginBottom: 8,
        borderLeft: `3px solid ${tone.accent}`,
        borderColor: tone.border,
        background: tone.background,
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.55 }}>
          {banner.headline}
        </div>
        {banner.body ? (
          <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.75 }}>{banner.body}</div>
        ) : null}
        {banner.action === 'login' ? (
          resolvedLoginHref ? (
            <a
              href={resolvedLoginHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 44,
                minHeight: 44,
                width: 'fit-content',
                padding: '10px 14px',
                borderRadius: 999,
                border: `1px solid ${alpha(C.amber, '2a')}`,
                background: alpha(C.amber, '12'),
                color: C.textSec,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textDecoration: 'none',
              }}
            >
              {banner.actionLabel}
            </a>
          ) : (
            <Button
              data-testid="upstream-health-login"
              color="amber"
              size="sm"
              style={{ width: 'fit-content', textTransform: 'none' }}
              onClick={() => onLogin?.()}
            >
              {banner.actionLabel}
            </Button>
          )
        ) : (
          <Button
            data-testid="upstream-health-retry"
            color="amber"
            size="sm"
            style={{ width: 'fit-content', textTransform: 'none' }}
            onClick={() => onRetryAll?.()}
          >
            {banner.actionLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}
