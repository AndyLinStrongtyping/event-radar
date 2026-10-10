# 每日同步運作設計

目標頻率為臺灣時間每日 04:15。排程在非整點，降低 GitHub Actions 整點壅塞機率；它仍可能延遲或漏跑，不能承諾準點更新。來源資料本身若未更新，重跑只刷新最後看見時間。

`.github/workflows/daily-sync.yml` 已備妥，但**尚未啟用**。預設所有同步工作與奇美每週檢查都由 `EVENT_RADAR_SYNC_ENABLED` 閘門關閉；推送程式碼只執行 CI 驗證，不會連接外部資料庫。啟用條件：

1. 專案放到獨立 GitHub repo 的預設分支。
2. 建立可從 GitHub Actions 連線的 PostgreSQL，先執行 `db/001_init.sql`，再執行 `npm run migrate`。
3. Repository secrets 設 `DATABASE_URL` 與 `NMNS_API_KEY`。後者只在決定啟用線上同步時設定，切勿寫入程式碼、文件或 workflow 日誌；`NMNS_OPEN_DATA_URL` 可作展覽匯入的無金鑰備援，不能提供逐日開放時間。
4. Repository variable 設 `EVENT_RADAR_SYNC_ENABLED=true`，先手動執行一次並確認 `ingestion_runs` 與 `/health`，才依排程運作。

每日同步 workflow 定義五個相互獨立的工作：科博館官方 OpenAPI（有 Key 時優先；公開 JSON 備援）、故宮南院官方當期／預告頁、故宮北院公開 JSON、海生館公開 JSON、科工館公開 JSON 加官方特展列表核對。文化部奇美資料目前只在本機手動匯入，因官方 OpenAPI 未確認分頁及完整涵蓋率。匯入先驗證來源，再在交易中寫入；來源為空、頁面格式改變或寫入錯誤時記失敗，`last_success_at` 不前進。逐筆可隔離的品質問題會存原始紀錄；若整批 **0 筆可公開展覽**，保留原始／待審資料、記失敗並回傳非零碼，不把這次嘗試當成成功同步。有有效展覽但部分待審時仍可成功。故宮南院只收有起訖日期的展覽，跨當期與預告頁以官方詳情網址合併。

本機 `npm run sync:status` 可查最新嘗試、最近成功時間、七日失敗／重試次數和待審量；`npm run sync:failed -- --source <館別>` 只在該來源最近嘗試失敗時重跑。`sync_attempts` 是持久化嘗試日誌，尚無工作佇列、死信佇列或主動告警。沒有嘗試紀錄也不能當作成功。

`last_success_at` 表示最後成功匯入時間，不能只看排程是否有觸發。`GET /museums` 會綜合最近一次 `sync_attempts` 與最後成功時間回傳 `dataStatus`；特展頁選館後顯示這項狀態與館方連結。最近一次失敗優先顯示失敗，超過 7 天未成功顯示資料可能過期，即使過去匯入未留下同步嘗試紀錄也是如此；近期匯入卻沒有成功的同步嘗試紀錄不視為正常定期更新。7 天是同步狀態提醒門檻，並非展覽內容的有效期限。奇美只標人工核對，本機靜態預覽只標展示快照。這是被動提示，**尚無自動告警**；現階段 workflow 失敗紀錄仍須人工檢查。

同館跨來源以官方詳情網址優先去重；不同網址只在展名、展廳相同且展期重疊時合併。來源別名保存在 `exhibition_sources`，欄位舊值與新值保存在 `exhibition_changes`，可從 `GET /exhibitions/:id/changes` 查詢。這不會把不同館的巡迴展誤併成同一場。若候選超過一筆，匯入失敗並等待人工判斷。

條件式請求（ETag、`If-Modified-Since`）只在官方端實際提供標頭且驗證 `304` 行為後實作。奇美官網尚未確認可自動擷取與使用條件，不列入每日資料庫同步。

## 奇美每週變更檢查

`npm run check:chimei` 讀取官方 `robots.txt` 與公開特展頁，從初始 HTML 中的館方個別特展連結比對 `data/chimei-known-links.json`；另以間隔請求核對 `data/chimei-known-details.json` 內已知展覽的官方展名與完整展期。可用 `npm run check:chimei -- --file <本機HTML>` 離線驗證連結（離線模式不核對詳情）。`.github/workflows/chimei-check.yml` 設定每週一臺灣時間 09:20；目前受同一 `EVENT_RADAR_SYNC_ENABLED` 閘門保護，未啟用線上排程。新連結、既有連結消失、已知詳情不符、來源錯誤或解析不到連結都會讓檢查失敗；人工核對官方頁與資料庫後，才更新基準清單。

此檢查只能發現初始 HTML 明確連出的特展網址及已知展覽詳情變化，不能涵蓋由奇美官網內部介面動態載入的完整清單，也不能替代正式資料授權與匯入流程。不要將成功的檢查結果顯示為「奇美資料已同步」。
