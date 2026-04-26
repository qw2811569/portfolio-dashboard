// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import pdfMakeModule from 'pdfmake/build/pdfmake.js'
import vfsModule from 'pdfmake/build/vfs_fonts.js'
import {
  buildWeeklyPdfData,
  buildWeeklyPdfDefinition,
  registerPdfMakeCjkFonts,
} from '../../src/lib/weeklyPdfBuilder.js'

function fontArrayBuffer(fileName) {
  const bytes = readFileSync(resolve(process.cwd(), 'public/fonts', fileName))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function getPdfBuffer(pdfDocument) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(Buffer.from(value))
    }

    try {
      const maybePromise = pdfDocument.getBuffer(finish)
      if (maybePromise?.then) maybePromise.then(finish, reject)
    } catch (error) {
      reject(error)
    }
  })
}

function decodePdfStreams(buffer) {
  const text = buffer.toString('latin1')
  const streams = []
  let cursor = 0

  while ((cursor = text.indexOf('stream', cursor)) !== -1) {
    let start = cursor + 'stream'.length
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2
    else if (buffer[start] === 0x0a) start += 1

    const end = text.indexOf('endstream', start)
    if (end === -1) break

    let stream = buffer.subarray(start, end)
    if (stream.at(-1) === 0x0a) stream = stream.subarray(0, -1)
    if (stream.at(-1) === 0x0d) stream = stream.subarray(0, -1)

    try {
      streams.push(inflateSync(stream))
    } catch {
      streams.push(stream)
    }
    cursor = end + 'endstream'.length
  }

  return streams
}

describe('lib/weeklyPdfBuilder runtime', () => {
  it('renders a real PDF buffer with embedded SourceHanSansTC CJK fonts', async () => {
    const pdfMake = pdfMakeModule.default || pdfMakeModule
    const builtInVfs = (vfsModule.default || vfsModule).vfs || vfsModule.default || vfsModule
    if (typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(builtInVfs)
    }
    pdfMake.vfs = { ...(pdfMake.vfs || {}), ...builtInVfs }

    const mockFetch = vi.fn(async (url) => {
      const fileName = String(url).split('/').pop()
      return {
        ok: true,
        arrayBuffer: async () => fontArrayBuffer(fileName),
      }
    })

    await registerPdfMakeCjkFonts(pdfMake, { fetchImpl: mockFetch })

    const definition = buildWeeklyPdfDefinition(
      buildWeeklyPdfData({
        portfolioName: '中文組合',
        holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
        totalVal: 950,
        totalPnl: 50,
        retPct: 5.56,
        now: new Date('2026-04-26T00:00:00.000Z'),
      })
    )
    const buffer = await getPdfBuffer(pdfMake.createPdf(definition))
    const pdfText = buffer.toString('latin1')

    expect(mockFetch).toHaveBeenCalledWith('/fonts/SourceHanSansTC-Regular.woff2')
    expect(mockFetch).toHaveBeenCalledWith('/fonts/SourceHanSansTC-Bold.woff2')
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(5000)
    expect(pdfText).toContain('SourceHanSansTC')
    expect(pdfText).toContain('/CIDSystemInfo')
    const taijidianBytes = Buffer.from([0x53, 0xf0, 0x7a, 0x4d, 0x96, 0xfb])
    const decodedStreamText = Buffer.concat(decodePdfStreams(buffer)).toString('latin1')
    const taijidianCMapMatch = decodedStreamText.match(/<53f0>\s+<7a4d>\s+<96fb>/i)
    const embeddedTaijidianBytes = Buffer.from(
      taijidianCMapMatch?.[0].match(/[0-9a-f]{4}/gi).join('') || '',
      'hex'
    )
    expect(embeddedTaijidianBytes.equals(taijidianBytes)).toBe(true)
  })
})
