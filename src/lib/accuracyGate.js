import { isInsiderPortfolio } from './tradeAiResponse.js'

export const ACCURACY_GATE_MARKER = '【Accuracy Gate】'

export function buildAccuracyGatePrompt({
  portfolio = null,
  sourceLabel = 'dossier / tradeLog / events / target reports',
  confidenceThreshold = 0.7,
} = {}) {
  return `${ACCURACY_GATE_MARKER}
- 只可引用已提供或可驗證的資料；若引用事實，至少點出 ticker、日期與 source/url，缺一就明講資料不足。
- 所有數字必須與 ${sourceLabel} 對齊；不得自行補數、改寫或移花接木。
- 若信心度 < ${confidenceThreshold}，必須明示「AI 不確定」，並取消 buy/sell / action hint / 強結論。
- ${isInsiderPortfolio(portfolio) ? '目前組合是公司代表 / 合規模式，只能輸出風險摘要與待驗證事項，不得給買賣建議。' : '若輸入標示為公司代表 / 合規模式，立刻改為風險摘要，不得給買賣建議。'}
- 回答前先自我檢查：有引用資料？有具體 ticker？有日期？有來源？若沒有，就降級成 text-only / risk-only。`
}

export function applyAccuracyGatePrompt(prompt, options = {}) {
  const text = String(prompt || '').trim()
  if (text.includes(ACCURACY_GATE_MARKER)) return text
  const gate = buildAccuracyGatePrompt(options)
  return text ? `${text}\n\n${gate}` : gate
}
