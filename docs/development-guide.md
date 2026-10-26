# Event Radar 開發導覽

這份文件幫新接手的開發者快速找到**目前真正運作的路徑**。功能完成度以 [STATUS](../STATUS.md) 為準；[路線圖](future-roadmap.md)與[目標架構圖](architecture.md#目標架構概念圖尚未實作)包含尚未實作的設計，不能當成現況。

## 建議閱讀順序

若要了解產品為何做、先做什麼，先讀[產品需求規格](product-prd.md)、[版本優先級](product-mvp.md)、[使用者故事與驗收](product-stories.md)、[產品流程](product-flows.md)，再接下方工程導覽。新內容目前是規劃，不能從需求文件推定已實作。

1. [STATUS](../STATUS.md)：哪些來源可匯入、哪些只有人工資料、哪些仍待驗證。
2. [專案結構地圖](project-structure.md)、[程式導覽](code-reference.md)、[本頁](development-guide.md)、[目前架構](architecture.md#目前實作公開技術預覽)與[ERD](erd.md)：先找到檔案責任，再理解資料如何進入、分流、建立關聯與被查詢。
3. [API 說明](api.md)和 [OpenAPI 3.0](openapi.yaml)：公開唯讀端點的語意、參數、回應與錯誤。
4. [來源盤點](sources.md)及[技術決策](technical-decisions.md)：每館證據、資料品質規則與取捨。
5. [運作設計](operations.md)、[Phase 3](stage-2026-10-15-phase3.md)與[Phase 4](stage-2026-10-15-phase4.md)階段紀錄：逐場／逐日核對、手動同步、測試證據及未完成事項。

## 三條資料路徑

| 路徑 | 入口與轉換 | 保存與公開方式 | 不能推論的事 |
| --- | --- | --- | --- |
| 限期特展 | `src/ingest.ts`／`src/sync-source.ts` → 來源資料轉換器 → 日期與官方連結驗證 → 正規化 | `exhibitions`、原始／待審紀錄、來源別名與異動；`/exhibitions` 搜尋 | 缺結束日不等於常設展；來源清單消失不等於取消 |
| 表演與海洋節目 | `src/sync-domain.ts` → `src/sources/ntt-events.ts` 或 `nmmba-programmes.ts` → `src/domain-events.ts`；歌劇院已接獨立每週 Actions 工作，海生館當日節目仍按觀察日人工同步 | `domain_events` 加 `event_sessions` 或 `recurring_schedules`；`/performances`、`/marine-programmes` | 歌劇院有場次不等於仍有票；海生館今日時段不保證未來時段或開館 |
| 奇美活動候選 | 官網內部 JSON 的人工刷新／本機快照 → 奇美資料轉換器 | 候選 `programme_events` 與靜態 `/chimei-activities.json`；沒有公開活動搜尋 API | 候選不等於已確認特展；內部端點不是公開文件化 API |

導覽頁在 `web/guides/`，由人工編寫並附官方核對連結；它們不是上述任何一條自動同步資料流。React 首頁在 `frontend/`，公開查詢由 `src/server.ts` 提供；登入後的本機審查工具由 `src/admin-server.ts` 提供，不列入公開 OpenAPI。

## 讀懂資料狀態

`sourceStatus` 說明資料取得方式，`dataStatus` 說明最近官方取得及嘗試情況，`coverageStatus` 說明清單完整度是否可相信；這三個欄位**不能互相替代**。`pendingReviewCount` 是待人工核對的來源列數，不是漏掉的當期展覽數。展覽通過完整日期與來源驗證才進公開搜尋；無法核對的列保留在待審，不猜展期。詳細定義見 [API 說明](api.md)及[來源完整度決策](technical-decisions.md)。

表演與海洋節目是另外的 Domain：表演可以有多個有時區的 `sessions`，海洋節目是帶 `observedOn` 的本地每日時段。海洋 API 只顯示最近一次成功匯入的批次；若新清單相對前次大幅縮水，匯入記為 `SOURCE_ANOMALY` 並保留前次資料。即使最近批次成功，`observedOn` 不是今天時，前端仍提醒先查館方。這套保護的單元測試與隔離 PostgreSQL／真實 HTTP 整合案例已通過；未驗證官網跨週穩定或特殊日開館。

歌劇院的場次售票狀態只在官方詳情明示額滿時標 `sold_out`；公告涉及部分場次更動時先標 `unknown`，由 `npm run review:performance -- pending` 找出待核對場次，再用 `set` 附官方證據逐場核對。人工結果記錄來源版本及異動歷史；下一次來源內容改變會使舊核對失效，避免沿用過期結論。流程詳見[Phase 3 階段紀錄](stage-2026-10-15-phase3.md)。

## 從修改到驗證

文件變更可先跑 `npm run check:docs`，確認 README、STATUS 與 `docs/*.md` 的本機相對連結都有目標檔案；這不驗證外部網址或頁內錨點。

新增或修改一個來源時，先在 [來源盤點](sources.md)留下官方入口與已核對的欄位，再改對應資料轉換器。來源特有欄位留在資料轉換器；輸入驗證失敗應產生待審或讓整批失敗，不讓不明資料冒充公開展覽。若更動資料庫結構，新增 `db/` migration 並更新查詢與 [OpenAPI](openapi.yaml)；舊 migration 不改寫。

本機命令以 `package.json` 為準：`npm run migrate` 套用結構，`npm test` 跑單元與 OpenAPI 文件檢查，`npm run typecheck` 檢查後端／前端型別，`npm run build:web` 建置 React，`npm run test:integration` 需可連線的 PostgreSQL，會使用隔離測試資料庫驗證實際 HTTP 回應。外部館方頁面會變動，固定 CI 不依賴即時館方內容；來源真實性另以有日期的只讀核對與階段紀錄留證。資料庫或外網缺席時，應明確記錄「未驗證」，不能把單元測試當作整合通過。

查詢可從 `GET /health`、`GET /museums`、`GET /exhibitions?status=active` 開始，再看 `GET /performances?source=ntt` 與 `GET /marine-programmes?source=nmmba`。完整參數、回應 schema、錯誤碼請用 [OpenAPI](openapi.yaml)；人工審核、資料同步與工作重播是本機命令或管理頁，不是公開寫入 API。

每次功能或資料決策變更，依 [AGENTS.md](../AGENTS.md) 同步更新 [技術決策](technical-decisions.md)、[STATUS](../STATUS.md)，必要時更新 API、架構及運作文件。API 的 schema 以實際 HTTP 回應與整合測試為準；文件不能宣稱工作佇列、線上排程、通知、部署或 AWS 已運作，除非有對應驗證證據。
