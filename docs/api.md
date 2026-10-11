# v0.1 API 契約

關鍵字 `q` 是不區分大小寫的字面子字串搜尋；`%`、`_`、`#` 不作查詢語法。`GET /museums` 的 `lastSuccessAt` 是最後成功匯入時間（包含手動檔案／快照）；`lastOfficialSuccessAt` 是最後成功取得並匯入官方來源的時間。`dataStatus` 依後者與最近同步嘗試判斷，手動匯入不能刷新官方新鮮度。

Base URL `http://127.0.0.1:3000`。日期格式 `YYYY-MM-DD`；錯誤格式 `{ "error": { "code": "...", "message": "..." } }`。[OpenAPI 3.0 規格](openapi.yaml)描述公開唯讀端點，可供文件工具匯入；`npm test` 會檢查語法、路由及引用。

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/health` | 檢查服務與資料庫 |
| GET | `/museums` | 博物館及來源狀態 |
| GET | `/visit-status?museum=<id>&date=YYYY-MM-DD` | 指定日期的休館提醒與館方核對入口 |
| GET | `/exhibitions` | 搜尋特展 |
| GET | `/exhibitions/:id` | 特展詳情 |
| GET | `/exhibitions/:id/changes` | 欄位異動紀錄（最近 100 筆） |

`GET /exhibitions` 接受 `city`、`museum`（來源 ID）、`q`、`from`、`to`、`asOf`、`status`、`admission`、`limit`（預設 20，最多 100）、`offset`（預設 0）、`includeSample=true`。`from`／`to` 是可選的展期交集範圍；`asOf` 是判斷展覽狀態的基準日，預設臺灣今天。`status` 預設 `active`（未結束），也可選 `ongoing`（展出中）、`upcoming`（即將開始）、`ended`（已結束）、`all`（含歷史展覽）。起日及迄日都包含當日。`admission` 預設 `all`，`free` 只收錄 `priceNote` 完全等於「免費」「免費入場」或「免門票」的資料；票價空白或含糊說明不推斷為免費。模擬資料預設隱藏，只在 `includeSample=true` 時顯示。回應 `{ "items": [Exhibition], "total": 42, "limit": 20, "offset": 0 }`。Exhibition 包含 `id, title, museumId, museumName, city, venue, startDate, endDate, priceNote, sourceUrl, summary, lastSeenAt, sourceStatus, isSample`，另有依 `asOf` 計算的 `exhibitionStatus` 及保守判斷的 `admissionStatus`（`free`／`unknown`），以及 `ticketing: { exhibition, generalAdmission }`。票務物件含 `label, price, infoUrl, purchaseUrl, checkedOn, note`。`exhibition` 只在該檔展覽的官方票價查證完成時有值；`generalAdmission` 是館所一般參觀資訊，不代表該展票價。模擬展覽的票務物件兩欄皆為 `null`。

`GET /museums` 的每個館所另含 `generalAdmission`，供票價／購票索引使用。票價與售票網址由 `src/ticketing.ts` 人工查證維護，不是每日同步資料；`checkedOn` 是人工核對日，不是即時報價。購票入口是館方網站或由館方明確連結的售票平台；未查到線上購票入口時為 `null`。既有免費篩選只依展覽來源的 `priceNote`，不以館所優惠、免票身分或一般入館票推斷特展免費。

每個館所另有 `coverageStatus`：`baseline_created`（第一次建立比較基準）、`checked`（未達筆數縮水或來源鍵大幅替換門檻）、`deferred_partial`（清單疑似不完整或項目大幅變動，需核對館方）或 `null`（尚無官方完整度判定）。它獨立於 `dataStatus`；「最近取得來源」不表示展覽清單完整。公開網站在 `deferred_partial` 時顯示警示。

`pendingReviewCount` 是該館目前 `source_records.status='review'` 的筆數，不等於當期特展數；可能含歷史資料、缺展期或無法核對的來源列。網站會提示此數量，但這些資料不進公開搜尋。`dataStatus=recent` 只表示近期曾成功取得官方來源，兩者可以同時成立。

400：參數錯誤；404：找不到資源；500：伺服器錯誤。`/health` 在啟動後資料庫暫時不可查時回 503／`NOT_READY`；啟動當下若無法連線則不監聽。v0.1 不開放公開寫入 API，匯入由 CLI 執行。

`GET /exhibitions/:id` 同樣預設隱藏模擬資料；開發時可加 `?includeSample=true` 查看。

`GET /visit-status?museum=nmns&date=2026-10-05` 回傳 `museumId,date,status,message,sourceUrl`，若成功核對科博館 API 另有 `checkedAt`。`status` 為 `open`、`closed` 或 `unknown`；科博館僅在金鑰可用且日期落於 API 未來一週資料內才宣稱開／休館。奇美週三依館方規則回 `closed`，其他日期回 `unknown` 並提供 `newsUrl` 查看臨時公告。其他館目前只有官方網站連結與 `unknown`，不將特展展期推論為開館日。

`sourceStatus` 分為 `curated`（人工核對）、`open_data`（官方公開資料）、`official_page`（館方公開頁同步）與 `planned`（尚未接入）。`GET /exhibitions/:id/changes` 回傳 `{ "items": [{ "field": "endDate", "oldValue": "2026-12-06", "newValue": "2026-12-07", "detectedAt": "..." }] }`；沒有異動時為空陣列，不表示資料未曾被核對。

CI 的 `npm run test:integration` 會建立隔離 PostgreSQL 資料庫、匯入測試展覽並啟動真正的 HTTP 服務，驗證以上端點的狀態碼、JSON 欄位與型別、日期／官方連結格式、清單與詳情一致性、空結果、異動紀錄及 400／404 錯誤格式。外部館方 API 的即時內容不作為 CI 的固定預期值；來源解析與無效資料隔離由固定樣本測試驗證，避免館方改資料或網路故障讓 CI 產生誤判。
