# KB Availability Audit · 2026-04-18

- Generated at: 2026年4月18日 中午12:51:52 (Asia/Taipei)
- FINMIND_TOKEN source: `.env.local`
- KB files synced with `requiresData`: chip-analysis(80), fundamental-analysis(90), industry-trends(100), news-correlation(80), risk-management(40), strategy-cases(120), technical-analysis(105)
- Rules audited: 615

## Summary

| status            | count |
| ----------------- | ----: |
| call-method-error |   319 |
| available         |   296 |

## Probe Evidence

| probe                              | available | call-method-error | evidence                                                                                       |
| ---------------------------------- | --------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| balanceSheet:quarterly-balance     | yes       | no                | 2308 balance sheet raw rows = 388                                                              |
| cashFlow:quarterly-cashflow        | yes       | no                | 2308 cash flow raw rows = 101                                                                  |
| dividend:annual-history            | yes       | no                | 2308 dividend rows = 2                                                                         |
| dividendResult:ex-date-result      | yes       | no                | 2308 dividend result rows = 2                                                                  |
| financials:quarterly-standalone    | yes       | yes               | 6862 2025Q2 = standalone-monthly-verified; warnings=income-after-taxes-anomalous,eps-anomalous |
| institutional:daily-5d-trend       | yes       | yes               | 6862 自 2026-04-01 起共 55 筆，包含 English participant labels                                 |
| margin:daily-balance               | yes       | no                | 2308 自 2026-03-01 起共 33 筆                                                                  |
| news:rolling-14d                   | yes       | no                | 2308 news rows = 2                                                                             |
| revenue:monthly-announcement       | yes       | no                | 6862 自 2025-01-01 起共 16 筆月營收                                                            |
| revenue:quarterly-sum-from-monthly | yes       | yes               | 6862 2025Q2 需用 4-6 月營收加總 ≈ 649,030,000                                                  |
| shareholding:daily-ratio           | yes       | no                | 2308 shareholding rows = 68                                                                    |
| valuation:daily-history            | yes       | no                | 2308 自 2026-01-01 起共 66 筆                                                                  |

## Category × Status

| category:status                        | count |
| -------------------------------------- | ----: |
| fundamental-analysis:call-method-error |    90 |
| technical-analysis:available           |    86 |
| chip-analysis:call-method-error        |    80 |
| strategy-cases:available               |    64 |
| industry-trends:available              |    62 |
| strategy-cases:call-method-error       |    56 |
| news-correlation:available             |    52 |
| industry-trends:call-method-error      |    38 |
| risk-management:available              |    32 |
| news-correlation:call-method-error     |    28 |
| technical-analysis:call-method-error   |    19 |
| risk-management:call-method-error      |     8 |

## Requirement Footprint

| requirement                        | count |
| ---------------------------------- | ----: |
| financials:quarterly-standalone    |   189 |
| institutional:daily-5d-trend       |   126 |
| news:rolling-14d                   |   104 |
| revenue:monthly-announcement       |    73 |
| balanceSheet:quarterly-balance     |    48 |
| valuation:daily-history            |    46 |
| margin:daily-balance               |    38 |
| dividend:annual-history            |    29 |
| revenue:quarterly-sum-from-monthly |    24 |
| shareholding:daily-ratio           |    21 |
| cashFlow:quarterly-cashflow        |    15 |
| dividendResult:ex-date-result      |    12 |

## Representative Call-Method Errors

- ca-001 · 外資連續買超追蹤 — institutional/daily-5d-trend · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-002 · 投信作帳行情 — institutional/daily-5d-trend, financials/quarterly-standalone · 上游有資料，但 repo 需做 institutional:daily-5d-trend, financials:quarterly-standalone 修正才能正確使用
- ca-003 · 主力進場特徵 — institutional/daily-5d-trend, margin/daily-balance, shareholding/daily-ratio · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-004 · 主力出貨特徵 — institutional/daily-5d-trend, margin/daily-balance, shareholding/daily-ratio · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-005 · 融資大幅增加警訊 — institutional/daily-5d-trend, margin/daily-balance · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-006 · 籌碼集中度 — institutional/daily-5d-trend, shareholding/daily-ratio · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-007 · 三大法人共識度 — institutional/daily-5d-trend · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-008 · 借券賣出訊號 — institutional/daily-5d-trend · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-009 · 董監持股變化 — institutional/daily-5d-trend · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-010 · 外資期貨未平倉 — institutional/daily-5d-trend · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-011 · 融資餘額趨勢 — institutional/daily-5d-trend, margin/daily-balance · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用
- ca-012 · 融券餘額趨勢 — institutional/daily-5d-trend, margin/daily-balance · 上游有資料，但 repo 需做 institutional:daily-5d-trend 修正才能正確使用

## Representative True Missing

- None in this paid-token probe set; current gaps are dominated by repo-side call method / interpretation issues.

## Notes

- `call-method-error` = FinMind paid token can return data, but repo-side dataset selection / period semantics / participant label mapping must be corrected to use it safely.
- `available` = current paid-token probe returned usable data without extra repair logic.
- `data-missing-from-finmind` = probe still failed or returned no usable rows.
- Revenue quarter audit follows the corrected rule: `2025Q2` means April+May+June month revenue sum, not a half-year cumulative label.
