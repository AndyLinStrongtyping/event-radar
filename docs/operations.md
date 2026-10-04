# 每日同步運作設計

目標頻率為臺灣時間每日 04:15。排程在非整點，降低 GitHub Actions 整點壅塞機率；它仍可能延遲或漏跑，不能承諾準點更新。來源資料本身若未更新，重跑只刷新最後看見時間。

`.github/workflows/daily-sync.yml` 已備妥，但**尚未啟用**。啟用條件：

1. 專案放到獨立 GitHub repo 的預設分支。
2. 建立可從 GitHub Actions 連線的 PostgreSQL，先執行 `db/001_init.sql`。
3. Repository secrets 設 `DATABASE_URL` 與 `NMNS_OPEN_DATA_URL`。後者從 [政府資料開放平臺的科博館 JSON 資源](https://data.gov.tw/dataset/7499)複製；URL 可能變動，需追蹤。個人申請的 API key 暫不需要。
4. Repository variable 設 `EVENT_RADAR_SYNC_ENABLED=true`，先手動執行一次並確認 `ingestion_runs` 與 `/health`，才依排程運作。

`last_success_at` 表示最後成功匯入時間，不能只看排程是否有觸發。日後應加上「超過 48 小時未成功」告警，以及來源回傳空集合／欄位格式改變的告警。

條件式請求（ETag、`If-Modified-Since`）只在官方端實際提供標頭且驗證 `304` 行為後實作。奇美官網尚未確認可自動擷取與使用條件，日程初期只同步科博館公開資料。

## 奇美每週變更檢查

`npm run check:chimei` 讀取官方 `robots.txt` 與公開特展頁，從初始 HTML 中的館方個別特展連結比對 `data/chimei-known-links.json`。可用 `npm run check:chimei -- --file <本機HTML>` 離線驗證。`.github/workflows/chimei-check.yml` 設定每週一臺灣時間 09:20 執行，且可手動觸發；目前只在本機 Git，尚未放進 GitHub repo，故排程未啟用。新連結、既有連結消失、來源錯誤或解析不到連結都會讓檢查失敗；人工核對官方頁與資料庫後，才更新基準清單。

此檢查只能發現初始 HTML 明確連出的特展網址，不能涵蓋由奇美官網內部介面動態載入的完整清單，也不能替代正式資料授權與匯入流程。不要將成功的檢查結果顯示為「奇美資料已同步」。
