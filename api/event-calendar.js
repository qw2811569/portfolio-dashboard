// Vercel Serverless Function — 自動事件行事曆 API
// 整合多種來源產生投資事件：
// 1. MOPS 重大訊息（法說會、股利、重訊）
// 2. 月營收公布日（每月 1-10 號）
// 3. TWSE 除權息日程
// 4. 固定行事曆（FOMC、央行、財報季）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { codes, range = '30' } = req.query
  const stockCodes = codes
    ? codes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : []
  const rangeDays = Math.min(parseInt(range) || 30, 90)

  try {
    const today = new Date()
    const events = []

    // ── 1. 月營收公布日（每月 1-10 號，所有上市櫃公司） ──
    const revenueEvents = generateRevenueAnnouncementEvents(today, rangeDays, stockCodes)
    events.push(...revenueEvents)

    // ── 2. 固定行事曆事件（FOMC、台灣央行、財報季） ──
    const fixedEvents = generateFixedCalendarEvents(today, rangeDays)
    events.push(...fixedEvents)

    // ── 3. 除權息預估（6-9 月旺季） ──
    const dividendEvents = generateDividendSeasonEvents(today, rangeDays, stockCodes)
    events.push(...dividendEvents)

    // ── 4. MOPS 法說會（嘗試從 MOPS 抓取，失敗不影響其他來源） ──
    let mopsEvents = []
    try {
      mopsEvents = await fetchMopsConferenceEvents(today, rangeDays, stockCodes, req)
    } catch (mopsError) {
      console.warn('MOPS 法說會抓取失敗（不影響其他事件）:', mopsError.message)
    }
    events.push(...mopsEvents)

    // 按日期排序
    events.sort((a, b) => a.date.localeCompare(b.date))

    return res.status(200).json({
      success: true,
      events,
      sources: [
        'revenue-calendar',
        'fixed-calendar',
        'dividend-season',
        mopsEvents.length > 0 ? 'mops' : null,
      ].filter(Boolean),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Event calendar error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// ── 月營收公布日 ──
function generateRevenueAnnouncementEvents(today, rangeDays, stockCodes) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)

  for (let d = new Date(today); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    // 每月 10 號是月營收公布截止日
    const deadline = new Date(d.getFullYear(), d.getMonth(), 10)
    if (deadline < today || deadline > endDate) continue

    const prevMonth = new Date(deadline)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const monthLabel = `${prevMonth.getFullYear()}/${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

    events.push({
      id: `rev-${deadline.toISOString().slice(0, 10)}`,
      date: deadline.toISOString().slice(0, 10),
      type: 'revenue',
      source: 'auto-calendar',
      title: `${monthLabel} 月營收公布截止`,
      detail:
        stockCodes.length > 0
          ? `關注持股：${stockCodes.join(', ')} 的 ${monthLabel} 月營收`
          : '所有上市櫃公司月營收公布截止日',
      stocks: stockCodes,
      status: 'pending',
      pred: 'neutral',
      predReason: '月營收是基本面追蹤的定期事件',
      catalystType: 'earnings',
      impact: 'medium',
    })
  }
  return events
}

// ── 固定行事曆（FOMC、央行、財報季） ──
function generateFixedCalendarEvents(today, rangeDays) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)
  const year = today.getFullYear()

  // FOMC 會議日（2026 預估）
  const fomcDates = [
    `${year}-01-29`,
    `${year}-03-19`,
    `${year}-05-07`,
    `${year}-06-18`,
    `${year}-07-30`,
    `${year}-09-17`,
    `${year}-11-05`,
    `${year}-12-17`,
  ]

  for (const dateStr of fomcDates) {
    const d = new Date(dateStr)
    if (d >= today && d <= endDate) {
      events.push({
        id: `fomc-${dateStr}`,
        date: dateStr,
        type: 'macro',
        source: 'auto-calendar',
        title: 'FOMC 利率決議',
        detail: '聯準會利率決議公布，影響全球股債市場。升息利空成長股、降息利多',
        stocks: [],
        status: 'pending',
        pred: 'neutral',
        predReason: '利率決議結果不確定',
        catalystType: 'macro',
        impact: 'high',
      })
    }
  }

  // 台灣央行理監事會議（每季：3/6/9/12 月第三週四）
  const cbcMonths = [3, 6, 9, 12]
  for (const m of cbcMonths) {
    // 第三週四：月的 15-21 日中的週四
    const firstDay = new Date(year, m - 1, 1)
    let thursdays = 0
    for (let day = 1; day <= 28; day++) {
      const d = new Date(year, m - 1, day)
      if (d.getDay() === 4) {
        thursdays++
        if (thursdays === 3) {
          const dateStr = d.toISOString().slice(0, 10)
          if (d >= today && d <= endDate) {
            events.push({
              id: `cbc-${dateStr}`,
              date: dateStr,
              type: 'macro',
              source: 'auto-calendar',
              title: '台灣央行理監事會議',
              detail: '決定利率與選擇性信用管制。升息利多金融、利空營建；降息反向',
              stocks: [],
              status: 'pending',
              pred: 'neutral',
              predReason: '利率決議結果不確定',
              catalystType: 'macro',
              impact: 'high',
            })
          }
          break
        }
      }
    }
  }

  // 台股財報季（Q1:5/15、Q2:8/14、Q3:11/14、年報:3/31）
  const earningsDates = [
    { date: `${year}-03-31`, label: `${year - 1} 年報公布截止` },
    { date: `${year}-05-15`, label: `${year} Q1 季報公布截止` },
    { date: `${year}-08-14`, label: `${year} Q2 半年報公布截止` },
    { date: `${year}-11-14`, label: `${year} Q3 季報公布截止` },
  ]

  for (const item of earningsDates) {
    const d = new Date(item.date)
    if (d >= today && d <= endDate) {
      events.push({
        id: `earnings-${item.date}`,
        date: item.date,
        type: 'earnings',
        source: 'auto-calendar',
        title: item.label,
        detail: '財報公布截止日，關注持股財報是否優於預期',
        stocks: [],
        status: 'pending',
        pred: 'neutral',
        predReason: '財報季定期事件',
        catalystType: 'earnings',
        impact: 'high',
      })
    }
  }

  return events
}

// ── 除權息旺季提醒 ──
function generateDividendSeasonEvents(today, rangeDays, stockCodes) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)
  const year = today.getFullYear()

  // 除權息旺季 7-8 月提醒
  const divStart = new Date(year, 6, 1) // 7月1日
  if (divStart >= today && divStart <= endDate) {
    events.push({
      id: `div-season-${year}`,
      date: divStart.toISOString().slice(0, 10),
      type: 'dividend',
      source: 'auto-calendar',
      title: `${year} 除權息旺季開始`,
      detail:
        stockCodes.length > 0
          ? `關注持股 ${stockCodes.join(', ')} 的除權息日程與填息機率`
          : '7-8 月為台股除權息旺季，留意高股息股填息表現',
      stocks: stockCodes,
      status: 'pending',
      pred: 'neutral',
      predReason: '除權息旺季，需個別評估填息機率',
      catalystType: 'dividend',
      impact: 'medium',
    })
  }
  return events
}

// ── MOPS 法說會事件 ──
async function fetchMopsConferenceEvents(today, rangeDays, stockCodes, req) {
  if (stockCodes.length === 0) return []

  const events = []
  const todayStr = formatDate(today)

  // 只查近 7 天的 MOPS（避免過多請求）
  const checkDays = Math.min(rangeDays, 7)
  for (let i = 0; i < checkDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = formatDate(d)

    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      const host = req.headers.host || '127.0.0.1:3002'
      const mopsUrl = `${protocol}://${host}/api/mops-announcements?date=${dateStr}`
      const mopsRes = await fetch(mopsUrl)
      if (!mopsRes.ok) continue

      const mopsData = await mopsRes.json()
      const announcements = mopsData.announcements || []

      // 篩選持股相關的法說會公告
      const relevant = announcements.filter(
        (a) => a.type === 'conference' && (stockCodes.length === 0 || stockCodes.includes(a.code))
      )

      for (const ann of relevant) {
        events.push({
          id: `mops-conf-${ann.code}-${dateStr}`,
          date: d.toISOString().slice(0, 10),
          type: 'conference',
          source: 'mops',
          title: `${ann.name}(${ann.code}) 法說會`,
          detail: ann.title,
          stocks: [ann.code],
          status: 'pending',
          pred: 'neutral',
          predReason: '法說會結果待觀察',
          catalystType: 'conference',
          impact: 'high',
        })
      }
    } catch {
      // Skip failed dates silently
    }
  }
  return events
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
