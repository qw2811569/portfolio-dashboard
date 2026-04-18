import { requireDashboardAuth } from '../../_lib/dashboard-auth.js'
import { handlePendingDecisionAnswer } from '../../_lib/pending-decisions-handler.js'

export default requireDashboardAuth(async function handler(req, res) {
  const id = req?.query?.id
  return handlePendingDecisionAnswer(req, res, Array.isArray(id) ? id[0] : id)
})
