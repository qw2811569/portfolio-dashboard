import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Card } from '../common'

const CARD_LABEL_STYLE = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 8,
}

const INVESTING_PRINCIPLES = [
  '長線思維，短線紀律。',
  '先看產業方向，再看公司執行。',
  '沒有催化的便宜，不一定會漲。',
  '看不懂的上漲先不追，等理由浮出來。',
  '部位大小要反映把握度，不是情緒。',
  '下跌先問 thesis 有沒有壞，不先問要不要砍。',
]

const DAILY_REMINDERS = [
  '持股成本高於市價時，先檢查基本面有沒有變差，再決定要不要處理。',
  '今天先看事件是否改變原本劇本，不要只盯著分時波動。',
  '沒有新的證據，就不要因為一天漲跌改整個策略。',
  '若目標價和催化都空白，先補資料，再談加碼或續抱。',
  '觀察股如果沒有新催化，維持追蹤，不急著把它變成持股。',
  '先確認市場在交易什麼敘事，再判斷股價反應是否合理。',
]

function getTaipeiDaySeed() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0)
  const month = Number(parts.find((part) => part.type === 'month')?.value || 1)
  const day = Number(parts.find((part) => part.type === 'day')?.value || 1)
  return year * 10000 + month * 100 + day
}

function PrincipleCard({ label, text }) {
  return h(
    Card,
    {
      style: {
        padding: '18px 20px',
        background: `linear-gradient(180deg, ${alpha(C.card, 'f6')}, ${alpha(C.subtle, 'fc')})`,
        minHeight: 132,
      },
    },
    h('div', { style: CARD_LABEL_STYLE }, label),
    h(
      'div',
      {
        style: {
          fontSize: 24,
          lineHeight: 1.45,
          color: C.text,
          fontFamily: 'var(--font-headline)',
          letterSpacing: '-0.01em',
        },
      },
      `“${text}”`
    )
  )
}

export function PrincipleCards() {
  const seed = getTaipeiDaySeed()
  const principle = INVESTING_PRINCIPLES[seed % INVESTING_PRINCIPLES.length]
  const reminder = DAILY_REMINDERS[seed % DAILY_REMINDERS.length]

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
        marginBottom: 8,
      },
    },
    h(PrincipleCard, { label: '心法', text: principle }),
    h(PrincipleCard, { label: '今日提醒', text: reminder })
  )
}
