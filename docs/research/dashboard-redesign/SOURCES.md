# Dashboard Redesign · 推薦資料源（Claude + Codex 都讀這份）

**主入口**：[`./INDEX.md`](./INDEX.md) ｜ **任務脈絡**：[`./MISSION.md`](./MISSION.md) ｜ **抓取工具**：[`./TOOLS.md`](./TOOLS.md)

每個 site 標**爬不爬得到**（公開 / 需登入 / WAF）+ **適合解什麼 mission 原則**。Round 1+ 依此清單系統性深爬。

---

## A. 看「真實 app 互動 flow」（**台灣最缺 · 用戶最痛**）

| 站                | URL                    | 公開？            | 適合 mission 哪條                     | 備註                                                             |
| ----------------- | ---------------------- | ----------------- | ------------------------------------- | ---------------------------------------------------------------- |
| **Mobbin**        | https://mobbin.com     | 部分免費 + 需登入 | #1 Zero-click · #2 漸進披露 · #5 互動 | live app 完整 flow；月付 $39；先用免費搜「dashboard」「fintech」 |
| **Pageflows**     | https://pageflows.com  | 部分免費 + 需登入 | #5 動效 / 互動                        | 直接看互動**錄影**                                               |
| **Refero.design** | https://refero.design  | 公開              | #2 漸進披露 pattern                   | 反查「filter / search / settings」等切換情境怎麼設計             |
| **Screenlane**    | https://screenlane.com | 公開              | #3 教學引導 · #5 互動                 | onboarding / payment / settings 等 trigger event 截圖            |

## B. 看「真實寫了 code 的互動」（**美感 + 動效 best 範例**）

| 站             | URL                                | 公開？ | 適合 mission 哪條     | 備註                                                  |
| -------------- | ---------------------------------- | ------ | --------------------- | ----------------------------------------------------- |
| **Awwwards**   | https://www.awwwards.com/websites/ | 公開   | #4 美感 · #5 動效     | Site of the Day + Honors 是金礦；real-life 上線網站   |
| **Codrops**    | https://tympanus.net/codrops/      | 公開   | #5 動效 · #2 漸進披露 | 每篇文章附**可運行 demo + source code**               |
| **CodePen.io** | https://codepen.io/trending        | 公開   | #5 動效               | 單一 component 動效 trending                          |
| **Httpster**   | https://httpster.net               | 公開   | #4 美感               | curated 上線網站，比 awwwards 更日常                  |
| **Land-book**  | https://land-book.com              | 公開   | #4 美感 · #5 互動細節 | landing page 為主但 hover state / scroll trigger 用心 |

## C. 靜態靈感 + 高品質 curate（**已用 + 補強**）

| 站                                 | URL                                                                       | 已用？  | 適合 mission 哪條 | 備註                                                             |
| ---------------------------------- | ------------------------------------------------------------------------- | ------- | ----------------- | ---------------------------------------------------------------- |
| Dribbble · RonDesignLab            | https://dribbble.com/RonDesignLab                                         | ✅      | #1 ~ #4 全        | Refs 01/07-10 + muz.li 11/39 都來自他；**深爬 portfolio top 20** |
| Dribbble · Outcrowd                | https://dribbble.com/outcrowd                                             | 部分    | #1 #4             | muz.li 出 2 次；金融 SaaS 主力                                   |
| Dribbble · Geex Arts               | https://dribbble.com/GeexArts                                             | 部分    | #4                | muz.li 出 3 次；一致 brand                                       |
| Dribbble · OWWStudio               | https://dribbble.com/OWWStudio                                            | 部分    | #1 #2             | muz.li 出 4 次                                                   |
| Dribbble · Ronas IT                | https://dribbble.com/ronasit                                              | ✅(13)  | #1 #2 #4          | 投資 portfolio 同 domain                                         |
| Dribbble · Purrweb                 | https://dribbble.com/purrwebui                                            | 部分    | #2 #4             | muz.li 出 2 次（mobile 金融）                                    |
| **Behance** 全站（依 designer 看） | https://www.behance.net/galleries/ui-ux                                   | 部分    | 完整 case study   | Ref 16 Startify 模板極佳；可挖更多 SaaS analytics                |
| **Muz.li 2024**                    | https://muz.li/blog/dashboard-design-inspirations-in-2024/                | ✅(15)  | curate            | Ref 15 已落                                                      |
| **Muz.li 2026 升級版**             | https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/ | ⚠️ 待   | curate            | Round 1 必爬 — 比對 1 年趨勢位移                                 |
| Cosmos.so                          | https://www.cosmos.so                                                     | ⚠️ 部分 | #4                | 設計師個人 board curate                                          |
| Savee.it                           | https://savee.it                                                          | ⚠️ 部分 | #5                | 動畫 / loop 多                                                   |
| SiteInspire                        | https://www.siteinspire.com                                               | 公開    | #4                | 純 web design archive                                            |

## D. dashboard / SaaS 專屬

| 站              | URL                          | 公開？ | 適合 mission 哪條 | 備註                                  |
| --------------- | ---------------------------- | ------ | ----------------- | ------------------------------------- |
| SaaSframe       | https://saasframe.io         | 公開   | #1 #2             | dashboard / onboarding / pricing 場景 |
| SaaSpages       | https://saaspages.xyz        | 公開   | #4                | landing 主                            |
| Landingfolio    | https://www.landingfolio.com | 公開   | #4                | landing 大量                          |
| ScreenshotsofUI | https://screenshotsofui.com  | 公開   | #1 #2 #5          | UI thread 精選                        |

---

## 已落檔 Refs 對應這份清單（Round 1 起點）

| Ref        | 站                    | 狀態                            |
| ---------- | --------------------- | ------------------------------- |
| 01         | IG @ron_design        | ✅ 落檔 + 描述                  |
| 02-06      | Financeux.com         | ✅ 落檔 + 描述                  |
| 07-10      | Dribbble RonDesignLab | ✅ 落檔（自動 case study text） |
| 11-14      | Dribbble 個別         | ✅ 落檔                         |
| 15         | Muz.li 2024           | ✅ 落檔 + 39-entry summary      |
| 16         | Behance Startify      | ✅ 落檔 + page-text             |
| 17 (待)    | Muz.li 2026           | 🔜 Round 1 目標                 |
| 18-21 (待) | Dribbble 4 studio     | 🔜 Round 2-5 目標               |
| 22-25 (待) | Awwwards/Codrops/etc  | 🔜 Round 6-9 目標               |

---

## 變更紀錄

| 日期       | 變更                                            | by     |
| ---------- | ----------------------------------------------- | ------ |
| 2026-04-28 | 開檔 · A/B/C/D 4 大類 22 站清單 · Round 1+ 計畫 | Claude |
