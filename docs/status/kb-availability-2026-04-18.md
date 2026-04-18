# KB Availability Audit · 2026-04-18

- Generated at: 2026年4月18日 晚上7:18:39 (Asia/Taipei)
- FINMIND_TOKEN source: `.env.local`
- KB files synced with `requiresData`: chip-analysis(80), fundamental-analysis(90), industry-trends(100), news-correlation(80), risk-management(40), strategy-cases(120), technical-analysis(105)
- Rules audited: 615

## Summary

| status    | count |
| --------- | ----: |
| available |   615 |

## Probe Evidence

| probe                              | available | call-method-error | evidence                                                                                       |
| ---------------------------------- | --------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| balanceSheet:quarterly-balance     | yes       | no                | 2308 balance sheet raw rows = 388                                                              |
| cashFlow:quarterly-cashflow        | yes       | no                | 2308 cash flow raw rows = 101                                                                  |
| dividend:annual-history            | yes       | no                | 2308 dividend rows = 2                                                                         |
| dividendResult:ex-date-result      | yes       | no                | 2308 dividend result rows = 2                                                                  |
| financials:quarterly-standalone    | yes       | no                | 6862 2025Q2 = standalone-monthly-verified; warnings=income-after-taxes-anomalous,eps-anomalous |
| institutional:daily-5d-trend       | yes       | no                | 6862 自 2026-04-01 起共 55 筆；repo 已接受 English participant labels                          |
| margin:daily-balance               | yes       | no                | 2308 自 2026-03-01 起共 33 筆                                                                  |
| news:rolling-14d                   | yes       | no                | 2308 news rows = 2                                                                             |
| revenue:monthly-announcement       | yes       | no                | 6862 自 2025-01-01 起共 16 筆月營收                                                            |
| revenue:quarterly-sum-from-monthly | yes       | no                | 6862 2025Q2 4-6 月營收加總 ≈ 649,030,000                                                       |
| shareholding:daily-ratio           | yes       | no                | 2308 shareholding rows = 68                                                                    |
| valuation:daily-history            | yes       | no                | 2308 自 2026-01-01 起共 66 筆                                                                  |

## Category × Status

| category:status                | count |
| ------------------------------ | ----: |
| strategy-cases:available       |   120 |
| technical-analysis:available   |   105 |
| industry-trends:available      |   100 |
| fundamental-analysis:available |    90 |
| chip-analysis:available        |    80 |
| news-correlation:available     |    80 |
| risk-management:available      |    40 |

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

- None. All audited rules are currently callable with the repo-side method/period handling.

## Representative True Missing

- None in this paid-token probe set.

## Notes

- `call-method-error` = FinMind paid token can return data, but repo-side dataset selection / period semantics / participant label mapping must be corrected to use it safely.
- `available` = current paid-token probe returned usable data without extra repair logic.
- `data-missing-from-finmind` = probe still failed or returned no usable rows.
- Revenue quarter audit follows the corrected rule: `2025Q2` means April+May+June month revenue sum, not a half-year cumulative label.
