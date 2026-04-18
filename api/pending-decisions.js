import { requireDashboardAuth } from './_lib/dashboard-auth.js'
import { handlePendingDecisionsList } from './_lib/pending-decisions-handler.js'

export default requireDashboardAuth(async function handler(req, res) {
  return handlePendingDecisionsList(req, res)
})
