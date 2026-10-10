# Event Radar：以健身房專案兩份講義檢查表對照審查

日期：2026-10-10。審查版本：本機 `main` 的 `ff5507e`。依據使用者提供的《後端程式碼_講義合規檢查_不含容器化》和《驗證與授權流程_講義合規檢查》，靜態閱讀 Event Radar 程式、資料庫腳本、API 文件及既有測試。本次執行 `npm run typecheck` 與 `npm test`（34/34 通過）；**沒有重跑會建立隔離資料庫的 PostgreSQL 整合測試，也沒有驗證公開部署**。

這兩份文件原本檢查 FitConnect 的 Express／TypeORM 課程作業。以下對照的是可轉用的工程原則，不把指定框架、教練角色或 JWT 當成 Event Radar 的產品需求。

## 優先修正

### P2｜初始資料庫仍依賴手動步驟，migration 無版本帳本

[`src/migrate.ts`](../src/migrate.ts) 只依固定清單執行 `002`～`012`；[`README.md`](../README.md) 明確要求先手動執行 [`db/001_init.sql`](../db/001_init.sql)。因此它**已有版本化 SQL，不能說完全沒有 migration**，但空白資料庫不能只靠 `npm run migrate` 建好，程式也沒有記錄哪些版本已套用的 migration 帳本。部分腳本使用 `IF NOT EXISTS`，仍不能保證每份腳本可安全重跑或識別中途失敗的版本。`001` 內有館所參考資料，但沒有獨立的開發／展示 seed 命令；這是可重建性不足，不代表正式環境必須灌假展覽。

建議先讓單一命令從空白資料庫依序建表並記錄已套用版本，對已存在的資料庫規劃一次性基線核對；再把必要館所參考資料與可選的展示資料明確分開。不要直接改動現有使用者資料庫來證明此項。

### P2｜HTTP 服務會在資料庫不可用時先宣稱已啟動

[`src/server.ts`](../src/server.ts) 與 [`src/admin-server.ts`](../src/admin-server.ts) 都在建立 `pg.Pool` 後直接 `listen()`，沒有先 `await SELECT 1`。公開服務的 `/health` 確實會查資料庫；連線失敗時落入通用錯誤處理並回 **500**，而不是把「尚未就緒」明確回成 **503**。這不等於健康檢查會誤報 200，但啟動日誌可能已顯示 listening，而依賴資料庫的功能尚不可用。

建議在啟動前驗證連線，或清楚分開 liveness／readiness 並讓依賴資料庫的 readiness 回 503。補資料庫離線的啟動或健康檢查測試。

### P3｜API 文件可讀，但沒有 OpenAPI 規格

[`docs/api.md`](api.md) 記錄端點、篩選、欄位、狀態碼及資料來源語意；另有 Postman collection 和隔離資料庫的 HTTP 合約測試。這滿足人工理解與驗證的大部分需求，但目前找不到講義 Day 37 所用的 `openapi.yaml`／Swagger 文件。若要用同一講義標準展示 API 設計，可補可機讀的 OpenAPI 3 規格，並以既有合約測試避免文件與回應漂移；這不是現有 API 不能用的缺陷。

## 已有證據的部分

