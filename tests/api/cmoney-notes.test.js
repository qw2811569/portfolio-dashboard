import { describe, expect, it } from 'vitest'

import {
  extractCmoneyArticles,
  filterCmoneyArticles,
  parseCmoneyArticle,
} from '../../api/cmoney-notes.js'

describe('api/cmoney-notes', () => {
  it('extracts note urls from notedatalist and filters by code/name', () => {
    const html = `
      <script>
        var notedatalist = [
          ["https://www.cmoney.tw/notes/note-detail.aspx?nid=1","1：【04/15券商評等報告彙整】昇達科(3491) 今日僅1家券商發布績效評等報告，評價為看多，目標價為980元。"],
          ["https://www.cmoney.tw/notes/note-detail.aspx?nid=2","2：【04/15券商評等報告彙整】台積電(2330) 今日僅1家券商發布績效評等報告，評價為看多，目標價為1200元。"]
        ] || [];
      </script>
    `

    const articles = extractCmoneyArticles(html)
    expect(articles).toHaveLength(2)
    expect(filterCmoneyArticles(articles, { code: '3491', name: '昇達科' })).toEqual([
      {
        url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=1',
        title:
          '【04/15券商評等報告彙整】昇達科(3491) 今日僅1家券商發布績效評等報告，評價為看多，目標價為980元。',
      },
    ])
  })

  it('parses a single-firm article into a structured report', () => {
    const html = `
      <meta property="article:published_time" content="2026-04-15T18:50:03+08:00" />
      <div class="pt-bar-title pt-bar-title__ui">
        <h1 class="twoline-ellipsis">【04/15券商評等報告彙整】昇達科(3491) 今日僅1家券商發布績效評等報告，評價為看多，目標價為980元。</h1>
      </div>
      <div itemprop="articleBody" class="rec-content articleBody__font ">
        <p>昇達科(3491)今日僅元大投顧發布績效評等報告，評價為看多，目標價為980元。<br>預估 2026年度營收約100億元。</p>
        <div id='info-useful' class='info-useful'></div>
      </div>
    `

    expect(
      parseCmoneyArticle(html, {
        title:
          '【04/15券商評等報告彙整】昇達科(3491) 今日僅1家券商發布績效評等報告，評價為看多，目標價為980元。',
        url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=123',
      })
    ).toEqual({
      reports: [
        {
          firm: '元大投顧',
          target: 980,
          date: '2026-04-15',
          stance: 'buy',
          source_url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=123',
          evidence: '昇達科(3491)今日僅元大投顧發布績效評等報告，評價為看多，目標價為980元。',
        },
      ],
      aggregate: null,
      meta: {
        title:
          '【04/15券商評等報告彙整】昇達科(3491) 今日僅1家券商發布績效評等報告，評價為看多，目標價為980元。',
        publishedAt: '2026-04-15',
        url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=123',
      },
    })
  })

  it('falls back to aggregate when an article only exposes range consensus', () => {
    const html = `
      <meta property="article:published_time" content="2026-04-15T18:50:03+08:00" />
      <div class="pt-bar-title pt-bar-title__ui">
        <h1 class="twoline-ellipsis">【04/15券商評等報告彙整】大成(1210) 今日有2家券商發布績效評等報告，目標價區間為57.3～64元。</h1>
      </div>
      <div itemprop="articleBody" class="rec-content articleBody__font ">
        <p>大成(1210)今日有2家券商發布績效評等報告，其中有1家評等為買進、1家評等為中立，目標價區間為57.3～64元。</p>
        <div id='info-useful' class='info-useful'></div>
      </div>
    `

    expect(
      parseCmoneyArticle(html, {
        title:
          '【04/15券商評等報告彙整】大成(1210) 今日有2家券商發布績效評等報告，目標價區間為57.3～64元。',
        url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=456',
      })
    ).toEqual({
      reports: [],
      aggregate: {
        firms: [],
        firmsCount: 2,
        medianTarget: 60.65,
        min: 57.3,
        max: 64,
        date: '2026-04-15',
        source_article_url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=456',
        evidence:
          '大成(1210)今日有2家券商發布績效評等報告，其中有1家評等為買進、1家評等為中立，目標價區間為57.3～64元。',
      },
      meta: {
        title:
          '【04/15券商評等報告彙整】大成(1210) 今日有2家券商發布績效評等報告，目標價區間為57.3～64元。',
        publishedAt: '2026-04-15',
        url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=456',
      },
    })
  })
})
