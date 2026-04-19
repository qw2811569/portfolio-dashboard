import { createElement as h, useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { Card } from '../common/index.js'
import { usePortfolioRouteContext } from '../../pages/usePortfolioRouteContext.js'

const WINDOW_DAYS = 30
const TOTAL_DAYS = WINDOW_DAYS * 2
const TIMELINE_STYLE_ID = 'events-timeline-styles'

function ensureDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const matched = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  const normalizedDate = matched
    ? `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`
    : raw.replace(/\//g, '-')
  const normalized = normalizedDate.includes('T') ? normalizedDate : `${normalizedDate}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function diffInDays(target, base) {
  if (!(target instanceof Date) || !(base instanceof Date)) return null
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatShortDate(value) {
  const date = ensureDate(value)
  if (!date) return '--/--'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function formatEventLabel(event) {
  return event?.type || '事件'
}

function buildTooltip(event, daysFromToday) {
  const title = event?.label || event?.title || '未命名事件'
  const stocks = Array.isArray(event?.stocks) ? event.stocks.join('、') : ''
  const relative =
    daysFromToday === 0
      ? '今天'
      : daysFromToday > 0
        ? `${daysFromToday} 天後`
        : `${Math.abs(daysFromToday)} 天前`

  return [title, event?.date, relative, event?.type, stocks, event?.detail || event?.sub]
    .filter(Boolean)
    .join('\n')
}

function resolveEventTone(daysFromToday) {
  if (daysFromToday === 0) {
    return {
      marker: `var(--up, ${C.up})`,
      line: `var(--up, ${C.up})`,
      text: C.text,
      rail: alpha(C.up, '22'),
    }
  }

  if (daysFromToday < 0) {
    return {
      marker: `var(--muted, ${C.textMute})`,
      line: `var(--muted, ${C.textMute})`,
      text: C.textMute,
      rail: alpha(C.textMute, '18'),
    }
  }

  return {
    marker: `var(--positive, ${C.up})`,
    line: `var(--positive, ${C.up})`,
    text: C.text,
    rail: alpha(C.olive, '18'),
  }
}

function buildTimelineEvents(events, holdingCodes) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (Array.isArray(events) ? events : [])
    .map((event, index) => {
      const date = ensureDate(event?.date || event?.eventDate || event?.trackingStart)
      if (!date) return null

      const daysFromToday = diffInDays(date, today)
      if (!Number.isFinite(daysFromToday)) return null
      if (daysFromToday < -WINDOW_DAYS || daysFromToday > WINDOW_DAYS) return null

      const stocks = Array.isArray(event?.stocks) ? event.stocks : []
      const matchesHolding = stocks.some((stock) => {
        const matchedCode = String(stock || '').match(/\d{4,6}[A-Z]?L?/i)?.[0]
        return matchedCode && holdingCodes.has(matchedCode)
      })
      const isImportant = Boolean(event?.urgent || event?.isUrgent || matchesHolding)
      const position = clamp(((daysFromToday + WINDOW_DAYS) / TOTAL_DAYS) * 100, 0, 100)
      const lane = index % 2 === 0 ? 'top' : 'bottom'

      return {
        ...event,
        daysFromToday,
        dateLabel: formatShortDate(date),
        formattedLabel: formatEventLabel(event),
        fullLabel: event?.label || event?.title || '未命名事件',
        matchesHolding,
        isImportant,
        position,
        lane,
        tooltip: buildTooltip(event, daysFromToday),
        tone: resolveEventTone(daysFromToday),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.daysFromToday !== b.daysFromToday) return a.daysFromToday - b.daysFromToday
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1
      return a.fullLabel.localeCompare(b.fullLabel, 'zh-Hant')
    })
    .map((event, index) => ({
      ...event,
      lane: index % 2 === 0 ? 'top' : 'bottom',
    }))
}

function TimelineMarker({ event, onHover, onLeave }) {
  const markerSize = event.isImportant ? 18 : 12

  return h(
    'button',
    {
      key: `${event.date}-${event.fullLabel}`,
      type: 'button',
      className: `events-timeline__marker events-timeline__marker--${event.lane}`,
      title: event.tooltip,
      'aria-label': event.fullLabel,
      onMouseEnter: () => onHover(event),
      onMouseLeave: onLeave,
      onFocus: () => onHover(event),
      onBlur: onLeave,
      style: {
        left: `${event.position}%`,
        '--marker-size': `${markerSize}px`,
        '--marker-color': event.tone.marker,
        '--marker-rail': event.tone.rail,
        '--marker-text': event.tone.text,
      },
    },
    h('span', {
      className: 'events-timeline__dot',
      style: {
        borderWidth: event.daysFromToday === 0 ? 3 : event.isImportant ? 2.5 : 2,
      },
    }),
    h(
      'span',
      {
        className: 'events-timeline__label',
        style: {
          fontWeight: event.isImportant ? 700 : 500,
        },
      },
      h('span', { className: 'events-timeline__label-type' }, event.formattedLabel),
      h(
        'span',
        { className: 'events-timeline__label-date' },
        `${event.dateLabel}${event.matchesHolding ? ' · 持股' : ''}`
      )
    )
  )
}

function EmptyTimelineState() {
  return h(
    Card,
    {
      style: {
        marginBottom: 10,
        padding: '18px 18px 16px',
        background: `linear-gradient(135deg, ${alpha(C.textMute, '06')} 0%, ${alpha(C.olive, '08')} 100%)`,
        border: `1px solid ${C.borderSub}`,
      },
    },
    h(
      'div',
      { style: { fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 } },
      '接下來 30 天無重大事件'
    ),
    h(
      'div',
      { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7 } },
      '清單仍保留完整事件紀錄；時間軸只顯示今天前後 30 天內的重點視窗。'
    )
  )
}

export function EventsTimeline({ events = [] }) {
  const { holdings = [] } = usePortfolioRouteContext()
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const holdingCodes = useMemo(
    () =>
      new Set(
        (Array.isArray(holdings) ? holdings : []).map((item) => String(item?.code || '').trim())
      ),
    [holdings]
  )

  const timelineEvents = useMemo(
    () => buildTimelineEvents(events, holdingCodes),
    [events, holdingCodes]
  )

  if (timelineEvents.length === 0) {
    return h(EmptyTimelineState)
  }

  return h(
    Card,
    {
      style: {
        marginBottom: 10,
        padding: '16px 16px 14px',
        background: `linear-gradient(180deg, ${alpha(C.cardBlue, '82')} 0%, ${alpha(C.bg, '96')} 100%)`,
        overflow: 'hidden',
      },
    },
    h(
      'style',
      { id: TIMELINE_STYLE_ID },
      `
.events-timeline{position:relative}
.events-timeline__header{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.events-timeline__title{font-size:12px;font-weight:700;color:${C.text};letter-spacing:.04em}
.events-timeline__sub{font-size:10px;color:${C.textSec};margin-top:3px;line-height:1.6}
.events-timeline__legend{display:flex;gap:10px;flex-wrap:wrap;font-size:9px;color:${C.textMute}}
.events-timeline__legend-item{display:inline-flex;align-items:center;gap:5px}
.events-timeline__legend-dot{width:8px;height:8px;border-radius:999px;display:inline-block}
.events-timeline__desktop{position:relative;height:180px;margin-top:14px}
.events-timeline__axis{position:absolute;left:0;right:0;top:50%;height:3px;transform:translateY(-50%);background:linear-gradient(90deg,var(--muted, ${C.textMute}) 0%,var(--muted, ${C.textMute}) 49.2%,var(--up, ${C.up}) 49.2%,var(--up, ${C.up}) 50.8%,var(--positive, ${C.up}) 50.8%,var(--positive, ${C.up}) 100%);border-radius:999px;box-shadow:inset 0 0 0 1px ${alpha(C.borderStrong, '25')}}
.events-timeline__tick{position:absolute;top:50%;width:1px;height:18px;transform:translate(-50%,-50%);background:${alpha(C.borderStrong, '60')}}
.events-timeline__tick--today{width:4px;height:34px;background:var(--up, ${C.up});border-radius:999px}
.events-timeline__tick-label{position:absolute;top:calc(50% + 18px);transform:translateX(-50%);font-size:9px;color:${C.textMute};white-space:nowrap}
.events-timeline__tick-label--today{color:var(--up, ${C.up});font-weight:700}
.events-timeline__marker{position:absolute;left:0;transform:translateX(-50%);display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:44px;min-height:44px;max-width:132px;border:none;border-radius:14px;background:transparent;padding:6px;cursor:pointer;text-align:center;color:var(--marker-text)}
.events-timeline__marker--top{top:18px}
.events-timeline__marker--bottom{bottom:20px}
.events-timeline__marker--top .events-timeline__label{margin-top:8px}
.events-timeline__marker--bottom .events-timeline__label{margin-bottom:8px;display:block}
.events-timeline__marker--bottom .events-timeline__dot{order:2}
.events-timeline__marker:focus-visible .events-timeline__dot,.events-timeline__marker:hover .events-timeline__dot{transform:scale(1.08);box-shadow:0 0 0 5px ${alpha(C.blue, '10')}}
.events-timeline__dot{display:block;width:var(--marker-size);height:var(--marker-size);border-radius:999px;background:${C.bg};border-style:solid;border-color:var(--marker-color);margin:0 auto;box-shadow:0 8px 18px var(--marker-rail);transition:transform .15s ease, box-shadow .15s ease}
.events-timeline__label{display:block;font-size:10px;line-height:1.45;color:var(--marker-text)}
.events-timeline__label-type{color:${C.text}}
.events-timeline__label-date{color:${C.textMute};font-weight:500}
.events-timeline__tooltip{margin-top:12px;padding:10px 12px;border-radius:10px;background:${alpha(C.bg, '96')};border:1px solid ${C.borderSub};font-size:10px;color:${C.textSec};line-height:1.7}
.events-timeline__tooltip-title{font-size:11px;font-weight:700;color:${C.text}}
.events-timeline__tooltip-meta{color:${C.textMute};margin-top:2px}
.events-timeline__mobile{display:none;margin-top:12px}
.events-timeline__mobile-list{display:grid;gap:8px}
.events-timeline__mobile-item{display:grid;grid-template-columns:18px 1fr;gap:12px;align-items:start;width:100%;min-height:44px;padding:12px 0;border:none;background:transparent;text-align:left;cursor:pointer}
.events-timeline__mobile-line{position:relative;width:18px;height:100%}
.events-timeline__mobile-line::before{content:"";position:absolute;left:8px;top:-12px;bottom:-12px;width:2px;background:${alpha(C.borderStrong, '24')};border-radius:999px}
.events-timeline__mobile-dot{position:absolute;left:0;top:6px;width:18px;height:18px;border-radius:999px;background:${C.bg};border:2px solid var(--marker-color)}
.events-timeline__mobile-title{font-size:11px;color:${C.text};line-height:1.5}
.events-timeline__mobile-date{font-size:9px;color:${C.textMute};margin-top:2px}
@media (max-width: 767px){
  .events-timeline__desktop{display:none}
  .events-timeline__mobile{display:block}
}
      `
    ),
    h(
      'div',
      { className: 'events-timeline' },
      h(
        'div',
        { className: 'events-timeline__header' },
        h(
          'div',
          null,
          h('div', { className: 'events-timeline__title' }, '事件時間軸'),
          h(
            'div',
            { className: 'events-timeline__sub' },
            '過去 30 天在左，未來 30 天在右；粗點代表緊急事件或目前持股相關事件。'
          )
        ),
        h(
          'div',
          { className: 'events-timeline__legend' },
          h(
            'span',
            { className: 'events-timeline__legend-item' },
            h('span', {
              className: 'events-timeline__legend-dot',
              style: { background: `var(--muted, ${C.textMute})` },
            }),
            '過去'
          ),
          h(
            'span',
            { className: 'events-timeline__legend-item' },
            h('span', {
              className: 'events-timeline__legend-dot',
              style: { background: `var(--up, ${C.up})` },
            }),
            '今天'
          ),
          h(
            'span',
            { className: 'events-timeline__legend-item' },
            h('span', {
              className: 'events-timeline__legend-dot',
              style: { background: `var(--positive, ${C.up})` },
            }),
            '未來'
          )
        )
      ),
      h(
        'div',
        { className: 'events-timeline__desktop' },
        h('div', { className: 'events-timeline__axis' }),
        [
          { left: 0, label: '過去 30 天' },
          { left: 50, label: '今天', today: true },
          { left: 100, label: '未來 30 天' },
        ].map((tick) =>
          h(
            'div',
            {
              key: tick.label,
              className: `events-timeline__tick${tick.today ? ' events-timeline__tick--today' : ''}`,
              style: { left: `${tick.left}%` },
            },
            h(
              'span',
              {
                className: `events-timeline__tick-label${tick.today ? ' events-timeline__tick-label--today' : ''}`,
              },
              tick.label
            )
          )
        ),
        timelineEvents.map((event) =>
          h(TimelineMarker, {
            key: `${event.date}-${event.fullLabel}-${event.position}`,
            event,
            onHover: setHoveredEvent,
            onLeave: () => setHoveredEvent(null),
          })
        )
      ),
      h(
        'div',
        { className: 'events-timeline__mobile' },
        h(
          'div',
          { className: 'events-timeline__mobile-list' },
          timelineEvents.map((event) =>
            h(
              'button',
              {
                key: `${event.date}-${event.fullLabel}-mobile`,
                type: 'button',
                className: 'events-timeline__mobile-item',
                title: event.tooltip,
                'aria-label': event.fullLabel,
                onClick: () => setHoveredEvent(event),
                onFocus: () => setHoveredEvent(event),
                onBlur: () => setHoveredEvent(null),
              },
              h(
                'div',
                {
                  className: 'events-timeline__mobile-line',
                  style: { '--marker-color': event.tone.marker },
                },
                h('span', { className: 'events-timeline__mobile-dot' })
              ),
              h(
                'div',
                null,
                h(
                  'div',
                  {
                    className: 'events-timeline__mobile-title',
                    style: { fontWeight: event.isImportant ? 700 : 500 },
                  },
                  event.formattedLabel
                ),
                h(
                  'div',
                  { className: 'events-timeline__mobile-date' },
                  `${event.dateLabel} · ${event.daysFromToday === 0 ? '今天' : event.daysFromToday > 0 ? `${event.daysFromToday} 天後` : `${Math.abs(event.daysFromToday)} 天前`}${event.matchesHolding ? ' · 持股' : ''}`
                )
              )
            )
          )
        )
      ),
      hoveredEvent &&
        h(
          'div',
          { className: 'events-timeline__tooltip' },
          h('div', { className: 'events-timeline__tooltip-title' }, hoveredEvent.fullLabel),
          h(
            'div',
            { className: 'events-timeline__tooltip-meta' },
            `${hoveredEvent.date} · ${hoveredEvent.formattedLabel}${hoveredEvent.matchesHolding ? ' · 目前持股' : ''}`
          ),
          h(
            'div',
            null,
            hoveredEvent.detail ||
              hoveredEvent.sub ||
              hoveredEvent.tooltip.split('\n').slice(2).join(' · ')
          )
        )
    )
  )
}
