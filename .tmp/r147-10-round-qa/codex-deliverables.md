## Codex 交付清單

- #6 + #12 · commit `ebab327` · files [`src/hooks/usePortfolioPersistence.js`, `src/components/research/ResearchPanel.jsx`, `src/hooks/usePortfolioBootstrap.js`, `src/hooks/usePortfolioSnapshotRuntime.js`, `src/hooks/useAppRuntimeState.js`, `src/hooks/useAppRuntimeArgs.js`, `src/hooks/useAppRuntimeComposer.boot.js`, `src/hooks/useAppRuntimeComposer.panels.js`, `src/hooks/useAppRuntimeCoreLifecycle.js`, `src/hooks/useAppRuntimeWorkflows.js`, `tests/components/researchPanel.test.jsx`, `tests/hooks/useAppRuntimeState.test.jsx`]
- #7 · commit `1cae66b` · files [`src/components/Header.jsx`, `tests/components/Header.test.jsx`]
- #11 · commit `c21de65` · files [`src/hooks/useWatchlistStorageSync.js`, `src/lib/watchlistSync.js`, `src/lib/portfolioUtils.js`, `src/hooks/usePortfolioPersistence.js`, `src/hooks/useRoutePortfolioRuntime.js`, `src/hooks/useAppRuntimeCoreLifecycle.js`, `tests/hooks/useWatchlistStorageSync.test.jsx`, `tests/hooks/usePortfolioPersistence.test.jsx`]
- #13 · commit `ba9abf1` · files [`src/components/overview/HoldingsRing.jsx`, `tests/components/holdingsRing.test.jsx`]

## 給 Claude 的 review hint

- 我覺得這 5 件的 risk:
  - #6 + #12 目前把 `researchHistoryStatus.status === 'error'` 視為獨立 error UI；若別處還假設 `researchHistory === null` 代表 empty，可能有漏接的 render 分支。
  - #7 的 compact-landscape 判定用 `(max-height: 500px) and (orientation: landscape)`；如果某些 Android 裝置高度略高於 500px，header 可能仍偏高但不會進入折疊模式。
  - #11 我採 `BroadcastChannel + storage + focus/visibility revalidate` 混合方案，重點風險是 route shell 跟 app runtime 兩邊都會收到同步事件，所以我額外做了 storage-equality guard 來避免 echo loop。
  - #13 修在 `HoldingsRing` 上，因為 QA evidence 指向 dashboard 的 Recharts SVG focus sink；如果別的 Recharts surface 也開著 accessibility layer，可能還要另外掃一次。
- 我擔心邊界 case:
  - research API 若回 200 但 payload shape 壞掉，現在會落到 `error` status；可再確認這比舊的 silent fallback 更符合產品預期。
  - empty state 目前維持原本「明早 06:00 會自動更新」copy，只在真正 `success && []` 時出現；如果產品想避免任何「等明早」承諾，這段 copy 應該整體改寫。
  - multi-tab sync 在不支援 `BroadcastChannel` 的瀏覽器會退回 `storage` 事件；同 tab 不會靠 `storage` 自己通知自己，這部分是靠既有 local state mutation 立即更新。

## 補充

- full-suite guard commit `31260dc` · test-only · files [`tests/hooks/usePortfolioSnapshotRuntime.test.jsx`, `tests/hooks/usePortfolioBootstrap.test.jsx`]
