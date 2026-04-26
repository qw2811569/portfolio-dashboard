import { getDailyPrinciple } from '../../lib/dailyPrinciples.js'
import { buildTodayActions } from '../../lib/holdingsActionRail.js'
import { C, alpha } from '../../theme.js'
import { Card } from '../common'

const railTitle = {
  fontSize: 13,
  fontWeight: 800,
  color: C.text,
  marginBottom: 8,
}

const railEyebrow = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMute,
  letterSpacing: '0.08em',
  marginBottom: 3,
}

const toneMeta = {
  alert: { color: C.down, bg: alpha(C.down, '12'), border: alpha(C.down, '28') },
  warning: { color: C.text, bg: alpha(C.amber, '14'), border: alpha(C.amber, '30') },
  watch: { color: C.text, bg: alpha(C.fillTeal, '12'), border: alpha(C.fillTeal, '30') },
  mute: { color: C.textSec, bg: alpha(C.textMute, '10'), border: alpha(C.textMute, '18') },
}

function ActionItem({ item }) {
  const tone = toneMeta[item?.tone] || toneMeta.mute

  return (
    <li
      style={{
        display: 'grid',
        gap: 3,
        padding: '9px 10px',
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        background: tone.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ minWidth: 0, color: C.text, fontSize: 12, fontWeight: 800 }}>
          {item.title}
        </span>
        {item.code ? (
          <span className="tn" style={{ flex: '0 0 auto', color: C.textMute, fontSize: 11 }}>
            {item.code}
          </span>
        ) : null}
      </div>
      <div style={{ color: tone.color, fontSize: 12, lineHeight: 1.5 }}>{item.body}</div>
    </li>
  )
}

function RailCard({ eyebrow, title, children, color = C.ink }) {
  return (
    <Card
      style={{
        padding: '14px 14px',
        borderRadius: 8,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={railEyebrow}>{eyebrow}</div>
      <div style={railTitle}>{title}</div>
      {children}
    </Card>
  )
}

export function PrincipleSummary() {
  const principle = getDailyPrinciple(new Date())

  return (
    <RailCard eyebrow="MINDSET" title="心法卡摘要" color={C.accent}>
      <div
        style={{
          color: C.text,
          fontSize: 13,
          lineHeight: 1.65,
          fontWeight: 700,
        }}
      >
        {principle.quote}
      </div>
      <div style={{ color: C.textMute, fontSize: 11, marginTop: 8 }}>{principle.author}</div>
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${C.border}`,
          color: C.textSec,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        今天先看這個：先照提醒與 thesis 檢查，不因盤中情緒改變原本策略。
      </div>
    </RailCard>
  )
}

export function TodayDoCard({ items = [] }) {
  return (
    <RailCard eyebrow="DO" title="今天先做" color={C.up}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {items.map((item, index) => (
          <ActionItem key={`${item.code || item.title}-${index}`} item={item} />
        ))}
      </ul>
    </RailCard>
  )
}

export function TodayDontCard({ items = [] }) {
  return (
    <RailCard eyebrow="DONT" title="今天不做" color={C.textMute}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {items.map((item, index) => (
          <ActionItem key={`${item.code || item.title}-${index}`} item={item} />
        ))}
      </ul>
    </RailCard>
  )
}

export function RiskAlertCard({ items = [] }) {
  return (
    <RailCard eyebrow="RISK" title="風險提醒" color={C.down}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {items.map((item, index) => (
          <ActionItem key={`${item.code || item.title}-${index}`} item={item} />
        ))}
      </ul>
    </RailCard>
  )
}

export default function HoldingsRightRail({
  holdings = [],
  holdingDossiers = [],
  dailyReport = null,
  alerts = [],
}) {
  const actions = buildTodayActions({
    holdings,
    dossiers: holdingDossiers,
    dailyReport,
    alerts,
  })

  return (
    <aside
      data-testid="holdings-right-rail"
      style={{
        display: 'grid',
        gap: 10,
        alignContent: 'start',
      }}
    >
      <PrincipleSummary />
      <TodayDoCard items={actions.doItems} />
      <TodayDontCard items={actions.dontItems} />
      <RiskAlertCard items={actions.riskItems} />
    </aside>
  )
}
