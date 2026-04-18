import { get } from '@vercel/blob'
import { withApiAuth } from './_lib/auth-middleware.js'
import { getPrivateBlobToken } from './_lib/blob-tokens.js'
import { verifySignedBlobReadQuery } from './_lib/signed-url.js'

function getBlobToken() {
  return getPrivateBlobToken()
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const verification = verifySignedBlobReadQuery(req.query || {})
  if (!verification.ok) {
    return res.status(401).json({ error: verification.error })
  }

  const token = getBlobToken()
  if (!token) {
    return res.status(500).json({ error: 'blob token not configured' })
  }

  try {
    const blobResult = await get(verification.pathname, {
      access: 'private',
      token,
      useCache: false,
    })

    if (!blobResult) {
      return res.status(404).json({ error: 'blob not found' })
    }

    const { stream, headers, blob } = blobResult
    res.setHeader('Cache-Control', 'private, max-age=0, no-store')
    res.setHeader(
      'Content-Type',
      blob?.contentType || headers.get('content-type') || 'application/octet-stream'
    )
    const contentDisposition = blob?.contentDisposition || headers.get('content-disposition')
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition)
    }
    const etag = blob?.etag || headers.get('etag')
    if (etag) {
      res.setHeader('ETag', etag)
    }

    const buffer = Buffer.from(await new Response(stream).arrayBuffer())
    return res.status(200).end(buffer)
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'blob read failed' })
  }
}

export default withApiAuth(handler, { allowAnonymous: true })
