import { withApiAuth } from './_lib/auth-middleware.js'
import {
  buildMorningNoteFallbackNote,
  coerceMorningNotePortfolio,
  formatMorningNoteMarketDate,
  MORNING_NOTE_FALLBACK_COPY,
  readMorningNoteSnapshot,
  resolveMorningNotePortfolioKey,
  resolveMorningNotePortfolioMeta,
} from './_lib/morning-note.js'
import { getPortfolioPolicy } from './_lib/portfolio-policy.js'
import { PortfolioAccessError, requirePortfolio } from './_lib/require-portfolio.js'

function isLocalDevRequest() {
  return !process.env.VERCEL && process.env.VERCEL_ENV !== 'production'
}

function resolveRequestedPortfolioId(req) {
  return String(req?.query?.portfolioId || req?.query?.pid || '').trim() || 'me'
}

function resolveRequestedPortfolioName(req) {
  return String(req?.query?.portfolioName || req?.query?.portfolioLabel || '').trim()
}

function resolveRequestedViewMode(req) {
  return String(req?.query?.viewMode || '').trim()
}

function resolveRequestedMarketDate(req) {
  const raw = String(req?.query?.date || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : formatMorningNoteMarketDate(new Date())
}

function buildLocalDevPortfolio(snapshotKey) {
  const meta = resolveMorningNotePortfolioMeta(snapshotKey)
  return (
    getPortfolioPolicy(meta.policyId) || {
      id: meta.policyId,
      name: meta.displayName,
      owner: meta.policyId,
      compliance_mode: meta.complianceMode,
    }
  )
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const requestedPortfolioId = resolveRequestedPortfolioId(req)
  const requestedPortfolioName = resolveRequestedPortfolioName(req)
  const requestedViewMode = resolveRequestedViewMode(req)
  const snapshotKey = resolveMorningNotePortfolioKey(requestedPortfolioId, {
    portfolioName: requestedPortfolioName,
    viewMode: requestedViewMode,
  })
  const meta = resolveMorningNotePortfolioMeta(snapshotKey, {
    portfolioName: requestedPortfolioName,
    viewMode: requestedViewMode,
  })
  const marketDate = resolveRequestedMarketDate(req)
  const displayDate = marketDate.replace(/-/g, '/')

  try {
    try {
      requirePortfolio(req, meta.policyId)
    } catch (error) {
      if (
        error instanceof PortfolioAccessError &&
        ['missing_auth_claim', 'portfolio_not_found'].includes(error.code) &&
        isLocalDevRequest()
      ) {
        buildLocalDevPortfolio(snapshotKey)
      } else if (error instanceof PortfolioAccessError) {
        return res.status(error.status).json({ error: error.message, code: error.code })
      } else {
        throw error
      }
    }

    let snapshot = null
    try {
      snapshot = await readMorningNoteSnapshot(marketDate)
    } catch (error) {
      const note = buildMorningNoteFallbackNote({
        portfolioKey: snapshotKey,
        marketDate,
        date: displayDate,
        staleStatus: 'failed',
        reason: 'snapshot_read_failed',
        message: MORNING_NOTE_FALLBACK_COPY,
        generatedAt: new Date().toISOString(),
        source: 'api-morning-note',
      })

      return res.status(200).json({
        ok: false,
        error: error?.message || 'morning note snapshot read failed',
        marketDate,
        portfolioId: snapshotKey,
        snapshotStatus: 'failed',
        note,
      })
    }

    const rawNote = snapshot?.portfolios?.[snapshotKey] || null
    const note = rawNote
      ? coerceMorningNotePortfolio(rawNote, {
          portfolioKey: snapshotKey,
          marketDate,
        })
      : buildMorningNoteFallbackNote({
          portfolioKey: snapshotKey,
          marketDate,
          date: displayDate,
          staleStatus: 'missing',
          reason: snapshot ? 'missing_portfolio_note' : 'snapshot_missing',
          message: MORNING_NOTE_FALLBACK_COPY,
          generatedAt: snapshot?.generatedAt || null,
          source: 'api-morning-note',
        })

    return res.status(200).json({
      ok: Boolean(rawNote),
      marketDate,
      portfolioId: snapshotKey,
      snapshotStatus: snapshot?.status || 'missing',
      note,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'morning note request failed',
      note: buildMorningNoteFallbackNote({
        portfolioKey: snapshotKey,
        marketDate,
        date: displayDate,
        staleStatus: 'failed',
        reason: 'api_handler_failed',
        message: MORNING_NOTE_FALLBACK_COPY,
        generatedAt: new Date().toISOString(),
        source: 'api-morning-note',
      }),
    })
  }
}

export default withApiAuth(handler)
