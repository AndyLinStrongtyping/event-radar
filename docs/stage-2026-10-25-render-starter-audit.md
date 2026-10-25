# Render Starter 升級與部署稽核（2026-10-25）

這份紀錄區分**線上已核對**與**本分支待審設定**。本輪沒有修改 Render、Neon、GitHub Actions Secret 或正式資料；也沒有執行部署或正式 migration。公開站部署仍是 `4f88c69`，本分支的 `render.yaml` 尚未生效。

## 線上狀態與證據

| 項目 | 2026-10-25 核對結果 |
| --- | --- |
| Render 計算方案 | Compute 選中 `0.5c-512mb`，標示 US$7／月、0.5 CPU、512 MB，1 個執行個體；Events 有 13:52「Free → 0.5c-512mb」紀錄。這只確認 Web Service，沒有升級資料庫。 |
| 部署 | Render 顯示 `4f88c69`、Live；Build、25 份已登記 migration（新套用 0）與首次資料檢查完成。部署設定仍在 Build Command 執行 migration 和 `bootstrap-preview.mjs`，Pre-Deploy Command 留空。 |
| 健康檢查 | Settings 為 `/health`；公開站唯讀 `npm run smoke:deploy -- https://event-radar-preview.onrender.com` 通過：首頁、資源、館所／特展／表演／海洋 API、介紹頁、圖片、主題頁及 sitemap。當下為 11 館、32 筆可搜尋特展，不代表全部來源新鮮。 |
| 環境變數 | 控制台可見 `DATABASE_URL`、`HOST`、`PUBLIC_BASE_URL`、`GOOGLE_SITE_VERIFICATION` 等名稱且值遮蔽。沒有顯示 Secret；成功 migration、健康檢查與 API 也支持必要連線已配置。`.env not found` 是可選本機檔案提示，不能單憑此訊息判定缺設定。 |
| 資料庫 | Neon `event-radar` production 分支仍顯示 Free plan；截至核對時儲存量 34.28 MB、history retention 6 小時。既有本機隔離還原演練不能取代每次結構變更前的新備份。 |
| 本月帳務 | Render Billing 的未開帳費用為 US$0.01，服務明細只列 `event-radar-preview` US$0.01，其他兩項服務為 US$0.00；10 月當時預估總額 US$1.53。這是 10/25 的動態估算，不是已開立帳單，也不代表之後都只收此金額。 |

對公開站三個唯讀端點各量三次完整回應：`/health` 307／109／424 ms，`/museums` 180／204／116 ms，`/exhibitions?limit=1` 132／182／175 ms。這是單一工作站、已啟動服務的小樣本，不是使用者體驗百分位數，也**沒有完成閒置 20～30 分鐘後的冷啟動對照**。Render 12 小時圖中的記憶體曲線未接近 512 MB 上限，但不能據此保證尖峰流量容量；應保留用量監看。

## 兩次啟動與 SSL 警告

13:52:29 的啟動行屬於執行個體 `xp852`，13:52:43 屬於另一個 `z494c`。兩者分別印出 Node 行程 64／84；同時 Events 只有計算方案變更、部署開始與 Live，所見時間窗沒有 `Instance Failed` 或健康檢查失敗事件。因此較符合**方案切換／部署時執行個體交接**，不是同一 Node 行程自行重跑；仍不能從這些紀錄證明平台內部確切調度。後續若再次出現短時間啟動，應比對執行個體 ID、Events、`/health` 與 CPU／記憶體。

鎖定版本為 `pg` 8.23.1、`pg-connection-string` 2.14.1。專案 PostgreSQL 連線使用 `connectionString`，沒有另設 `ssl` 物件。這版套件把 URL 的 `sslmode=prefer`、`require`、`verify-ca` 視同 `verify-full`，並警告下一個主版將依 libpq 改成較弱的不同語意。本機以**假連線網址**驗證 `require` 和 `verify-full` 都解析為相同的 TLS 設定 `{}`，且後者沒有警告。Render 的 Secret 值被遮蔽，本輪**沒有讀取實際連線字串**，因此不能斷言它確實是 `require`；部署警告足以證明某個有歧義的 SSL 模式被解析。

修正步驟是先在不顯示密碼的條件下確認 Render、GitHub Actions 與本機各自的 URL 查詢參數；若為上述別名且供應商主機憑證能通過完整驗證，將 `sslmode` 改成 `verify-full`，保留其他參數（例如 `channel_binding`），先在隔離環境連線，再依變更窗口分別更新 Secret、核對週同步與公開 `/health`。**不要**使用 `rejectUnauthorized=false`、`sslmode=no-verify` 或 `uselibpqcompat=true&sslmode=require` 來消除警告。這輪沒有更改任何連線字串。依據：[node-postgres SSL 說明](https://node-postgres.com/features/ssl)、[pg-connection-string SSL 模式](https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/README.md)。

## 待審的部署設定調整

本分支 `render.yaml` 對齊已生效的 `0.5c-512mb`，把 Build 限於安裝依賴及編譯 React；將 `npm run migrate` 移到 Starter 可用的 `preDeployCommand`。`start:prod` 和 `/health` 不變。`bootstrap-preview.mjs` 不再於**每次部署**自動執行：原腳本在當期可展示展覽歸零時會嘗試抓取三個來源並寫入資料，這可能使單純部署突然變成資料匯入。新資料庫首次建置時須先按匯入手順手動載入並核對來源；網站部署後執行 `smoke:deploy`，若特展為零就不視為驗收完成。

Migration runner 有檔名／checksum 帳本、advisory lock，單檔 SQL 與帳本同交易；這次部署新套用 0 份，重跑不會重建既有 25 份。但**未來新增 migration 仍會寫正式資料庫**，且 pre-deploy 失敗或回退程式不會自動還原 schema。要先有當次備份、隔離還原與舊／新程式相容性審查，再合併、套用 Blueprint、部署。參見 [Render pre-deploy 官方說明](https://render.com/docs/deploys)。

本機驗證：82 項單元測試、前後端型別、React 正式建置、73 份 Markdown 連結及 Blueprint YAML 解析／設定檢查通過。這些檢查**沒有實際套用 Pre-Deploy**；本機 Docker daemon 未啟動，這輪未重跑 PostgreSQL 隔離整合測試，也沒有接正式 Neon 執行 migration。

回復方案：若尚未套用，直接關閉本分支即可；若只改了 Blueprint 指令且未開始新 migration，可改回前一版 Build／Pre-Deploy 設定再部署上一個已知可用的 SHA。若新 migration 已執行，**不可只回退程式**，要依備份和相容性計畫處理資料庫。資料庫 Secret 的 SSL 調整若連線失敗，立即還原原 Secret 並查憑證鏈與主機名稱，勿關閉驗證。

## 尚待確認

1. 正式環境 SSL 查詢參數、憑證鏈及改為 `verify-full` 的實際連線測試；需在變更窗口處理 Secret。
2. Starter 閒置 20～30 分鐘後的首次請求，與一週 Render Events／用量；目前只知計算方案已生效和短樣本回應正常。
3. 下期 Render Billing 實際帳單及接下來整月 Starter 用量；目前只有 10/25 未開帳 US$0.01 與 10 月預估 US$1.53。
4. `render.yaml` 及部署手順的待審變更須經正式備份與確認後才套用；本分支未合併、未部署。
