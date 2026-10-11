# 2026-10-11｜公開 API 實際回應的 OpenAPI 契約驗證

## 為何補這一段

原有 CI 同時執行 OpenAPI 文件靜態檢查與 PostgreSQL HTTP 整合測試，但兩者沒有直接連起來。手寫欄位斷言可以抓主要欄位，卻容易遺漏巢狀票務、`null` 與文件 enum 的差異。

## 實作與決策

整合測試啟動真正的公開 HTTP 服務並建立隔離測試資料庫；每次 `get()` 取得 JSON，就按 `docs/openapi.yaml` 對應的路由、HTTP 狀態與 schema 驗證。驗證遞迴追蹤 `$ref`、必填欄位、物件／陣列、`allOf`、nullable、enum、數值界限及目前文件使用的字串格式。對未知的組合運算子或 format 明確失敗，避免新文件語法被靜默跳過。每條已記錄的 GET 路由都必須有一筆成功回應受驗。

這是 CI 測試工具，不增加正式 API 的執行成本或外部套件。原本的搜尋、資料來源、票價語意及欄位異動斷言仍存在；schema 驗證補的是「實際回應是否符合公開文件」。

## 證據與界線

- `npm run typecheck` 通過，`npm test` 44 項通過。
- 驗證器單元測試刻意給錯誤的健康狀態 enum 與巢狀 `purchaseUrl` 型別，確認會拒絕。
- `npm run test:integration` 以隔離 PostgreSQL 資料庫通過，涵蓋六條公開 GET 路由 200 與既有的 400、404 測試。
- CI 原本就會執行 `npm run test:integration`，本階段同步調整中文步驟名稱。尚未觸發所有 503／500 故障狀態；驗證器只支援目前文件採用的 OpenAPI schema 功能，不是通用規格驗證器。
