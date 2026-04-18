import { withApiAuth } from './_lib/auth-middleware.js'
import { PortfolioAccessError, requirePortfolio } from './_lib/require-portfolio.js'
// Vercel Serverless Function — AI 收盤策略分析
// API Key 安全地存在後端，前端不會暴露
import { callAiRaw, callAiRawStream, ensureAiConfigured } from './_lib/ai-provider.js'
import { stripBuySellForInsider } from '../src/lib/tradeAiResponse.js'

function wantsStreamingResponse(req) {
  return String(req?.query?.stream || '').trim() === '1'
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let portfolio = null
  try {
    portfolio = requirePortfolio(req, req.body?.portfolioId, { allowMissing: true })
  } catch (error) {
    if (error instanceof PortfolioAccessError) {
      return res.status(error.status).json({ error: error.message, code: error.code })
    }
    throw error
  }

  try {
    ensureAiConfigured()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  try {
    const stream = wantsStreamingResponse(req)
    const { systemPrompt, userPrompt, maxTokens = 2200, allowThinking = false } = req.body || {}
    const decoratedSystemPrompt = stripBuySellForInsider(systemPrompt, portfolio)
    const decoratedUserPrompt = stripBuySellForInsider(userPrompt, portfolio)

    if (!decoratedUserPrompt) {
      return res.status(400).json({
        error: 'userPrompt is required',
        detail: 'The request body must include a non-empty userPrompt field',
      })
    }

    if (stream) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      let fullText = ''
      const upstream = await callAiRawStream({
        system: decoratedSystemPrompt,
        maxTokens,
        allowThinking,
        messages: [{ role: 'user', content: decoratedUserPrompt }],
      })

      try {
        for await (const event of upstream) {
          if (event?.type === 'message-start') {
            writeSseEvent(res, 'meta', {
              id: event?.message?.id || '',
              model: event?.message?.model || '',
              role: event?.message?.role || 'assistant',
            })
            continue
          }

          if (event?.type === 'text-delta' && event.text) {
            fullText += event.text
            writeSseEvent(res, 'delta', { text: event.text })
          }
        }

        writeSseEvent(res, 'done', { text: fullText })
      } catch (streamError) {
        writeSseEvent(res, 'error', {
          error: 'AI 串流分析失敗',
          detail: streamError?.message || 'unknown error',
        })
      }

      return res.end()
    }

    const data = await callAiRaw({
      system: decoratedSystemPrompt,
      maxTokens,
      allowThinking,
      messages: [{ role: 'user', content: decoratedUserPrompt }],
    })
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: 'AI 分析失敗', detail: err.message })
  }
}

export default withApiAuth(handler)
