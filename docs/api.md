# v0.1 API 契約

Base URL `http://127.0.0.1:3000`。日期格式 `YYYY-MM-DD`；錯誤格式 `{ "error": { "code": "...", "message": "..." } }`。

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/health` | 檢查服務與資料庫 |
| GET | `/museums` | 博物館及來源狀態 |
| GET | `/visit-status?museum=<id>&date=YYYY-MM-DD` | 指定日期的休館提醒與館方核對入口 |
| GET | `/exhibitions` | 搜尋特展 |
| GET | `/exhibitions/:id` | 特展詳情 |
| GET | `/exhibitions/:id/changes` | 欄位異動紀錄（最近 100 筆） |

`GET /exhibitions` 接受 `city`、`museum`（來源 ID）、`q`、`from`、`to`、`asOf`、`status`、`admission`、`limit`（預設 20，最多 100）、`offset`（預設 0）、`includeSample=true`。`from`／`to` 是可選的展期交集範圍；`asOf` 是判斷展覽狀態的基準日，預設臺灣今天。`status` 預設 `active`（未結束），也可選 `ongoing`（展出中）、`upcoming`（即將開始）、`ended`（已結束）、`all`（含歷史展覽）。起日及迄日都包含當日。`admission` 預設 `all`，`free` 只收錄 `priceNote` 完全等於「免費」「免費入場」或「免門票」的資料；票價空白或含糊說明不推斷為免費。模擬資料預設隱藏，只在 `includeSample=true` 時顯示。回應 `{ "items": [Exhibition], "total": 42, "limit": 20, "offset": 0 }`。Exhibition 包含 `id, title, museumId, museumName, city, venue, startDate, endDate, priceNote, sourceUrl, summary, lastSeenAt, sourceStatus, isSample`，另有依 `asOf` 計算的 `exhibitionStatus` 及保守判斷的 `admissionStatus`（`free`／`unknown`）。

400：參數錯誤；404：找不到資源；500：伺服器錯誤。v0.1 不開放公開寫入 API，匯入由 CLI 執行。

`GET /exhibitions/:id` 同樣預設隱藏模擬資料；開發時可加 `?includeSample=true` 查看。

`GET /visit-status?museum=nmns&date=2026-10-05` 回傳 `museumId,date,status,message,sourceUrl`，若成功核對科博館 API 另有 `checkedAt`。`status` 為 `open`、`closed` 或 `unknown`；科博館僅在金鑰可用且日期落於 API 未來一週資料內才宣稱開／休館。奇美週三依館方規則回 `closed`，其他日期回 `unknown` 並提供 `newsUrl` 查看臨時公告。其他館目前只有官方網站連結與 `unknown`，不將特展展期推論為開館日。

`sourceStatus` 分為 `curated`（人工核對）、`open_data`（官方公開資料）、`official_page`（館方公開頁同步）與 `planned`（尚未接入）。`GET /exhibitions/:id/changes` 回傳 `{ "items": [{ "field": "endDate", "oldValue": "2026-12-06", "newValue": "2026-12-07", "detectedAt": "..." }] }`；沒有異動時為空陣列，不表示資料未曾被核對。

CI 的 `npm run test:integration` 會建立隔離 PostgreSQL 資料庫、匯入測試展覽並啟動真正的 HTTP 服務，驗證以上端點的狀態碼、JSON 欄位與型別、日期／官方連結格式、清單與詳情一致性、空結果、異動紀錄及 400／404 錯誤格式。外部館方 API 的即時內容不作為 CI 的固定預期值；來源解析與無效資料隔離由固定樣本測試驗證，避免館方改資料或網路故障讓 CI 產生誤判。
