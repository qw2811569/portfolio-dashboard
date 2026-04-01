function parseSseChunk(chunk = '') {
  const text = String(chunk || '').trim()
  if (!text) return null

  let event = 'message'
  const dataLines = []

  for (const line of text.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (dataLines.length === 0) return null

  const rawData = dataLines.join('\n')
  try {
    return {
      event,
      data: JSON.parse(rawData),
    }
  } catch {
    return {
      event,
      data: rawData,
    }
  }
}

export async function readEventStream(response, { onEvent = async () => {} } = {}) {
  if (!response?.body?.getReader) {
    throw new Error('Streaming response body unavailable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        const parsed = parseSseChunk(chunk)
        if (parsed) {
          await onEvent(parsed.event, parsed.data)
        }
      }

      if (done) break
    }

    const tail = parseSseChunk(buffer)
    if (tail) {
      await onEvent(tail.event, tail.data)
    }
  } finally {
    reader.releaseLock?.()
  }
}
