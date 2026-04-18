import { withApiAuth } from './_lib/auth-middleware.js'
function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({
    hasToken: Boolean(process.env.BRIDGE_AUTH_TOKEN),
    hasBaseUrl: Boolean(process.env.BRIDGE_BASE_URL),
  })
}

export default withApiAuth(handler, { allowAnonymous: true, allowCrossOrigin: true })
