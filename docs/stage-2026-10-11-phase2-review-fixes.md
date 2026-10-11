# Phase 2 審查後修正｜2026-10-11

本階段處理兩個能在面試中直接驗證的缺口：小型官方清單縮水的保護，以及美術展異動歷史的公開查詢。沒有啟用排程或公開部署。

## 來源完整度

國美館目前的 12 張來源卡只有 3 筆符合本館限期展。原本的縮水門檻要基準至少 4 筆，所以「來源卡維持 12 張、公開展從 3 筆變 1 筆」不會被攔下。現在基準為 2–3 筆時，只要公開筆數縮至一半以下便標成 `deferred_partial`，暫緩舊展可見性及缺席候選判定，保留原可信基準，由站長核對後採用既有人工基準更新流程。3→2 不觸發；合法換展也可能觸發人工審查。隔離 PostgreSQL 測試用 12 張原始卡及 3→1 筆公開展驗證判定和基準未覆寫。

2026-10-11 只讀核對[國美館當期展覽](https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1462&sms=11893)有 11 筆可見卡片，[展覽預告](https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1464&sms=11893)有 1 筆；可見頁面未出現「下一頁」。這是當日清單觀察，沒有驗證網站內部是否會另啟分頁、日後資料量變大時是否換版，亦沒有跨週成功紀錄。遇到來源卡格式或數量異常，仍須回館方頁面核對。

## 藝術欄位異動 API

`GET /exhibitions/:id/art-changes` 回傳最近 100 筆美術展欄位異動，欄位包含 `artistNames`、`curatorNames`、`exhibitionType`、`venueArea`、`floor`、`relatedEvents`。舊值和新值依欄位保留原生 JSON 值；共通展覽異動仍由 `/changes` 提供。隔離資料庫測試把藝術家由「甲藝術家」改為「乙藝術家」，核對 HTTP 回應及 OpenAPI schema，也測一般館所回空陣列。

## 搜尋索引

[ER-21](technical-decisions.md#er-21搜尋索引的取捨已量測暫不新增)先前用約 28 筆本機展覽做 `EXPLAIN (ANALYZE, BUFFERS)`，順序掃描約 0.03–0.47 ms。現有標題 GIN 全文索引不服務目前的 `ILIKE '%詞%'` 查詢；本輪沒有新的延遲或資料量證據支持改索引，因此未新增索引。這是既有量測，不冒稱本輪重測。

## 驗證

- `npm run typecheck`：通過。
- `npm test`：56 項通過。
- `npm run test:integration`：隔離 PostgreSQL、真實 HTTP 與 OpenAPI 成功回應驗證通過，前置 React build 通過。
- 未做國美館正式跨週同步、公開網站部署或 production Queue 啟用。
