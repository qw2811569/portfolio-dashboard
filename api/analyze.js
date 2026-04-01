// Vercel Serverless Function — AI 收盤策略分析
// API Key 安全地存在後端，前端不會暴露
import { callAiRaw, callAiRawStream, ensureAiConfigured } from './_lib/ai-provider.js'

function wantsStreamingResponse(req) {
  return String(req?.query?.stream || '').trim() === '1'
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    ensureAiConfigured()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  try {
    const stream = wantsStreamingResponse(req)
    const {
      systemPrompt,
      userPrompt,
      maxTokens = 2200,
      allowThinking = false,
    } = req.body || {}

    if (stream) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      let fullText = ''
      const upstream = await callAiRawStream({
        system: systemPrompt,
        maxTokens,
        allowThinking,
        messages: [{ role: 'user', content: userPrompt }],
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
      system: systemPrompt,
      maxTokens,
      allowThinking,
      messages: [{ role: 'user', content: userPrompt }],
    })
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: 'AI 分析失敗', detail: err.message })
  }
}
