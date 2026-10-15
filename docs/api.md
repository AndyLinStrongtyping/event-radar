# v0.1 API 契約

關鍵字 `q` 是不區分大小寫的字面子字串搜尋；`%`、`_`、`#` 不作查詢語法。`GET /museums` 的 `lastSuccessAt` 是最後成功匯入時間（包含手動檔案／快照）；`lastOfficialSuccessAt` 是最後成功取得並匯入官方來源的時間。`dataStatus` 依後者與最近同步嘗試判斷，手動匯入不能刷新官方新鮮度。

Base URL `http://127.0.0.1:3000`。日期格式 `YYYY-MM-DD`；錯誤格式 `{ "error": { "code": "...", "message": "..." } }`。[OpenAPI 3.0 規格](openapi.yaml)描述公開唯讀端點，可供文件工具匯入；`npm test` 會檢查語法、路由及引用。

奇美「活動與節目」目前由本機人工快照提供靜態 `/chimei-activities.json` 給首頁顯示，另有**不公開的候選** `programme_events` 資料表。靜態快照已列入 OpenAPI 並由 CI 驗證回應格式，但它**不是正式活動搜尋 API**；目前沒有活動日期查詢、場次或取消狀態保證。下表公開唯讀 REST 路由與這一條快照路由分開。

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/health` | 檢查服務與資料庫 |
| GET | `/museums` | 博物館及來源狀態 |
| GET | `/visit-status?museum=<id>&date=YYYY-MM-DD` | 指定日期的休館提醒與館方核對入口 |
| GET | `/exhibitions` | 搜尋特展 |
| GET | `/exhibitions/:id` | 特展詳情 |
| GET | `/exhibitions/:id/changes` | 欄位異動紀錄（最近 100 筆） |
| GET | `/exhibitions/:id/art-changes` | 美術展欄位異動紀錄（最近 100 筆） |
| GET | `/performances` | 歌劇院節目與場次；預設只列未來場次 |
| GET | `/marine-programmes` | 海生館最近一次成功匯入的當日節目觀察 |

另外 `GET /chimei-activities.json` 回傳 `{checkedAt, sourceUrl, items}`；每筆含 `id, title, dateText, type, sourceUrl`。`dateText` 是清理 HTML 後的館方時間原文，可能包含售票日，不可直接視為活動日期。頁面及 API 使用者應開啟 `sourceUrl` 核對最新場次與票務。

`GET /exhibitions` 接受 `city`、`museum`（來源 ID）、`q`、`from`、`to`、`asOf`、`status`、`admission`、`limit`（預設 20，最多 100）、`offset`（預設 0）、`includeSample=true`。`from`／`to` 是可選的展期交集範圍；`asOf` 是判斷展覽狀態的基準日，預設臺灣今天。`status` 預設 `active`（未結束），也可選 `ongoing`（展出中）、`upcoming`（即將開始）、`ended`（已結束）、`all`（含歷史展覽）。起日及迄日都包含當日。`admission` 預設 `all`，`free` 只收錄 `priceNote` 完全等於「免費」「免費入場」或「免門票」的資料；票價空白或含糊說明不推斷為免費。模擬資料預設隱藏，只在 `includeSample=true` 時顯示。回應 `{ "items": [Exhibition], "total": 42, "limit": 20, "offset": 0 }`。Exhibition 包含 `id, title, museumId, museumName, city, venue, startDate, endDate, priceNote, sourceUrl, summary, lastSeenAt, sourceStatus, isSample`，另有依 `asOf` 計算的 `exhibitionStatus` 及保守判斷的 `admissionStatus`（`free`／`unknown`），以及 `ticketing: { exhibition, generalAdmission }`。票務物件含 `label, price, infoUrl, purchaseUrl, checkedOn, note`。`exhibition` 只在該檔展覽的官方票價查證完成時有值；`generalAdmission` 是館所一般參觀資訊，不代表該展票價。模擬展覽的票務物件兩欄皆為 `null`。

`GET /museums` 的每個館所另含 `generalAdmission`，供票價／購票索引使用。票價與售票網址由 `src/ticketing.ts` 人工查證維護，不是每日同步資料；`checkedOn` 是人工核對日，不是即時報價。購票入口是館方網站或由館方明確連結的售票平台；未查到線上購票入口時為 `null`。既有免費篩選只依展覽來源的 `priceNote`，不以館所優惠、免票身分或一般入館票推斷特展免費。

每個館所另有 `coverageStatus`：`baseline_created`（第一次建立比較基準）、`checked`（未達筆數縮水或來源鍵大幅替換門檻）、`deferred_partial`（清單疑似不完整或項目大幅變動，需核對館方）或 `null`（尚無官方完整度判定）。它獨立於 `dataStatus`；「最近取得來源」不表示展覽清單完整。公開網站在 `deferred_partial` 時顯示警示。

`pendingReviewCount` 是該館目前 `source_records.status='review'` 的筆數，不等於當期特展數；可能含歷史資料、缺展期或無法核對的來源列。網站會提示此數量，但這些資料不進公開搜尋。`dataStatus=recent` 只表示近期曾成功取得官方來源，兩者可以同時成立。

400：參數錯誤；404：找不到資源；500：伺服器錯誤。`/health` 在啟動後資料庫暫時不可查時回 503／`NOT_READY`；啟動當下若無法連線則不監聽。v0.1 不開放公開寫入 API，匯入由 CLI 執行。

`GET /exhibitions/:id` 同樣預設隱藏模擬資料；開發時可加 `?includeSample=true` 查看。

`GET /visit-status?museum=nmns&date=2026-10-05` 回傳 `museumId,date,status,message,sourceUrl`，若成功核對科博館 API 另有 `checkedAt`。`status` 為 `open`、`closed` 或 `unknown`；科博館僅在金鑰可用且日期落於 API 未來一週資料內才宣稱開／休館。奇美週三可能特別開放，因此回 `unknown` 並提供 `newsUrl` 查看臨時公告。海生館提供官方服務與票價頁核對季節及特殊開館，逐日狀態仍是 `unknown`。其他館目前也只有官方入口與 `unknown`，不將特展或節目日期推論為開館日。

`sourceStatus` 分為 `curated`（人工核對）、`open_data`（官方公開資料）、`official_page`（館方公開頁同步）與 `planned`（尚未接入）。`GET /exhibitions/:id/changes` 回傳 `{ "items": [{ "field": "endDate", "oldValue": "2026-12-06", "newValue": "2026-12-07", "detectedAt": "..." }] }`；沒有異動時為空陣列，不表示資料未曾被核對。

`GET /museums` 另有 `venueType`（`museum`／`art_museum`）。`Exhibition.art` 對一般博物館是 `null`；已核對的國美館限期展回傳 `artistNames`、`curatorNames`、`exhibitionType`、`venueArea`、`floor` 與 `relatedEvents`。來源未明載人物名稱時是空陣列，不以介紹文章中的泛稱推測。相關活動只提供官方連結與類型，**不代表該場次仍可報名**。`/exhibitions/:id/changes` 查共通展覽欄位；`/exhibitions/:id/art-changes` 查美術欄位，回傳同樣的 `items` 結構，其中 `oldValue`／`newValue` 依欄位為字串、字串陣列、相關活動物件陣列或 `null`。一般博物館展覽的美術異動列表為空；隱藏或模擬展覽沿用詳情端點的 404／`includeSample=true` 規則。

CI 的 `npm run test:integration` 會建立隔離 PostgreSQL 資料庫、匯入測試展覽並啟動真正的 HTTP 服務，驗證以上端點的狀態碼、JSON 欄位與型別、日期／官方連結格式、清單與詳情一致性、空結果、異動紀錄及 400／404 錯誤格式。外部館方 API 的即時內容不作為 CI 的固定預期值；來源解析與無效資料隔離由固定樣本測試驗證，避免館方改資料或網路故障讓 CI 產生誤判。

## Phase 3／4 節目資料

`GET /performances?source=ntt` 回傳節目與 `sessions[]`，每場含 `startsAt`、`hall`、`ticketUrl`、可空的 `priceMin/priceMax` 和 `status`。`period` 預設 `upcoming`：只列出開始時間晚於查詢當下、狀態為 `scheduled` 或 `sold_out` 的場次，按下一場時間排序；同一節目的過去場次不混在回應內，`total` 也只計符合條件的節目。若已有成功且保存來源鍵的歌劇院官方 `place=1` 清單，預設清單只列該次成功批次仍包含的節目；異常失敗批次不取代基準，人工抽樣也不刷新基準。首次尚無此基準時只套用場次時間與狀態條件。`period=all` 可查保留的歷史節目、清單缺席節目、過去場次及 `unknown`／取消／延期狀態。此篩選不會改寫或刪除資料，更不代表缺席就是取消。手動同步讀取臺中國家歌劇院官網 `place=1` 清單 HTML 所有可辨識詳情，包含「MORE」預藏卡片；若按鈕行為改變或超過單批 30 筆即停止，並不代表全站其他篩選條件。`scheduled` 只表示館方列有場次，不表示尚有餘票。來源詳情內消失的場次標為 `unknown`，不自動判定取消。票價因平日／假日等差異無法安全拆分時維持 `null`，保留原文 `priceNote`。

`GET /marine-programmes?source=nmmba` 只回傳最近一次成功匯入的官網當日節目表，包含 `dailySchedule[]` 與 `observedOn`；較早觀察日的紀錄仍保留於資料庫供追查，但不混入此清單。若新清單從至少四筆的上次成功基準突然降到不足一半，匯入以 `SOURCE_ANOMALY` 失敗並保留上次成功資料，待人工核對。`localTime` 是臺灣本地時刻；不得把昨日觀察推定為明日必有活動，也不可用節目表推定特殊日開館。兩條 API 均支援 `limit`（1–100）與 `offset`，來源時間由 `sourceCheckedAt` 回傳，詳見 [OpenAPI](openapi.yaml)。本機手動同步指令為 `npm run sync:domain -- --source ntt` 或 `--source nmmba`，未進入線上排程。

新接手者若需要先理解資料為何分成特展、表演與海洋節目，請從[開發導覽](development-guide.md)開始，再用本頁查語意、[OpenAPI](openapi.yaml)查機器可讀 schema。OpenAPI 只描述已公開的唯讀 HTTP 回應；匯入、待審、來源健康、Queue 與人工重播的操作請看[運作設計](operations.md)，不能從公開 API 規格推定已有線上排程或通知。
