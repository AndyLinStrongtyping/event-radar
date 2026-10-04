# v0.1 API 契約

Base URL `http://127.0.0.1:3000`。日期格式 `YYYY-MM-DD`；錯誤格式 `{ "error": { "code": "...", "message": "..." } }`。

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/health` | 檢查服務與資料庫 |
| GET | `/museums` | 博物館及來源狀態 |
| GET | `/exhibitions` | 搜尋特展 |
| GET | `/exhibitions/:id` | 特展詳情 |

`GET /exhibitions` 接受 `city`、`museum`（來源 ID）、`q`、`from`、`to`、`limit`（預設 20，最多 100）、`offset`（預設 0）、`includeSample=true`。日期範圍表示「展期與此範圍有交集」；`from` 預設今天，`to` 可省略。模擬資料預設隱藏，只在 `includeSample=true` 時顯示。回應 `{ "items": [Exhibition], "total": 42, "limit": 20, "offset": 0 }`，排序開始日與 ID。Exhibition 包含 `id, title, museumId, museumName, city, venue, startDate, endDate, priceNote, sourceUrl, summary, lastSeenAt, isSample`。

400：參數錯誤；404：找不到資源；500：伺服器錯誤。v0.1 不開放公開寫入 API，匯入由 CLI 執行。

`GET /exhibitions/:id` 同樣預設隱藏模擬資料；開發時可加 `?includeSample=true` 查看。
