import { describe, expect, it } from 'vitest'
import { readEventStream } from '../../src/lib/eventStream.js'

function createStreamResponse(chunks) {
  const encoder = new TextEncoder()
  return {
    body: new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
        controller.close()
      },
    }),
  }
}

describe('lib/eventStream', () => {
  it('parses SSE events and JSON payloads across multiple chunks', async () => {
    const events = []
    const response = createStreamResponse([
      'event: meta\ndata: {"id":"msg_1","model":"claude"}\n\n',
      'event: delta\ndata: {"text":"你好"}\n\nevent: delta\n',
      'data: {"text":"，世界"}\n\n',
      'event: done\ndata: {"text":"你好，世界"}\n\n',
    ])

    await readEventStream(response, {
      onEvent: (event, data) => {
        events.push({ event, data })
      },
    })

    expect(events).toEqual([
      { event: 'meta', data: { id: 'msg_1', model: 'claude' } },
      { event: 'delta', data: { text: '你好' } },
      { event: 'delta', data: { text: '，世界' } },
      { event: 'done', data: { text: '你好，世界' } },
    ])
  })
})