| 檢查原則 | Event Radar 判定與依據 |
| --- | --- |
| 環境設定與機密 | **符合目前本機範圍。** 服務在缺 `DATABASE_URL` 時停止；管理頁要求至少 16 字元的 `EVENT_RADAR_ADMIN_PASSWORD`；[`.gitignore`](../.gitignore) 排除 `.env`。啟動前資料庫就緒另見 P2。 |
| 輸入驗證與 REST 查詢 | **符合。** [`src/server.ts`](../src/server.ts) 驗證日期、枚舉、分頁與查詢字串長度，使用參數化 SQL；[`src/normalize.ts`](../src/normalize.ts) 檢查展期與官方網址，無效來源進待審。公開 API 目前僅支援 GET，故 FitConnect 的寫入 CRUD 規格不直接適用。 |
| SQL、交易、關聯與狀態 | **符合產品需要。** [`db/`](../db/) 定義 FK、唯一鍵、展期檢查與索引；[`src/ingest.ts`](../src/ingest.ts) 在交易中進行去重、異動紀錄、失敗回滾與同館鎖定。以 `visible` 和待審狀態管理展覽，不需要照搬報名取消的 `cancelled_at`。 |
| 索引與執行計畫 | **已有初步證據。** [`docs/stage-2026-10-05-phase5.md`](stage-2026-10-05-phase5.md) 記錄對約 28 筆資料的 `EXPLAIN (ANALYZE, BUFFERS)`；小表循序掃描合理，也明確指出既有標題全文 GIN 不服務目前的 `ILIKE` 查詢。代表性資料量及效能基準仍待日後資料成長時重測。 |
| 錯誤回應 | **大致符合。** 公開 API 用一致的 `{error:{code,message}}`、400／404／405；未預期錯誤只回通用 500，不向使用者洩漏 SQL 或 stack。它不必採用 FitConnect 的 `{status:"failed"}` 形狀。管理頁使用 HTML 錯誤頁，符合其瀏覽器表單介面。 |
| 分層 | **部分符合。** 來源 adapter、標準化、匯入與審核服務已分檔；公開 HTTP 的路由、SQL 與回應組裝仍集中在 [`src/server.ts`](../src/server.ts)。現階段可維護；端點增加時可抽出查詢服務，但不必為了模仿 Express 目錄而重構。 |

## 驗證與授權流程對照

**判定：目前設計符合「公開唯讀 API＋單一操作者本機審核」的邊界；不符合多使用者產品的身分管理要求，但那尚非目前功能。** 公開 [`src/server.ts`](../src/server.ts) 無寫入端點。管理服務 [`src/admin-server.ts`](../src/admin-server.ts) 只綁 `127.0.0.1`；密碼成功後簽發四小時、記憶體內的隨機 session，以 `HttpOnly; SameSite=Strict` cookie 保存；有登入失敗限次、Host／Origin、CSRF 檢查。待審讀取與 POST 審核均須登入，審核資料再由 [`src/review-service.ts`](../src/review-service.ts)／[`src/missing-review-service.ts`](../src/missing-review-service.ts) 驗證官方證據與資料狀態。[`test/ingest.integration.cjs`](../test/ingest.integration.cjs) 已寫有未登入 401、錯 Origin／CSRF 403、無效證據 400 等整合情境；本次未重跑。

FitConnect 的註冊、bcrypt 使用者密碼雜湊、Bearer JWT、教練角色與課程所有權，在此系統**不適用**。管理密碼來自環境變數，程式以 SHA-256 digest 及 `timingSafeEqual` 比對，並不是資料庫中的使用者密碼 hash；不能把它宣稱為已實作 bcrypt／JWT。審核紀錄的 `reviewer` 是登入後自行填寫，尚未綁定個別帳號身分。若未來讓多人審核或公開管理頁，須另外設計個別身分、角色／權限、可信審計身分、HTTPS 與正式 session 儲存；現有本機密碼頁不可直接照搬上網。

## 建議順序

1. 先處理空白資料庫的一鍵建置與 migration 版本紀錄，保證別人能重建作品。
2. 再處理啟動期資料庫就緒與 readiness 狀態碼，讓故障明確可觀測。
3. 為面試展示補 OpenAPI；資料量增加後再量測索引，不預先添加。

## 後續修正（2026-10-11）

上述三項已在後續實作處理：[`src/migrate.ts`](../src/migrate.ts)可從空白庫套用 001–012、記錄版本與 checksum，對舊庫提供需明確指定且核對結構的基線登記；公開及管理服務啟動前先查資料庫，公開 `/health` 的資料庫故障回 503；[`docs/openapi.yaml`](openapi.yaml)涵蓋公開唯讀端點。隔離 PostgreSQL 整合測試涵蓋空白庫、重跑與舊庫基線；型別檢查及 37 個單元測試通過。本機既有資料庫已備份並登記基線，詳見[階段紀錄](stage-2026-10-11-lecture-fixes.md)；公開部署和連續排程仍未驗證。
