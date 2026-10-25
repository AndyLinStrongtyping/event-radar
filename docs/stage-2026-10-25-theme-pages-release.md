# 2026-10-25 主題頁分流與公開驗收

## 目的與變更

首頁原本放入深海、化石兩段完整導覽，訪客要長距離捲動才能切換主題。現在首頁保留展覽搜尋及行前資訊，探索卡、頂部導覽和桌面快速跳轉進入兩個獨立頁面：

- [深海探勘](https://event-radar-preview.onrender.com/explore/ocean/)
- [化石探勘](https://event-radar-preview.onrender.com/explore/fossils/)

兩頁各有標題、簡介、返回搜尋與交叉導覽，原有雙館切換及資料限制提示保留。Vite 一次建立三個入口；Render 和本機預覽明確提供新路由，網站地圖及標準網址同步加入。Pages 使用專案子路徑並保留 `noindex`，標準網址仍指向 Render。舊首頁 `#deep-sea`、`#sea-*`、`#expeditions`、`#fossils*` 連結轉向新頁。

## 驗收證據

| 項目 | 結果 |
| --- | --- |
| [PR #17](https://github.com/AndyLinStrongtyping/event-radar/pull/17) | 兩項自動檢查通過後合併；主分支 `ae0356e` 的 [CI](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/40165694503) 亦成功。 |
| [GitHub Pages #18](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/40165694500) | 發布成功；公開的 `/event-radar/explore/ocean/` 與 `/event-radar/explore/fossils/` 均可直接開啟。 |
| [Render 部署](https://dashboard.render.com/web/srv-db9hkpfavr4c73e40ahg/deploys/dep-dbep7dhsrm7s73csuj90) | `ae0356e` 顯示 `Deploy succeeded | Live`；未新增 migration，既有 25 份均保持。 |
| 公開站唯讀檢查 | `npm run smoke:deploy -- https://event-radar-preview.onrender.com` 通過，包含健康檢查、兩個新頁、標題／標準網址、網站地圖與 API；當時 11 間館所、32 筆可搜尋特展。 |
| 瀏覽器操作 | Chrome 開啟 Pages 兩頁及 Render 深海頁，海生館兩檔限期展和歷史節目載入；舊 Pages `/#fossils` 轉往新化石頁。 |
| 本機檢查 | 型別、82 項單元測試、70 份文件檢查、一般與 Pages 子路徑建置通過；化石頁 390px 視窗未見橫向溢出。隔離 PostgreSQL 整合案例由 GitHub CI 執行。 |

本次只改導覽與頁面入口，沒有更動展覽匯入、正式資料庫內容或每週排程。瀏覽器桌面／模擬手機寬度不等於手機實機驗收；Search Console 是否收錄新頁需等待搜尋引擎處理。10/27 第二次週排程仍待發生及核對。
