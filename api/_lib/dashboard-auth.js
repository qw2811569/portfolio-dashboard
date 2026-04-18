import { withApiAuth } from './auth-middleware.js'

export function requireDashboardAuth(handler, options = {}) {
  return withApiAuth(handler, {
    allowCrossOrigin: true,
    ...options,
  })
}
