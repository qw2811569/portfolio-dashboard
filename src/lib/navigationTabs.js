export function buildPortfolioTabs({
  urgentCount = 0,
  analyzing = false,
  researching = false,
} = {}) {
  return [
    { k: 'holdings', label: '持倉' },
    { k: 'watchlist', label: '觀察股' },
    { k: 'events', label: `事件${urgentCount > 0 ? ' ·' : ''}` },
    { k: 'news', label: '新聞追蹤' },
    { k: 'daily', label: analyzing ? '分析中...' : '收盤分析' },
    { k: 'research', label: researching ? '研究中...' : '深度研究' },
    { k: 'trade', label: '上傳成交' },
    { k: 'log', label: '交易日誌' },
  ]
}

/**
 * Grouped tabs for App.routes.jsx — 4 main tabs with sub-navigation.
 *
 * Structure:
 *   總覽 | 持倉(持股+觀察股) | 研究(分析+事件+新聞+深度研究) | 記帳(成交+日誌)
 */
export function buildGroupedPortfolioTabs({
  urgentCount = 0,
  analyzing = false,
  researching = false,
} = {}) {
  return [
    { k: 'overview', label: '總覽' },
    {
      k: 'holdings',
      label: '持倉',
      sub: [
        { k: 'holdings', label: '持股' },
        { k: 'watchlist', label: '觀察股' },
      ],
    },
    {
      k: 'research',
      label: '研究',
      sub: [
        { k: 'daily', label: analyzing ? '分析中...' : '收盤分析' },
        { k: 'research', label: researching ? '研究中...' : '深度研究' },
        { k: 'events', label: `事件${urgentCount > 0 ? ' ·' : ''}` },
        { k: 'news', label: '新聞追蹤' },
      ],
    },
    {
      k: 'trade',
      label: '記帳',
      sub: [
        { k: 'trade', label: '上傳成交' },
        { k: 'log', label: '交易日誌' },
      ],
    },
  ]
}
